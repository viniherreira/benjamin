'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioLines, Check, Loader2, Mic, Square, TriangleAlert, Upload } from 'lucide-react';

/**
 * Adaptadores de entrada.
 *
 * A decisão de arquitetura do produto: o núcleo consome TEXTO, e a captação é
 * plugável. Estes dois componentes só produzem o texto — ele cai no mesmo campo
 * da aba "Colar texto" e segue exatamente o mesmo caminho de análise. É por isso
 * que dá para dizer, sem asterisco, que o InsightIQ é agnóstico à origem.
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

const ERRO_FALA: Record<string, string> = {
  'not-allowed': 'Permissão de microfone negada pelo navegador.',
  'service-not-allowed': 'O navegador bloqueou o serviço de reconhecimento de fala.',
  'no-speech': 'Nenhuma fala detectada. Verifique o microfone e tente de novo.',
  'audio-capture': 'Nenhum microfone encontrado.',
  network: 'O reconhecimento de fala precisa de conexão e ela falhou.',
  aborted: 'Captura interrompida.',
};

/* ------------------------------------------------------------------ *
 * Gravar ao vivo
 * ------------------------------------------------------------------ */

export function CapturaAoVivo({
  texto,
  onTexto,
}: {
  texto: string;
  onTexto: (t: string) => void;
}) {
  const [suportado, setSuportado] = useState<boolean | null>(null);
  const [consentiu, setConsentiu] = useState(false);
  const [gravando, setGravando] = useState(false);
  const [parcial, setParcial] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const reconhecimento = useRef<Reconhecimento | null>(null);
  const baseRef = useRef('');

  useEffect(() => {
    setSuportado(obterConstrutor() !== null);
    return () => {
      // Não deixar o microfone aberto se a pessoa sair da tela gravando.
      reconhecimento.current?.stop();
    };
  }, []);

  function iniciar() {
    const Construtor = obterConstrutor();
    if (!Construtor) return;

    setErro(null);
    const r = new Construtor();
    r.lang = 'pt-BR';
    r.continuous = true;
    r.interimResults = true;
    baseRef.current = texto;

    r.onresult = (e) => {
      let finalizado = '';
      let emAndamento = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const item = e.results[i] as ItemResultado;
        if (item.isFinal) finalizado += item[0].transcript;
        else emAndamento += item[0].transcript;
      }
      if (finalizado) {
        baseRef.current = `${baseRef.current}${baseRef.current ? ' ' : ''}${finalizado.trim()}`;
        onTexto(baseRef.current);
      }
      setParcial(emAndamento);
    };

    r.onerror = (e) => {
      setErro(ERRO_FALA[e.error] ?? `Falha no reconhecimento de fala: ${e.error}.`);
      setGravando(false);
    };

    r.onend = () => {
      setGravando(false);
      setParcial('');
    };

    reconhecimento.current = r;
    try {
      r.start();
      setGravando(true);
    } catch {
      setErro('Não foi possível iniciar a captura.');
    }
  }

  function parar() {
    reconhecimento.current?.stop();
    setGravando(false);
    setParcial('');
  }

  if (suportado === null) return null;

  if (!suportado) {
    return (
      <Aviso
        icone={<Mic size={17} />}
        titulo="Este navegador não tem reconhecimento de fala"
        corpo="A captura ao vivo usa a Web Speech API, disponível no Chrome e no Edge. Sem ela, o sistema não simula uma transcrição: use a aba “Colar texto” ou grave a reunião e envie o áudio."
      />
    );
  }

  return (
    <div className="space-y-3">
      {/* LGPD: consentimento antes de abrir o microfone, não depois. */}
      {!consentiu ? (
        <div className="rounded-md border border-warn/40 bg-warn-soft/25 px-4 py-3">
          <p className="text-[12.5px] font-semibold text-warn">Aviso de gravação</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-dim">
            A captura transcreve a fala captada pelo microfone deste dispositivo. Avise todos os
            participantes antes de iniciar — gravar alguém sem ciência é ilegal e, além disso, destrói a
            confiança que o produto existe para medir. O áudio não é armazenado: apenas o texto
            reconhecido aparece abaixo, e ele é anonimizado antes da análise.
          </p>
          <button
            type="button"
            onClick={() => setConsentiu(true)}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-warn/50 bg-surface px-3 py-1.5 text-[12px] font-medium text-warn transition-colors hover:bg-warn-soft"
          >
            <Check size={13} />
            Os participantes foram avisados
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={gravando ? parar : iniciar}
            className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-[12.5px] font-semibold transition-opacity hover:opacity-90 ${
              gravando ? 'bg-risk text-canvas' : 'bg-accent text-canvas'
            }`}
          >
            {gravando ? <Square size={13} /> : <Mic size={14} />}
            {gravando ? 'Parar captura' : 'Iniciar captura'}
          </button>
          {gravando ? (
            <span className="inline-flex items-center gap-1.5 text-[11.5px] text-risk">
              <span className="size-2 animate-pulse rounded-full bg-risk" />
              ouvindo — fale normalmente
            </span>
          ) : (
            <span className="text-[11.5px] text-ink-faint">
              pt-BR · sem custo e sem chave de API · o texto continua editável
            </span>
          )}
        </div>
      )}

      {parcial ? (
        <p className="rounded-md border border-dashed border-accent/40 bg-accent-soft/20 px-3 py-2 font-mono text-[12px] italic leading-relaxed text-ink-dim">
          {parcial}
        </p>
      ) : null}

      {erro ? <ErroLinha texto={erro} /> : null}

      {consentiu ? (
        <p className="text-[11px] leading-relaxed text-ink-faint">
          O reconhecimento não separa quem falou. Sem marcação de falante, o briefing deixa as métricas
          de conversa em branco em vez de inventar turnos — se precisar de talk ratio, edite o texto no
          formato <span className="font-mono">Nome: fala</span> antes de analisar.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Upload de áudio
 * ------------------------------------------------------------------ */

export function CapturaPorAudio({ onTexto }: { onTexto: (t: string) => void }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ titulo: string; detalhe?: string; alternativas?: string[] } | null>(
    null,
  );
  const [ok, setOk] = useState<string | null>(null);

  async function enviar(arquivo: File) {
    setEnviando(true);
    setErro(null);
    setOk(null);

    try {
      const form = new FormData();
      form.append('audio', arquivo);
      const r = await fetch('/api/transcribe', { method: 'POST', body: form });
      const j = (await r.json().catch(() => ({}))) as {
        texto?: string;
        erro?: string;
        detalhe?: string;
        alternativas?: string[];
      };

      if (!r.ok || !j.texto) {
        setErro({
          titulo: j.erro ?? `Falha na transcrição (HTTP ${r.status}).`,
          ...(j.detalhe ? { detalhe: j.detalhe } : {}),
          ...(j.alternativas ? { alternativas: j.alternativas } : {}),
        });
        setEnviando(false);
        return;
      }

      onTexto(j.texto);
      setOk(`${arquivo.name} transcrito. Revise o texto na aba “Colar texto” antes de analisar.`);
    } catch {
      setErro({ titulo: 'Não foi possível falar com o servidor.' });
    }
    setEnviando(false);
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
          {enviando ? 'Transcrevendo…' : 'Escolher arquivo de áudio'}
        </span>
        <span className="mt-1 text-[11.5px] text-ink-faint">
          mp3, m4a, wav, webm ou ogg · até 25 MB
        </span>
      </label>

      {ok ? (
        <p className="inline-flex items-center gap-1.5 rounded-md border border-health/30 bg-health-soft/25 px-3 py-2 text-[12px] text-health">
          <Check size={13} />
          {ok}
        </p>
      ) : null}

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

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
        <AudioLines size={12} className="mt-0.5 shrink-0" />O áudio é enviado ao provedor de
        transcrição e não fica armazenado. Sem credencial de STT configurada, o sistema mostra o erro
        real em vez de simular uma transcrição — texto inventado aqui contaminaria todo o resto da
        análise.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

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
