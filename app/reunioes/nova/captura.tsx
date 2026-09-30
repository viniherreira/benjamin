'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Check,
  Download,
  Loader2,
  Mic,
  MonitorSpeaker,
  RotateCcw,
  Square,
  TriangleAlert,
  Upload,
  Users,
} from 'lucide-react';
import { consultarTranscricao, transcreverArquivo, type EstadoTranscricao } from '@/lib/lote/transcrever';

/**
 * Adaptadores de entrada.
 *
 * A decisão de arquitetura do produto: o núcleo consome TEXTO, e a captação é
 * plugável. Estes dois componentes só produzem o texto — ele segue exatamente o
 * mesmo caminho de análise da aba "Colar texto". É por isso que dá para dizer,
 * sem asterisco, que o Benjamin é agnóstico à origem.
 *
 * Os dois terminam chamando `aoTranscrever`, e o formulário analisa na hora:
 * quem grava uma reunião quer o briefing, não um texto para revisar.
 */

/* ------------------------------------------------------------------ *
 * Web Speech API — tipos mínimos
 *
 * A API não está no lib.dom padrão do TypeScript porque ainda é prefixada em
 * boa parte dos navegadores. Declaramos só o que usamos.
 * ------------------------------------------------------------------ */

type ResultadoFala = { transcript: string; confidence: number };
type ItemResultado = { 0: ResultadoFala; isFinal: boolean; length: number };
type EventoFala = { resultIndex: number; results: { length: number } & Record<number, ItemResultado> };

type Reconhecimento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: EventoFala) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type ConstrutorReconhecimento = new () => Reconhecimento;

function obterConstrutor(): ConstrutorReconhecimento | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** Erros da prévia que não se resolvem tentando de novo. */
const FALA_SEM_VOLTA = new Set(['not-allowed', 'service-not-allowed', 'audio-capture']);

/* ------------------------------------------------------------------ */

function useEstadoTranscricao(): EstadoTranscricao | null {
  const [estado, setEstado] = useState<EstadoTranscricao | null>(null);
  useEffect(() => {
    let vivo = true;
    void consultarTranscricao().then((e) => {
      if (vivo) setEstado(e);
    });
    return () => {
      vivo = false;
    };
  }, []);
  return estado;
}

const textoProgresso = (feitos: number, total: number) =>
  total > 1 ? `Transcrevendo trecho ${Math.min(feitos + 1, total)} de ${total}…` : 'Transcrevendo…';

/** Ordem de preferência: Chrome e Edge gravam webm/opus; Safari, mp4. */
const TIPOS_GRAVACAO = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];

function extensaoDe(mime: string): string {
  if (mime.includes('mp4')) return 'm4a';
  if (mime.includes('ogg')) return 'ogg';
  return 'webm';
}

