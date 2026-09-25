import { atualizarMeta, salvarMeta, salvarPedaco, type Canal, type MetaGravacao } from './armazenamento';

/**
 * Grava a reunião em dois canais separados.
 *
 * SÓ NAVEGADOR.
 *
 *   vendedor  microfone deste computador (com cancelamento de eco)
 *   cliente   áudio da aba do Meet, Teams ou Zoom web (getDisplayMedia)
 *
 * A captura antiga usava só a Web Speech API sobre o microfone. Numa call, a
 * voz do cliente sai pelo alto-falante e o cancelamento de eco a remove do
 * microfone: a transcrição ficava só com o vendedor, que é justamente o lado
 * que o produto menos precisa ouvir. E o Chrome encerra o reconhecimento sozinho
 * depois de um tempo, sem reiniciar — reunião longa virava os primeiros minutos.
 *
 * Modo presencial grava só o microfone: um canal, sem separação de falante.
 */

export type Modo = 'online' | 'presencial';

export class ErroCaptura extends Error {
  constructor(
    mensagem: string,
    readonly instrucao?: string,
  ) {
    super(mensagem);
    this.name = 'ErroCaptura';
  }
}

export type Evento =
  | { tipo: 'aba-encerrada' }
  | { tipo: 'microfone-encerrado' }
  | { tipo: 'armazenamento-falhou'; mensagem: string };

export type GravacaoPronta = {
  meta: MetaGravacao;
  canais: Partial<Record<Canal, Blob>>;
};

export type Gravador = {
  id: string;
  modo: Modo;
  /** Nível atual de cada canal, 0 a 1, para os medidores. */
  niveis: () => Partial<Record<Canal, number>>;
  segundos: () => number;
  parar: () => Promise<GravacaoPronta>;
  descartar: () => void;
};

const MIMES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

export function mimeSuportado(): string | null {
  if (typeof MediaRecorder === 'undefined') return null;
  return MIMES.find((m) => MediaRecorder.isTypeSupported(m)) ?? null;
}

export function extensaoDoMime(mime: string): string {
  return mime.includes('mp4') ? 'm4a' : mime.includes('ogg') ? 'ogg' : 'webm';
}

/**
 * Captura de áudio da aba existe no Chrome e no Edge de computador. Firefox e
 * Safari compartilham tela mas não o som dela, e no celular não há
 * compartilhamento de aba.
 */
export function suportaModoOnline(): boolean {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) return false;
  const ua = navigator.userAgent;
  const movel = /Android|iPhone|iPad|Mobile/i.test(ua);
  const chromium = /Chrome\/|Edg\//.test(ua) && !/OPR\//.test(ua);
  return chromium && !movel;
}

async function abrirMicrofone(): Promise<MediaStream> {
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
  } catch (e) {
    const nome = e instanceof DOMException ? e.name : '';
    if (nome === 'NotAllowedError') {
      throw new ErroCaptura('O navegador bloqueou o microfone.', 'Clique no cadeado ao lado do endereço, permita o microfone e tente de novo.');
    }
    if (nome === 'NotFoundError') throw new ErroCaptura('Nenhum microfone encontrado neste computador.');
    throw new ErroCaptura(`Não foi possível abrir o microfone (${nome || 'erro desconhecido'}).`);
  }
}

async function abrirAudioDaAba(): Promise<MediaStream> {
  let tela: MediaStream;
  try {
    tela = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      // Sem processamento no áudio da aba: cancelamento de eco aqui apagaria
      // justamente a voz que se quer gravar.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      // Dicas do Chrome: aba em vez de tela, sem oferecer a própria aba do Benjamin.
      preferCurrentTab: false,
      selfBrowserSurface: 'exclude',
      systemAudio: 'include',
    } as DisplayMediaStreamOptions);
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotAllowedError') {
      throw new ErroCaptura('O compartilhamento da aba foi cancelado.', 'Clique em gravar de novo e escolha a aba da reunião.');
    }
    throw new ErroCaptura('Não foi possível capturar a aba da reunião.');
  }
  if (tela.getAudioTracks().length === 0) {
    tela.getTracks().forEach((t) => t.stop());
    throw new ErroCaptura(
      'A aba foi compartilhada sem o som.',
      'Na janela do Chrome, escolha a aba da reunião e deixe ligada a opção “Compartilhar áudio da guia” antes de clicar em Compartilhar.',
    );
  }
  return tela;
}

function medidor(ctx: AudioContext, stream: MediaStream): () => number {
  const analisador = ctx.createAnalyser();
  analisador.fftSize = 2048;
  ctx.createMediaStreamSource(stream).connect(analisador);
  const buf = new Float32Array(analisador.fftSize);
  return () => {
    analisador.getFloatTimeDomainData(buf);
    let s = 0;
    for (const v of buf) s += v * v;
    // RMS de fala fica entre 0,01 e 0,2; a raiz espalha isso pela barra inteira.
    return Math.min(1, Math.sqrt(Math.sqrt(s / buf.length)) * 1.6);
  };
}

