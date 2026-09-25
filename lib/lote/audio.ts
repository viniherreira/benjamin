/**
 * Áudio de reunião → trechos que o servidor aceita.
 *
 * SÓ NAVEGADOR: usa a Web Audio API.
 *
 * O problema que isto resolve não é o lote, é o áudio em si. Uma Function da
 * Vercel recusa corpo de requisição acima de 4,5 MB, e o provedor de STT recusa
 * arquivo acima de 25 MB. Uma reunião de 40 minutos em MP3 tem uns 40 MB —
 * nem chega ao provedor. Então o áudio é decodificado aqui, reduzido a mono
 * 16 kHz (tudo o que reconhecimento de fala usa) e cortado em trechos de até
 * 110 s, cada um com ~3,5 MB em WAV.
 *
 * O corte cai no ponto mais silencioso dos últimos 12 s de cada trecho, para
 * não partir palavra ao meio — palavra partida é palavra perdida nas duas
 * transcrições. E trecho que é só silêncio não é enviado: além de custar, o
 * Whisper em português alucina em silêncio ("Legendas pela comunidade
 * Amara.org") e o motor analisaria uma frase que ninguém disse.
 */

export const TAXA = 16_000;
const MAX_SEGUNDOS = 110;
const MIN_SEGUNDOS = 20;
const JANELA_CORTE_SEGUNDOS = 12;
/** Abaixo disto, em RMS, é silêncio para fins de envio. */
const LIMIAR_SILENCIO = 0.004;
/** Arquivo pequeno vai inteiro, sem decodificar: mais rápido e sem risco de codec. */
export const LIMITE_DIRETO_BYTES = 4 * 1024 * 1024;

export type Trecho = { blob: Blob; nome: string; inicio: number; fim: number };

function rms(sinal: Float32Array, de: number, ate: number): number {
  let s = 0;
  const n = Math.max(1, ate - de);
  for (let i = de; i < ate; i++) s += sinal[i]! * sinal[i]!;
  return Math.sqrt(s / n);
}

/** Índice do quadro de 250 ms mais silencioso entre `de` e `ate`. */
function pontoMaisQuieto(sinal: Float32Array, de: number, ate: number): number {
  const quadro = Math.floor(TAXA * 0.25);
  let melhor = ate;
  let menor = Infinity;
  for (let i = de; i + quadro <= ate; i += Math.floor(quadro / 2)) {
    const e = rms(sinal, i, i + quadro);
    if (e < menor) {
      menor = e;
      melhor = i + Math.floor(quadro / 2);
    }
  }
  return melhor;
}

/** Pontos de corte (em amostras) — função pura, testável sem navegador. */
export function planejarCortes(sinal: Float32Array): [number, number][] {
  const total = sinal.length;
  const max = MAX_SEGUNDOS * TAXA;
  const cortes: [number, number][] = [];
  let inicio = 0;
  while (inicio < total) {
    if (total - inicio <= max) {
      cortes.push([inicio, total]);
      break;
    }
    const alvo = inicio + max;
    const janela = Math.max(inicio + MIN_SEGUNDOS * TAXA, alvo - JANELA_CORTE_SEGUNDOS * TAXA);
    const fim = pontoMaisQuieto(sinal, janela, alvo);
    cortes.push([inicio, fim]);
    inicio = fim;
  }
  return cortes;
}

export function ehSilencio(sinal: Float32Array, de: number, ate: number): boolean {
  // Por quadros de 1 s: um trecho com fala curta no meio de muito silêncio não
  // pode ser descartado pela média.
  for (let i = de; i < ate; i += TAXA) if (rms(sinal, i, Math.min(ate, i + TAXA)) > LIMIAR_SILENCIO) return false;
  return true;
}

