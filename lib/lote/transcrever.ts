import { ErroFatal, ErroSessao, ErroTransitorio } from './agenda';
import { fatiarAudio, limparTranscricaoDeTrecho, type Trecho } from './audio';
import type { Segmento } from '../gravacao/mesclar';

/**
 * Transcreve um arquivo de áudio de qualquer tamanho pelo /api/transcribe.
 *
 * SÓ NAVEGADOR. Usado pelo upload de arquivo único e pelo lote.
 *
 * Falha de rede ou 429 num trecho é tentada de novo NAQUELE trecho: numa
 * reunião de uma hora (33 trechos), repetir o áudio inteiro porque o trecho 31
 * tomou um 429 custaria 30 transcrições pagas de novo. O `cache` guarda o que
 * já voltou, para que uma nova tentativa da reunião inteira retome dali.
 */

export type TrechoTranscrito = { texto: string; segmentos: Segmento[] };

export type OpcoesTranscricao = {
  sinal?: AbortSignal;
  aoProgresso?: (feitos: number, total: number) => void;
  /** Trechos da mesma reunião enviados ao mesmo tempo. */
  concorrencia?: number;
  cache?: Map<number, TrechoTranscrito>;
};

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

async function transcreverTrecho(t: Trecho, sinal?: AbortSignal): Promise<TrechoTranscrito> {
  for (let tentativa = 1; ; tentativa++) {
    const form = new FormData();
    form.append('audio', t.blob, t.nome);

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
      const corpo = (await r.json()) as { texto?: string; segmentos?: Segmento[] };
      // Os tempos do provedor são relativos ao trecho; somar o início do trecho
      // os põe na linha do tempo da reunião inteira.
      const segmentos = (corpo.segmentos ?? []).map((g) => ({ ...g, inicio: g.inicio + t.inicio, fim: g.fim + t.inicio }));
      return { texto: limparTranscricaoDeTrecho(corpo.texto ?? ''), segmentos };
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

export type ResultadoTranscricao = {
  texto: string;
  /** Segmentos com tempo absoluto, em segundos desde o início do arquivo. */
  segmentos: Segmento[];
  trechos: number;
  silenciosos: number;
  duracaoSegundos: number | null;
};

export async function transcreverArquivo(arquivo: Blob, nome: string, o: OpcoesTranscricao = {}): Promise<ResultadoTranscricao> {
  const { trechos, silenciosos, duracaoSegundos } = await fatiarAudio(arquivo, nome);
  if (trechos.length === 0) throw new Error('O áudio não tem fala detectável — só silêncio.');

  const cache = o.cache ?? new Map<number, TrechoTranscrito>();
  const resultados: TrechoTranscrito[] = new Array(trechos.length);
  let feitos = 0;
  trechos.forEach((_, i) => {
    if (cache.has(i)) {
      resultados[i] = cache.get(i)!;
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
      const r = await transcreverTrecho(trechos[i]!, o.sinal);
      cache.set(i, r);
      resultados[i] = r;
      o.aoProgresso?.(++feitos, trechos.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(o.concorrencia ?? 3, trechos.length) }, trabalhador));

  // Trechos são cortados em pausa: a quebra de linha é a fronteira natural.
  const texto = resultados.map((r) => r.texto).filter(Boolean).join('\n').trim();
  if (!texto) throw new Error('O provedor não reconheceu fala em nenhum trecho do áudio.');
  const segmentos = resultados.flatMap((r) => r.segmentos);
  return { texto, segmentos, trechos: trechos.length, silenciosos, duracaoSegundos };
}
