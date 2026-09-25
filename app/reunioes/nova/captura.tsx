'use client';

import { useEffect, useRef, useState } from 'react';
import { AudioLines, Check, Loader2, Mic, Square, TriangleAlert, Upload } from 'lucide-react';
import { transcreverArquivo } from '@/lib/lote/transcrever';

/**
 * Adaptadores de entrada.
 *
 * A decisão de arquitetura do produto: o núcleo consome TEXTO, e a captação é
 * plugável. Estes dois componentes só produzem o texto — ele cai no mesmo campo
 * da aba "Colar texto" e segue exatamente o mesmo caminho de análise. É por isso
 * que dá para dizer, sem asterisco, que o Benjamin é agnóstico à origem.
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

      {/*
        O aviso daqui era mais curto e falava só das métricas de conversa. Desde
        que interesse e churn passaram a se abster sem diarização, o custo é
        maior do que ele dizia — e é o mesmo custo da aba de áudio, então os
        dois passam a dizer a mesma coisa.
      */}
      {consentiu ? <SemRotuloDeFalante /> : null}
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
  const [progresso, setProgresso] = useState<string | null>(null);

  async function enviar(arquivo: File) {
    setEnviando(true);
    setErro(null);
    setOk(null);
    setProgresso(null);

    try {
      // Pergunta antes de decodificar uma hora de áudio para descobrir, no fim,
      // que não há chave de transcrição.
      const estado = (await fetch('/api/transcribe').then((r) => r.json()).catch(() => null)) as {
        disponivel?: boolean;
        erro?: string;
        detalhe?: string;
        alternativas?: string[];
      } | null;
      if (estado && !estado.disponivel) {
        setErro({
          titulo: estado.erro ?? 'Transcrição indisponível.',
          ...(estado.detalhe ? { detalhe: estado.detalhe } : {}),
          ...(estado.alternativas ? { alternativas: estado.alternativas } : {}),
        });
        setEnviando(false);
        return;
      }

      setProgresso('Preparando o áudio…');
      const r = await transcreverArquivo(arquivo, arquivo.name, {
        aoProgresso: (feitos, total) =>
          setProgresso(total > 1 ? `Transcrevendo trecho ${Math.min(feitos + 1, total)} de ${total}…` : 'Transcrevendo…'),
      });
      onTexto(r.texto);
      const minutos = r.duracaoSegundos ? ` (${Math.round(r.duracaoSegundos / 60)} min, ${r.trechos} trechos)` : '';
      setOk(`${arquivo.name} transcrito${minutos}. Revise o texto na aba “Colar texto” antes de analisar.`);
    } catch (e) {
      setErro({ titulo: e instanceof Error ? e.message : 'Não foi possível transcrever o áudio.' });
    }
    setProgresso(null);
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
          {enviando ? (progresso ?? 'Transcrevendo…') : 'Escolher arquivo de áudio'}
        </span>
        <span className="mt-1 text-[11.5px] text-ink-faint">
          mp3, m4a, wav, ogg, webm, mp4 ou mov · qualquer duração (áudio longo é cortado em trechos)
        </span>
      </label>

      <SemRotuloDeFalante />

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

/**
 * O que a transcrição automática custa, dito antes e não depois.
 *
 * Nem o Whisper nem a Web Speech API separam quem falou: os dois devolvem um
 * bloco de texto corrido. Metade do briefing depende de saber de quem é cada
 * frase, e sem isso o motor se abstém em vez de chutar.
 *
 * Os números abaixo foram medidos sobre as 37 amostras do corpus, removendo os
 * rótulos de falante e comparando as duas análises — não são estimativa.
 */
function SemRotuloDeFalante() {
  return (
    <div className="rounded-md border border-warn/30 bg-warn-soft/30 px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-[12px] font-medium text-ink">
        <TriangleAlert size={13} className="mt-0.5 shrink-0 text-warn" />
        A transcrição automática não separa quem falou
      </p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-dim">
        Continuam saindo iguais: produtos, concorrentes, budget, objeções e tarefas.{' '}
        <strong className="font-medium text-ink">Ficam indisponíveis</strong> o talk ratio e as
        métricas de conversa, o interesse e o risco de churn — sem saber de quem é a fala, o motor
        não tem como atribuir os sinais, e prefere não responder a responder errado. As dores ainda
        aparecem, mas sem a garantia de que foi o cliente quem as disse.
      </p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-dim">
        Para recuperar tudo isso, prefixe cada fala com o nome de quem fala no texto transcrito —{' '}
        <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[10.5px]">Ana:</code> e{' '}
        <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[10.5px]">João:</code> —
        antes de analisar. É o que Meet, Teams e Zoom já entregam quando a legenda é exportada por
        lá.
      </p>
    </div>
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