export function codificarWav(sinal: Float32Array, de: number, ate: number): Blob {
  const n = ate - de;
  const buffer = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buffer);
  const escrever = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  escrever(0, 'RIFF');
  v.setUint32(4, 36 + n * 2, true);
  escrever(8, 'WAVE');
  escrever(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, 1, true); // mono
  v.setUint32(24, TAXA, true);
  v.setUint32(28, TAXA * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  escrever(36, 'data');
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, sinal[de + i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

async function decodificarMono16k(arquivo: Blob): Promise<Float32Array> {
  const Ctx =
    globalThis.OfflineAudioContext ??
    (globalThis as unknown as { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!Ctx) throw new Error('Este navegador não decodifica áudio. Use Chrome, Edge ou Firefox atualizados.');
  // decodeAudioData reamostra para a taxa do contexto: 16 kHz sai direto daqui.
  const ctx = new Ctx(1, 1, TAXA);
  const audio = await ctx.decodeAudioData(await arquivo.arrayBuffer());
  if (audio.numberOfChannels === 1) return audio.getChannelData(0).slice();
  const mono = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const canal = audio.getChannelData(c);
    for (let i = 0; i < canal.length; i++) mono[i]! += canal[i]! / audio.numberOfChannels;
  }
  return mono;
}

export type ResultadoFatiamento = {
  trechos: Trecho[];
  duracaoSegundos: number | null;
  silenciosos: number;
};

/**
 * Prepara um arquivo de áudio para transcrição. Arquivo até 4 MB segue
 * inteiro; acima disso é decodificado e cortado. Se o navegador não conseguir
 * decodificar o formato, a mensagem diz qual formato usar em vez de falhar
 * com erro de codec.
 */
export const EXT_WHISPER = new Set(['flac', 'm4a', 'mp3', 'mp4', 'mpeg', 'mpga', 'oga', 'ogg', 'wav', 'webm']);

export async function fatiarAudio(arquivo: Blob, nome: string): Promise<ResultadoFatiamento> {
  // Formato que o provedor não lê (mov, aac, wma, amr, 3gp, mkv) passa pela
  // decodificação mesmo pequeno: sai WAV, que ele lê.
  const ext = nome.split('.').pop()?.toLowerCase() ?? '';
  if (arquivo.size <= LIMITE_DIRETO_BYTES && EXT_WHISPER.has(ext)) {
    return { trechos: [{ blob: arquivo, nome, inicio: 0, fim: 0 }], duracaoSegundos: null, silenciosos: 0 };
  }

  let sinal: Float32Array;
  try {
    sinal = await decodificarMono16k(arquivo);
  } catch (e) {
    throw new Error(
      `O navegador não conseguiu decodificar este áudio (${e instanceof Error ? e.message : 'formato não suportado'}). ` +
        'Converta para MP3 ou M4A, ou envie arquivos de até 4 MB.',
    );
  }

  const base = nome.replace(/\.[^.]+$/, '');
  const trechos: Trecho[] = [];
  let silenciosos = 0;
  for (const [de, ate] of planejarCortes(sinal)) {
    if (ehSilencio(sinal, de, ate)) {
      silenciosos++;
      continue;
    }
    trechos.push({
      blob: codificarWav(sinal, de, ate),
      nome: `${base}-${String(trechos.length + 1).padStart(3, '0')}.wav`,
      inicio: de / TAXA,
      fim: ate / TAXA,
    });
  }
  return { trechos, duracaoSegundos: sinal.length / TAXA, silenciosos };
}

/**
 * Frases que o Whisper produz sobre silêncio ou música em português. Só são
 * removidas quando são TUDO o que o trecho devolveu — dentro de fala real,
 * "obrigado por assistir" pode ter sido dito, e aí fica.
 */
const ALUCINACOES = [
  /^legendas? pela comunidade amara\.org\.?$/i,
  /^legenda[s]? (?:por|de)? ?[\p{L} ]{3,40}$/iu,
  /^(?:obrigad[oa] por assistir|inscreva-se no canal|tchau,? tchau)[.!]*$/i,
  /^\.+$/,
];

export function limparTranscricaoDeTrecho(texto: string): string {
  const t = texto.trim();
  return ALUCINACOES.some((re) => re.test(t)) ? '' : t;
}