export async function iniciarGravacao(o: {
  modo: Modo;
  nomeVendedor: string;
  aoEvento: (e: Evento) => void;
  /** Sem IndexedDB a gravação segue só em memória, sem recuperação. */
  persistir: boolean;
}): Promise<Gravador> {
  const mime = mimeSuportado();
  if (!mime) throw new ErroCaptura('Este navegador não grava áudio.', 'Use Chrome, Edge, Firefox ou Safari atualizados.');

  // Aba primeiro: se a pessoa cancelar ou esquecer o som, o microfone nem chega a abrir.
  const aba = o.modo === 'online' ? await abrirAudioDaAba() : null;
  let mic: MediaStream;
  try {
    mic = await abrirMicrofone();
  } catch (e) {
    aba?.getTracks().forEach((t) => t.stop());
    throw e;
  }

  const id = `g-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const fontes: [Canal, MediaStream][] = [['vendedor', new MediaStream(mic.getAudioTracks())]];
  if (aba) fontes.push(['cliente', new MediaStream(aba.getAudioTracks())]);

  const ctx = new AudioContext();
  const niveis = Object.fromEntries(fontes.map(([c, s]) => [c, medidor(ctx, s)])) as Partial<Record<Canal, () => number>>;

  const meta: MetaGravacao = {
    id,
    criadaEm: Date.now(),
    modo: o.modo,
    nomeVendedor: o.nomeVendedor,
    mime,
    canais: fontes.map(([c]) => c),
    deslocamento: {},
    duracaoSegundos: null,
    finalizada: false,
    transcrita: false,
  };

  let persistir = o.persistir;
  const guardar = async (f: () => Promise<unknown>) => {
    if (!persistir) return;
    try {
      await f();
    } catch (e) {
      persistir = false;
      o.aoEvento({ tipo: 'armazenamento-falhou', mensagem: e instanceof Error ? e.message : String(e) });
    }
  };
  await guardar(() => salvarMeta(meta));

  const partes: Record<Canal, Blob[]> = { vendedor: [], cliente: [] };
  const inicios: Partial<Record<Canal, number>> = {};
  const t0 = performance.now();

  const gravadores = fontes.map(([canal, stream]) => {
    const r = new MediaRecorder(stream, { mimeType: mime, audioBitsPerSecond: 32_000 });
    let seq = 0;
    r.onstart = () => {
      inicios[canal] = performance.now();
    };
    r.ondataavailable = (e) => {
      if (!e.data || e.data.size === 0) return;
      partes[canal].push(e.data);
      const n = seq++;
      void guardar(() => salvarPedaco(id, canal, n, e.data));
    };
    r.start(5000);
    return { canal, r };
  });

  mic.getAudioTracks()[0]?.addEventListener('ended', () => o.aoEvento({ tipo: 'microfone-encerrado' }));
  aba?.getAudioTracks()[0]?.addEventListener('ended', () => o.aoEvento({ tipo: 'aba-encerrada' }));
  // "Parar compartilhamento" na barra do Chrome encerra o vídeo, não sempre o áudio.
  aba?.getVideoTracks()[0]?.addEventListener('ended', () => o.aoEvento({ tipo: 'aba-encerrada' }));

  const soltar = () => {
    mic.getTracks().forEach((t) => t.stop());
    aba?.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };

  return {
    id,
    modo: o.modo,
    niveis: () => Object.fromEntries(Object.entries(niveis).map(([c, f]) => [c, f!()])) as Partial<Record<Canal, number>>,
    segundos: () => (performance.now() - t0) / 1000,
    async parar() {
      await Promise.all(
        gravadores.map(
          ({ r }) =>
            new Promise<void>((ok) => {
              if (r.state === 'inactive') return ok();
              r.addEventListener('stop', () => ok(), { once: true });
              r.stop();
            }),
        ),
      );
      soltar();

      const primeiro = Math.min(...Object.values(inicios).filter((v): v is number => v !== undefined));
      const deslocamento = Object.fromEntries(
        Object.entries(inicios).map(([c, v]) => [c, Number((((v ?? primeiro) - primeiro) / 1000).toFixed(3))]),
      ) as Partial<Record<Canal, number>>;

      const final: MetaGravacao = { ...meta, deslocamento, duracaoSegundos: (performance.now() - t0) / 1000, finalizada: true };
      await guardar(() => atualizarMeta(id, final));

      const canais: Partial<Record<Canal, Blob>> = {};
      for (const [canal] of fontes) if (partes[canal].length) canais[canal] = new Blob(partes[canal], { type: mime });
      return { meta: final, canais };
    },
    descartar() {
      gravadores.forEach(({ r }) => r.state !== 'inactive' && r.stop());
      soltar();
    },
  };
}
