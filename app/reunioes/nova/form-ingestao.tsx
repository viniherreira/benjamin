'use client';

import { useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  AudioLines,
  Check,
  ClipboardPaste,
  Loader2,
  Mic,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { EXEMPLO_CANONICO } from '@/lib/analysis/exemplo-canonico';

type Aba = 'texto' | 'audio' | 'vivo';

const TIPOS: { valor: string; rotulo: string }[] = [
  { valor: 'descoberta', rotulo: 'Descoberta' },
  { valor: 'primeiro_contato', rotulo: 'Primeiro contato' },
  { valor: 'demonstracao', rotulo: 'Demonstração' },
  { valor: 'negociacao', rotulo: 'Negociação' },
  { valor: 'proposta', rotulo: 'Proposta' },
  { valor: 'follow_up', rotulo: 'Follow-up' },
  { valor: 'customer_success', rotulo: 'Customer Success' },
  { valor: 'renovacao', rotulo: 'Renovação' },
  { valor: 'reuniao', rotulo: 'Reunião' },
];

// As etapas nomeadas são os estágios reais do pipeline do motor (spec 7.2).
const ETAPAS = ['Normalizando', 'Diarizando', 'Anonimizando', 'Analisando', 'Consolidando memória'];

const hoje = () => new Date().toISOString().slice(0, 10);

const CAMPO =
  'w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none';
const ROTULO = 'mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-faint';

export function FormIngestao() {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>('texto');

  const [titulo, setTitulo] = useState('');
  const [cliente, setCliente] = useState('');
  const [tipo, setTipo] = useState('descoberta');
  const [data, setData] = useState(hoje());
  const [texto, setTexto] = useState('');

  const [enviando, setEnviando] = useState(false);
  const [etapa, setEtapa] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const palavras = texto.trim() ? texto.trim().split(/\s+/).length : 0;

  function carregarExemplo() {
    setTexto(EXEMPLO_CANONICO);
    setCliente('João Silva');
    setTipo('descoberta');
    if (!titulo.trim()) setTitulo('Exemplo canônico TOTVS');
    setErro(null);
  }

  function pararTimer() {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }

  async function analisar() {
    setErro(null);
    if (texto.trim().length < 20) {
      setErro('Cole uma transcrição com ao menos 20 caracteres.');
      return;
    }

    const tituloFinal =
      titulo.trim() ||
      (cliente.trim()
        ? `${cliente.trim()} — ${TIPOS.find((t) => t.valor === tipo)?.rotulo ?? 'Reunião'}`
        : `Reunião ${data}`);

    setEnviando(true);
    setEtapa(0);
    // Anima pelas etapas reais do pipeline enquanto o servidor processa.
    timer.current = setInterval(() => {
      setEtapa((e) => Math.min(e + 1, ETAPAS.length - 1));
    }, 320);

    try {
      const resp = await fetch('/api/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo: tituloFinal,
          tipo,
          data,
          clienteNome: cliente.trim() || undefined,
          texto,
        }),
      });
      const corpo = (await resp.json().catch(() => ({}))) as { id?: string; erro?: string };

      if (!resp.ok || !corpo.id) {
        pararTimer();
        setEnviando(false);
        setErro(corpo.erro ?? `Falha na análise (HTTP ${resp.status}).`);
        return;
      }

      setEtapa(ETAPAS.length - 1);
      pararTimer();
      router.push(`/reunioes/${corpo.id}`);
    } catch {
      pararTimer();
      setEnviando(false);
      setErro('Não foi possível falar com o servidor. Verifique a conexão e tente de novo.');
    }
  }

  return (
    <div className="rounded-lg border border-line bg-surface shadow-panel">
      {/* Abas */}
      <div className="flex items-center gap-1 border-b border-line px-2 pt-2">
        <BotaoAba ativo={aba === 'texto'} onClick={() => setAba('texto')} icone={<ClipboardPaste size={14} />}>
          Colar texto
        </BotaoAba>
        <BotaoAba ativo={aba === 'audio'} onClick={() => setAba('audio')} icone={<AudioLines size={14} />} beta>
          Upload de áudio
        </BotaoAba>
        <BotaoAba ativo={aba === 'vivo'} onClick={() => setAba('vivo')} icone={<Mic size={14} />} beta>
          Gravar ao vivo
        </BotaoAba>
      </div>

      <div className="p-4">
        {aba === 'texto' ? (
          enviando ? (
            <Progresso etapa={etapa} />
          ) : (
            <div className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={ROTULO} htmlFor="titulo">
                    Título
                  </label>
                  <input
                    id="titulo"
                    className={CAMPO}
                    placeholder="Ex.: Descoberta com João Silva"
                    value={titulo}
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>
                <div>
                  <label className={ROTULO} htmlFor="cliente">
                    Cliente <span className="normal-case text-ink-faint">(opcional)</span>
                  </label>
                  <input
                    id="cliente"
                    className={CAMPO}
                    placeholder="Ex.: João Silva"
                    value={cliente}
                    onChange={(e) => setCliente(e.target.value)}
                  />
                </div>
                <div>
                  <label className={ROTULO} htmlFor="tipo">
                    Tipo de reunião
                  </label>
                  <select id="tipo" className={CAMPO} value={tipo} onChange={(e) => setTipo(e.target.value)}>
                    {TIPOS.map((t) => (
                      <option key={t.valor} value={t.valor}>
                        {t.rotulo}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={ROTULO} htmlFor="data">
                    Data
                  </label>
                  <input
                    id="data"
                    type="date"
                    className={CAMPO}
                    value={data}
                    onChange={(e) => setData(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <label className={ROTULO + ' mb-0'} htmlFor="texto">
                    Transcrição
                  </label>
                  <button
                    type="button"
                    onClick={carregarExemplo}
                    className="inline-flex items-center gap-1 rounded border border-ai/30 bg-ai-soft px-2 py-1 text-[11px] font-medium text-ai transition-colors hover:border-ai/60"
                  >
                    <Sparkles size={12} />
                    usar exemplo TOTVS
                  </button>
                </div>
                <textarea
                  id="texto"
                  className={CAMPO + ' min-h-[220px] resize-y font-mono text-[12.5px] leading-relaxed'}
                  placeholder="Cole aqui a transcrição bruta da reunião. Marcação de falante (Ana:, João:) melhora as métricas de conversa, mas não é obrigatória."
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                />
                <p className="mt-1 text-[11px] text-ink-faint">
                  {palavras > 0 ? `${palavras} palavras` : 'CPF, CNPJ, e-mail e telefone são anonimizados antes da análise.'}
                </p>
              </div>

              {erro ? (
                <div className="flex items-start gap-2 rounded-md border border-risk/30 bg-risk-soft/40 px-3 py-2 text-[12px] text-risk">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                  <span>{erro}</span>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] text-ink-faint">
                  O núcleo roda 100% em regras: análise determinística, custo de API R$ 0,00.
                </p>
                <button
                  type="button"
                  onClick={analisar}
                  className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
                >
                  <Sparkles size={14} />
                  Analisar reunião
                </button>
              </div>
            </div>
          )
        ) : (
          <BetaAdaptador aba={aba} />
        )}
      </div>
    </div>
  );
}

function BotaoAba({
  ativo,
  onClick,
  icone,
  beta,
  children,
}: {
  ativo: boolean;
  onClick: () => void;
  icone: ReactNode;
  beta?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-t-md border-b-2 px-3 py-2 text-[12.5px] font-medium transition-colors ${
        ativo
          ? 'border-accent text-ink'
          : 'border-transparent text-ink-dim hover:text-ink'
      }`}
    >
      {icone}
      {children}
      {beta ? (
        <span className="rounded bg-warn-soft px-1 py-px text-[9px] font-semibold uppercase text-warn">beta</span>
      ) : null}
    </button>
  );
}

function Progresso({ etapa }: { etapa: number }) {
  return (
    <div className="py-6">
      <div className="mx-auto max-w-md">
        <p className="mb-4 text-center text-[12px] text-ink-dim">
          O motor está processando a transcrição — cada etapa é um estágio real do pipeline.
        </p>
        <ol className="space-y-2">
          {ETAPAS.map((nome, i) => {
            const feito = i < etapa;
            const atual = i === etapa;
            return (
              <li
                key={nome}
                className={`flex items-center gap-2.5 rounded-md border px-3 py-2 text-[12.5px] transition-colors ${
                  atual
                    ? 'border-accent/40 bg-accent-soft/40 text-ink'
                    : feito
                      ? 'border-line bg-surface-2 text-ink-dim'
                      : 'border-line text-ink-faint'
                }`}
              >
                <span className="flex size-5 shrink-0 items-center justify-center">
                  {feito ? (
                    <Check size={14} className="text-health" />
                  ) : atual ? (
                    <Loader2 size={14} className="animate-spin text-accent" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-line-strong" />
                  )}
                </span>
                {nome}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function BetaAdaptador({ aba }: { aba: Aba }) {
  const vivo = aba === 'vivo';
  return (
    <div className="rounded-md border border-dashed border-warn/40 bg-warn-soft/20 px-5 py-8">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-warn/40 bg-surface text-warn">
          {vivo ? <Mic size={17} /> : <AudioLines size={17} />}
        </div>
        <h3 className="text-[13px] font-semibold text-ink">
          {vivo ? 'Captura ao vivo' : 'Upload de áudio'} — adaptador de entrada, chega na{' '}
          <span className="font-mono text-warn">Fase 7</span>
        </h3>
        <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-ink-dim">
          O núcleo do InsightIQ é agnóstico à origem do texto: {vivo ? 'a captura ao vivo (Web Speech API, pt-BR)' : 'o upload de áudio (adaptador STT plugável)'}{' '}
          só produz a transcrição, que segue exatamente o mesmo caminho de análise da aba “Colar texto”.
          {vivo ? ' A gravação exigirá aviso de consentimento antes de iniciar (LGPD).' : ' Sem credencial de STT, o sistema mostra o erro honesto em vez de simular.'}
        </p>
      </div>
    </div>
  );
}