function relogio(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function mensagemDeMidia(e: unknown): string {
  if (e instanceof DOMException) {
    if (e.name === 'NotAllowedError') return 'Permissão de microfone negada pelo navegador.';
    if (e.name === 'NotFoundError') return 'Nenhum microfone encontrado.';
    if (e.name === 'NotReadableError') return 'O microfone está em uso por outro programa.';
  }
  return 'Não foi possível iniciar a gravação.';
}

/* ------------------------------------------------------------------ *
 * Gravar ao vivo
 *
 * Grava o áudio de verdade (MediaRecorder) e, ao parar, transcreve pela mesma
 * rota do upload — com quem falou separado. O reconhecimento de fala do
 * navegador roda junto só como prévia na tela e como plano B: ele não separa
 * falantes e erra mais, então nunca é a primeira escolha.
 * ------------------------------------------------------------------ */

type FaseVivo = 'aviso' | 'pronto' | 'gravando' | 'transcrevendo' | 'falhou';

type Sessao = {
  gravador: MediaRecorder;
  fluxos: MediaStream[];
  ctx: AudioContext | null;
  fala: Reconhecimento | null;
};

function encerrar(s: Sessao | null, descartar: boolean) {
  if (!s) return;
  if (descartar) s.gravador.onstop = null;
  s.fala?.stop();
  if (s.gravador.state !== 'inactive') s.gravador.stop();
  s.fluxos.forEach((f) => f.getTracks().forEach((t) => t.stop()));
  void s.ctx?.close().catch(() => undefined);
}

export function CapturaAoVivo({ aoTranscrever }: { aoTranscrever: (texto: string) => void }) {
  const estado = useEstadoTranscricao();
  const [suporte, setSuporte] = useState<{ gravar: boolean; aba: boolean } | null>(null);
  const [fase, setFase] = useState<FaseVivo>('aviso');
  const [incluirAba, setIncluirAba] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [previa, setPrevia] = useState('');
  const [parcial, setParcial] = useState('');
  const [progresso, setProgresso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [urlGravacao, setUrlGravacao] = useState<string | null>(null);

  const sessao = useRef<Sessao | null>(null);
  const pedacos = useRef<Blob[]>([]);
  const gravacao = useRef<Blob | null>(null);
  const cache = useRef(new Map<number, string>());
  const previaRef = useRef('');

  useEffect(() => {
    setSuporte({
      gravar: typeof MediaRecorder !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia),
      aba: Boolean(navigator.mediaDevices && 'getDisplayMedia' in navigator.mediaDevices),
    });
    // Sair da tela gravando descarta: não deixar microfone aberto nem mandar
    // analisar uma reunião que a pessoa abandonou.
    return () => encerrar(sessao.current, true);
  }, []);

  useEffect(() => {
    if (fase !== 'gravando') return;
    const t = setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [fase]);

  // Fechar a aba no meio perde a gravação: o navegador pergunta antes.
  useEffect(() => {
    if (fase !== 'gravando' && fase !== 'transcrevendo') return;
    const segurar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', segurar);
    return () => window.removeEventListener('beforeunload', segurar);
  }, [fase]);

  useEffect(() => {
    return () => {
      if (urlGravacao) URL.revokeObjectURL(urlGravacao);
    };
  }, [urlGravacao]);

  function iniciarPrevia(): Reconhecimento | null {
    const Construtor = obterConstrutor();
    if (!Construtor) return null;
    const r = new Construtor();
    r.lang = 'pt-BR';
    r.continuous = true;
    r.interimResults = true;
    let desistiu = false;

    r.onresult = (e) => {
      let finalizado = '';
      let emAndamento = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const item = e.results[i] as ItemResultado;
        if (item.isFinal) finalizado += item[0].transcript;
        else emAndamento += item[0].transcript;
      }
      if (finalizado.trim()) {
        previaRef.current = `${previaRef.current}${previaRef.current ? ' ' : ''}${finalizado.trim()}`;
        setPrevia(previaRef.current);
      }
      setParcial(emAndamento);
    };
    // A prévia é acessório: falhar nela não interrompe a gravação.
    r.onerror = (e) => {
      if (FALA_SEM_VOLTA.has(e.error)) desistiu = true;
    };
    // O Chrome encerra o reconhecimento sozinho depois de um silêncio longo;
    // enquanto a gravação segue, a prévia volta.
    r.onend = () => {
      if (!desistiu && sessao.current?.fala === r && sessao.current.gravador.state === 'recording') {
        try {
          r.start();
        } catch {
          /* já reiniciado */
        }
      }
    };
    try {
      r.start();
    } catch {
      return null;
    }
    return r;
  }

  async function iniciar() {
    setErro(null);
    setAviso(null);
    setPrevia('');
    setParcial('');
    setSegundos(0);
    previaRef.current = '';
    pedacos.current = [];
    gravacao.current = null;
    cache.current = new Map();
    setUrlGravacao(null);

    const fluxos: MediaStream[] = [];
    try {
      const mic = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      fluxos.push(mic);

      // Reunião no navegador (Meet, Teams, Zoom web): com fone de ouvido, o
      // microfone só pega a sua voz. O som da aba traz a dos outros.
      let somDaAba: MediaStreamTrack[] = [];
      if (incluirAba) {
        try {
          const tela = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
          fluxos.push(tela);
          somDaAba = tela.getAudioTracks();
          if (somDaAba.length === 0) {
            setAviso(
              'O compartilhamento veio sem som. Para incluir a voz dos outros, escolha a aba da reunião e marque “Compartilhar áudio da aba”. Gravando só o microfone.',
            );
          }
        } catch {
          setAviso('Compartilhamento da aba cancelado. Gravando só o microfone.');
        }
      }

      let ctx: AudioContext | null = null;
      let fonte: MediaStream = mic;
      if (somDaAba.length) {
        ctx = new AudioContext();
        void ctx.resume();
        const destino = ctx.createMediaStreamDestination();
        ctx.createMediaStreamSource(mic).connect(destino);
        ctx.createMediaStreamSource(new MediaStream(somDaAba)).connect(destino);
        fonte = destino.stream;
      }

      const tipo = TIPOS_GRAVACAO.find((t) => MediaRecorder.isTypeSupported(t));
      const gravador = new MediaRecorder(fonte, tipo ? { mimeType: tipo } : undefined);
      gravador.ondataavailable = (e) => {
        if (e.data.size) pedacos.current.push(e.data);
      };
      gravador.onstop = () => {
        const blob = new Blob(pedacos.current, { type: gravador.mimeType || tipo || 'audio/webm' });
        gravacao.current = blob;
        setUrlGravacao(URL.createObjectURL(blob));
        void transcrever();
      };
      gravador.start(1000);

      sessao.current = { gravador, fluxos, ctx, fala: null };
      sessao.current.fala = iniciarPrevia();
      setFase('gravando');
    } catch (e) {
      fluxos.forEach((f) => f.getTracks().forEach((t) => t.stop()));
      setErro(mensagemDeMidia(e));
    }
  }

  function parar() {
    const s = sessao.current;
    sessao.current = null;
    setParcial('');
    setFase('transcrevendo');
    setProgresso('Finalizando a gravação…');
    encerrar(s, false); // o onstop do gravador segue para a transcrição
  }

  async function transcrever() {
    const blob = gravacao.current;
    if (!blob) return;
    const doNavegador = previaRef.current.trim();
    setErro(null);
    setFase('transcrevendo');
    setProgresso('Preparando o áudio…');

    const e = await consultarTranscricao();
    if (!e.disponivel) {
      // Sem transcritor, o texto do navegador é o que existe — e é fala real.
      if (doNavegador.length >= 20) {
        setProgresso(null);
        aoTranscrever(doNavegador);
        return;
      }
      setProgresso(null);
      setFase('falhou');
      setErro(e.erro ?? 'Transcrição de áudio indisponível.');
      return;
    }

    try {
      const r = await transcreverArquivo(blob, `gravacao.${extensaoDe(blob.type)}`, {
        cache: cache.current,
        aoProgresso: (feitos, total) => setProgresso(textoProgresso(feitos, total)),
      });
      setProgresso('Transcrição pronta. Analisando…');
      aoTranscrever(r.texto);
    } catch (err) {
      setProgresso(null);
      setFase('falhou');
      setErro(err instanceof Error ? err.message : 'Não foi possível transcrever a gravação.');
    }
  }

  if (suporte === null) return null;

  if (!suporte.gravar) {
    return (
      <Aviso
        icone={<Mic size={17} />}
        titulo="Este navegador não grava áudio"
        corpo="A gravação usa o microfone pelo navegador, disponível no Chrome, no Edge, no Firefox e no Safari atuais. Grave a reunião em outro aplicativo e envie o arquivo na aba “Upload de áudio”."
      />
    );
  }

  const podeTranscrever = estado?.disponivel === true;
  const temFalaDoNavegador = obterConstrutor() !== null;

  return (
    <div className="space-y-3">
      {/* LGPD: consentimento antes de abrir o microfone, não depois. */}
      {fase === 'aviso' ? (
        <div className="rounded-md border border-warn/40 bg-warn-soft/25 px-4 py-3">
          <p className="text-[12.5px] font-semibold text-warn">Aviso de gravação</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-dim">
            A gravação capta o microfone deste dispositivo — e, se você escolher, o som da aba da
            reunião. Avise todos os participantes antes de começar: gravar alguém sem ciência é ilegal
            e destrói a confiança que o produto existe para medir. O áudio fica neste navegador enquanto
            grava; ao parar, é enviado em trechos ao transcritor e não fica armazenado no Benjamin. Só o
            texto segue, e ele é anonimizado antes da análise.
          </p>
          <button
            type="button"
            onClick={() => setFase('pronto')}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-warn/50 bg-surface px-3 py-1.5 text-[12px] font-medium text-warn transition-colors hover:bg-warn-soft"
          >
            <Check size={13} />
            Os participantes foram avisados
          </button>
        </div>
      ) : null}

      {fase === 'pronto' ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void iniciar()}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <Mic size={14} />
              Iniciar gravação
            </button>
            <span className="text-[11.5px] text-ink-faint">
              {estado === null
                ? null
                : podeTranscrever
                  ? 'Ao parar, a gravação é transcrita e a reunião é analisada sozinha.'
                  : temFalaDoNavegador
                    ? 'Sem transcritor configurado: vale o texto reconhecido pelo navegador.'
                    : 'Sem transcritor configurado: a gravação fica disponível para baixar.'}
            </span>
          </div>

          {suporte.aba ? (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-md border border-line bg-surface-2 px-3 py-2.5">
              <input
                type="checkbox"
                checked={incluirAba}
                onChange={(e) => setIncluirAba(e.target.checked)}
                className="mt-0.5 accent-accent"
              />
              <span>
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-ink">
                  <MonitorSpeaker size={13} className="text-ink-dim" />
                  Incluir o som da aba da reunião
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-dim">
                  Para Meet, Teams ou Zoom abertos no navegador. Com fone de ouvido, o microfone só
                  capta a sua voz — isto traz a dos outros participantes. O navegador vai pedir para
                  escolher a aba: marque “Compartilhar áudio da aba”.
                </span>
              </span>
            </label>
          ) : null}
        </>
      ) : null}

      {fase === 'gravando' ? (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={parar}
            className="inline-flex items-center gap-1.5 rounded-md bg-risk px-4 py-2 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            <Square size={13} />
            {podeTranscrever || temFalaDoNavegador ? 'Parar e analisar' : 'Parar gravação'}
          </button>
          <span className="inline-flex items-center gap-1.5 font-mono text-[12px] tabular-nums text-risk">
            <span className="size-2 animate-pulse rounded-full bg-risk" />
            {relogio(segundos)}
          </span>
          <span className="text-[11.5px] text-ink-faint">gravando — fale normalmente</span>
        </div>
      ) : null}

      {fase === 'transcrevendo' ? (
        <div className="flex items-center gap-2.5 rounded-md border border-accent/30 bg-accent-soft/20 px-3 py-2.5">
          <Loader2 size={15} className="shrink-0 animate-spin text-accent" />
          <div>
            <p className="text-[12.5px] font-medium text-ink">{progresso ?? 'Transcrevendo…'}</p>
            <p className="text-[11px] text-ink-faint">
              Não feche esta aba. A reunião é analisada assim que a transcrição terminar.
            </p>
          </div>
        </div>
      ) : null}

      {fase === 'gravando' && (previa || parcial) ? (
        <div className="rounded-md border border-dashed border-line px-3 py-2">
          <p className="mb-1 text-[10.5px] font-medium uppercase tracking-wide text-ink-faint">
            Prévia do navegador · o texto final sai da gravação
          </p>
          <p className="font-mono text-[12px] leading-relaxed text-ink-dim">
            {previa.slice(-360)}
            {parcial ? <span className="italic text-ink-faint"> {parcial}</span> : null}
          </p>
        </div>
      ) : null}

      {aviso ? (
        <p className="flex items-start gap-1.5 rounded-md border border-warn/30 bg-warn-soft/25 px-3 py-2 text-[12px] text-ink-dim">
          <TriangleAlert size={13} className="mt-0.5 shrink-0 text-warn" />
          {aviso}
        </p>
      ) : null}

      {erro ? <ErroLinha texto={erro} /> : null}

      {fase === 'falhou' ? (
        <div className="flex flex-wrap gap-2">
          {podeTranscrever ? (
            <BotaoSecundario onClick={() => void transcrever()} icone={<RotateCcw size={13} />}>
              Tentar transcrever de novo
            </BotaoSecundario>
          ) : null}
          {previaRef.current.trim().length >= 20 ? (
            <BotaoSecundario onClick={() => aoTranscrever(previaRef.current.trim())} icone={<AudioLines size={13} />}>
              Analisar com o texto do navegador
            </BotaoSecundario>
          ) : null}
          {urlGravacao ? (
            <a
              href={urlGravacao}
              download={`reuniao-${new Date().toISOString().slice(0, 10)}.${extensaoDe(gravacao.current?.type ?? '')}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-line-strong"
            >
              <Download size={13} />
              Baixar a gravação
            </a>
          ) : null}
          <BotaoSecundario onClick={() => setFase('pronto')} icone={<Mic size={13} />}>
            Gravar de novo
          </BotaoSecundario>
        </div>
      ) : null}

      {fase !== 'aviso' && estado ? <NotaFalantes estado={estado} /> : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Upload de áudio
 * ------------------------------------------------------------------ */

export function CapturaPorAudio({ aoTranscrever }: { aoTranscrever: (texto: string) => void }) {
  const estado = useEstadoTranscricao();
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ titulo: string; detalhe?: string; alternativas?: string[] } | null>(
    null,
  );
  const [progresso, setProgresso] = useState<string | null>(null);

  async function enviar(arquivo: File) {
    setEnviando(true);
    setErro(null);
    setProgresso(null);

    // Pergunta antes de decodificar uma hora de áudio para descobrir, no fim,
    // que não há chave de transcrição.
    const e = await consultarTranscricao();
    if (!e.disponivel) {
      setErro({
        titulo: e.erro ?? 'Transcrição indisponível.',
        ...(e.detalhe ? { detalhe: e.detalhe } : {}),
        ...(e.alternativas ? { alternativas: e.alternativas } : {}),
      });
      setEnviando(false);
      return;
    }

    try {
      setProgresso('Preparando o áudio…');
      const r = await transcreverArquivo(arquivo, arquivo.name, {
        aoProgresso: (feitos, total) => setProgresso(textoProgresso(feitos, total)),
      });
      setProgresso('Transcrição pronta. Analisando…');
      aoTranscrever(r.texto);
    } catch (err) {
      setErro({ titulo: err instanceof Error ? err.message : 'Não foi possível transcrever o áudio.' });
      setProgresso(null);
      setEnviando(false);
    }
  }

  return (
    <div className="space-y-3">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-8 text-center transition-colors ${
          enviando ? 'border-line bg-surface-2' : 'border-line hover:border-accent/50 hover:bg-surface-2'
        }`}
      >
        <input
          type="file"
          accept="audio/*,video/mp4,video/webm"
          className="sr-only"
          disabled={enviando}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void enviar(f);
            e.target.value = '';
          }}
        />
        <span className="mb-2 flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-ink-dim">
          {enviando ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
        </span>
        <span className="text-[12.5px] font-medium text-ink">
          {enviando ? (progresso ?? 'Transcrevendo…') : 'Escolher arquivo de áudio'}
        </span>
        <span className="mt-1 text-[11.5px] text-ink-faint">
          {enviando
            ? 'Não feche esta aba. A reunião é analisada assim que a transcrição terminar.'
            : 'mp3, m4a, wav, ogg, webm, mp4 ou mov · qualquer duração · a análise sai sozinha no fim'}
        </span>
      </label>

      {estado ? <NotaFalantes estado={estado} /> : null}

      {erro ? (
        <div className="rounded-md border border-risk/30 bg-risk-soft/20 px-3 py-2.5">
          <p className="flex items-start gap-1.5 text-[12px] font-medium text-risk">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            {erro.titulo}
          </p>
          {erro.detalhe ? (
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-dim">{erro.detalhe}</p>
          ) : null}
          {erro.alternativas ? (
            <ul className="mt-1.5 space-y-0.5">
              {erro.alternativas.map((a) => (
                <li key={a} className="flex gap-1.5 text-[11.5px] leading-relaxed text-ink-dim">
                  <span className="mt-[6px] size-1 shrink-0 rounded-full bg-ink-faint" />
                  {a}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * O que a transcrição entrega sobre QUEM falou — dito antes, não depois.
 *
 * Com o Gemini, cada fala sai com rótulo e o briefing fica completo. Com o
 * Whisper ou o reconhecimento do navegador, sai texto corrido, e metade do
 * briefing se abstém (medido sobre as 37 amostras do corpus).
 */
function NotaFalantes({ estado }: { estado: EstadoTranscricao }) {
  return (
    <>
      {estado.separa_falantes ? <FalantesPeloModelo /> : <SemRotuloDeFalante />}
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
        <AudioLines size={12} className="mt-0.5 shrink-0" />
        {estado.provedor === 'gemini'
          ? 'O áudio é transcrito pelo Google Gemini e não fica armazenado no Benjamin. Na camada gratuita, o Google pode usar o conteúdo enviado para melhorar os produtos dele — para reuniões com dado sensível de cliente, use uma chave com faturamento ativo.'
          : 'O áudio é enviado ao provedor de transcrição e não fica armazenado. Sem credencial configurada, o sistema mostra o erro real em vez de simular uma transcrição.'}
      </p>
    </>
  );
}

function FalantesPeloModelo() {
  return (
    <div className="rounded-md border border-health/30 bg-health-soft/20 px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-[12px] font-medium text-ink">
        <Users size={13} className="mt-0.5 shrink-0 text-health" />
        Quem falou é separado automaticamente
      </p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-dim">
        Cada fala sai com o nome de quem disse, quando o nome aparece na conversa, ou como Falante A,
        Falante B. Com isso o briefing sai completo: talk ratio, interesse e risco de churn inclusos. A
        separação é feita por IA a partir do áudio e pode trocar duas pessoas de lugar — dizer os
        nomes no começo da reunião ajuda.
      </p>
    </div>
  );
}

/**
 * Os números abaixo foram medidos sobre as 37 amostras do corpus, removendo os
 * rótulos de falante e comparando as duas análises — não são estimativa.
 */
function SemRotuloDeFalante() {
  return (
    <div className="rounded-md border border-warn/30 bg-warn-soft/30 px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-[12px] font-medium text-ink">
        <TriangleAlert size={13} className="mt-0.5 shrink-0 text-warn" />
        Esta transcrição não separa quem falou
      </p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-dim">
        Continuam saindo iguais: produtos, concorrentes, budget, objeções e tarefas.{' '}
        <strong className="font-medium text-ink">Ficam indisponíveis</strong> o talk ratio e as
        métricas de conversa, o interesse e o risco de churn — sem saber de quem é a fala, o motor
        não tem como atribuir os sinais, e prefere não responder a responder errado. As dores ainda
        aparecem, mas sem a garantia de que foi o cliente quem as disse.
      </p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-dim">
        Para recuperar tudo isso, configure a GEMINI_API_KEY (gratuita), que separa os falantes, ou
        cole o texto prefixando cada fala com o nome —{' '}
        <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[10.5px]">Ana:</code> e{' '}
        <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[10.5px]">João:</code>.
      </p>
    </div>
  );
}

function BotaoSecundario({
  onClick,
  icone,
  children,
}: {
  onClick: () => void;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-line-strong"
    >
      {icone}
      {children}
    </button>
  );
}

function Aviso({ icone, titulo, corpo }: { icone: React.ReactNode; titulo: string; corpo: string }) {
  return (
    <div className="rounded-md border border-dashed border-warn/40 bg-warn-soft/20 px-5 py-8 text-center">
      <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-warn/40 bg-surface text-warn">
        {icone}
      </div>
      <h3 className="text-[13px] font-semibold text-ink">{titulo}</h3>
      <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-ink-dim">{corpo}</p>
    </div>
  );
}

function ErroLinha({ texto }: { texto: string }) {
  return (
    <p className="inline-flex items-center gap-1.5 rounded-md border border-risk/30 bg-risk-soft/25 px-3 py-2 text-[12px] text-risk">
      <TriangleAlert size={13} />
      {texto}
    </p>
  );
}
