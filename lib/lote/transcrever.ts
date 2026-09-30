import { ErroFatal, ErroSessao, ErroTransitorio } from './agenda';
import { fatiarAudio, limparTranscricaoDeTrecho, type Trecho } from './audio';

/**
 * Transcreve um arquivo de áudio de qualquer tamanho pelo /api/transcribe.
 *
 * SÓ NAVEGADOR. Usado pelo upload de arquivo único, pela gravação ao vivo e
 * pelo lote.
 *
 * Falha de rede ou 429 num trecho é tentada de novo NAQUELE trecho: numa
 * reunião de uma hora (33 trechos), repetir o áudio inteiro porque o trecho 31
 * tomou um 429 custaria 30 transcrições de novo. O `cache` guarda o que já
 * voltou, para que uma nova tentativa da reunião inteira retome dali.
 *
 * Quando o provedor separa quem falou (Gemini), os trechos vão EM SEQUÊNCIA e
 * cada um leva as últimas falas do anterior: é o único jeito de "Falante A"
 * continuar sendo a mesma pessoa no trecho 12. Em paralelo, cada trecho
 * reinventaria os rótulos do zero.
 */

export type OpcoesTranscricao = {
  sinal?: AbortSignal;
  aoProgresso?: (feitos: number, total: number) => void;
  /** Trechos da mesma reunião enviados ao mesmo tempo (ignorado quando há separação de falantes). */
  concorrencia?: number;
  cache?: Map<number, string>;
};

export type EstadoTranscricao = {
  disponivel: boolean;
  provedor?: 'gemini' | 'whisper' | null;
  separa_falantes?: boolean;
  erro?: string;
  detalhe?: string;
  alternativas?: string[];
};

let consulta: Promise<EstadoTranscricao> | null = null;

/** O que o servidor oferece. Perguntado uma vez por página; falha não fica em cache. */
export function consultarTranscricao(): Promise<EstadoTranscricao> {
  consulta ??= fetch('/api/transcribe')
    .then((r) =>
      r.ok
        ? (r.json() as Promise<EstadoTranscricao>)
        : { disponivel: false, erro: `Não foi possível consultar a transcrição (HTTP ${r.status}).` },
    )
    .catch(() => ({ disponivel: false, erro: 'Não foi possível consultar a transcrição.' }))
    .then((e) => {
      if (!e.disponivel) consulta = null;
      return e;
    });
  return consulta;
}

const TENTATIVAS_POR_TRECHO = 5;

function esperar(ms: number, sinal?: AbortSignal): Promise<void> {
  return new Promise((ok, erro) => {
    const t = setTimeout(ok, ms);
    sinal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        erro(new DOMException('Cancelado', 'AbortError'));
      },
      { once: true },
    );
  });
}

async function mensagemDe(r: Response): Promise<string> {
  const corpo = (await r.json().catch(() => null)) as { erro?: string } | null;
  return corpo?.erro ?? `HTTP ${r.status}`;
}

async function transcreverTrecho(t: Trecho, contexto: string, sinal?: AbortSignal): Promise<string> {
  for (let tentativa = 1; ; tentativa++) {
    const form = new FormData();
    form.append('audio', t.blob, t.nome);
    if (contexto) form.append('prompt', contexto);

    let r: Response;
    try {
      r = await fetch('/api/transcribe', { method: 'POST', body: form, signal: sinal });
    } catch (e) {
      if (sinal?.aborted) throw e;
      if (tentativa >= TENTATIVAS_POR_TRECHO) throw new ErroTransitorio('Sem conexão com o servidor.');
      await esperar(1000 * 2 ** tentativa, sinal);
      continue;
    }

    if (r.ok) {
      const corpo = (await r.json()) as { texto: string };
      return limparTranscricaoDeTrecho(corpo.texto ?? '');
    }
    if (r.status === 401) throw new ErroSessao();
    if (r.status === 503) throw new ErroFatal(await mensagemDe(r), 'transcrever');
    if (r.status === 429 || r.status >= 500) {
      const aguardar = Math.min(60, Number(r.headers.get('retry-after')) || 2 ** tentativa) * 1000;
      if (tentativa >= TENTATIVAS_POR_TRECHO) throw new ErroTransitorio(await mensagemDe(r), aguardar);
      await esperar(aguardar, sinal);
      continue;
    }
    throw new Error(`${t.nome}: ${await mensagemDe(r)}`);
  }
}

/** As últimas falas de um trecho: o suficiente para o modelo reconhecer quem é quem. */
function fimDe(texto: string | undefined): string {
  if (!texto) return '';
  return texto.split('\n').filter(Boolean).slice(-6).join('\n').slice(-800);
}

export type ResultadoTranscricao = {
  texto: string;
  trechos: number;
  silenciosos: number;
  duracaoSegundos: number | null;
  separaFalantes: boolean;
};

export async function transcreverArquivo(arquivo: Blob, nome: string, o: OpcoesTranscricao = {}): Promise<ResultadoTranscricao> {
  const estado = await consultarTranscricao();
  const separaFalantes = estado.separa_falantes === true;

  const { trechos, silenciosos, duracaoSegundos } = await fatiarAudio(arquivo, nome, { sempreDecodificar: separaFalantes });
  if (trechos.length === 0) throw new Error('O áudio não tem fala detectável — só silêncio.');

  const cache = o.cache ?? new Map<number, string>();
  const textos: string[] = new Array(trechos.length);
  let feitos = 0;
  trechos.forEach((_, i) => {
    if (cache.has(i)) {
      textos[i] = cache.get(i)!;
      feitos++;
    }
  });
  o.aoProgresso?.(feitos, trechos.length);

  let proximo = 0;
  const trabalhador = async () => {
    for (;;) {
      const i = proximo++;
      if (i >= trechos.length) return;
      if (cache.has(i)) continue;
      // Com um trabalhador só, o trecho anterior já voltou quando este sai.
      const contexto = separaFalantes && i > 0 ? fimDe(textos[i - 1]) : '';
      const texto = await transcreverTrecho(trechos[i]!, contexto, o.sinal);
      cache.set(i, texto);
      textos[i] = texto;
      o.aoProgresso?.(++feitos, trechos.length);
    }
  };
  const frentes = separaFalantes ? 1 : Math.min(o.concorrencia ?? 3, trechos.length);
  await Promise.all(Array.from({ length: frentes }, trabalhador));

  // Trechos são cortados em pausa: a quebra de linha é a fronteira natural.
  const texto = textos.filter(Boolean).join('\n').trim();
  if (!texto) throw new Error('O provedor não reconheceu fala em nenhum trecho do áudio.');
  return { texto, trechos: trechos.length, silenciosos, duracaoSegundos, separaFalantes };
}
