import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ *
 * Primitivas de interface do InsightIQ.
 * Componentes próprios, sem UI kit. Densidade de terminal de operação.
 * ------------------------------------------------------------------ */

export type Tom = 'neutro' | 'accent' | 'ai' | 'health' | 'warn' | 'risk';

const TOM_TEXTO: Record<Tom, string> = {
  neutro: 'text-ink-dim',
  accent: 'text-accent',
  ai: 'text-ai',
  health: 'text-health',
  warn: 'text-warn',
  risk: 'text-risk',
};

const TOM_CHIP: Record<Tom, string> = {
  neutro: 'bg-surface-3 text-ink-dim border-line',
  accent: 'bg-accent-soft text-accent border-accent/30',
  ai: 'bg-ai-soft text-ai border-ai/30',
  health: 'bg-health-soft text-health border-health/30',
  warn: 'bg-warn-soft text-warn border-warn/30',
  risk: 'bg-risk-soft text-risk border-risk/30',
};

export function PageHeader({
  titulo,
  descricao,
  acoes,
}: {
  titulo: string;
  descricao?: string;
  acoes?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{titulo}</h1>
        {descricao ? (
          <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-ink-dim">{descricao}</p>
        ) : null}
      </div>
      {acoes ? <div className="flex shrink-0 items-center gap-2">{acoes}</div> : null}
    </header>
  );
}

export function Card({
  titulo,
  legenda,
  acoes,
  children,
  className = '',
}: {
  titulo?: string;
  legenda?: string;
  acoes?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-line bg-surface shadow-panel ${className}`}
    >
      {titulo ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold tracking-tight text-ink">{titulo}</h2>
            {legenda ? <p className="mt-0.5 text-[11px] text-ink-faint">{legenda}</p> : null}
          </div>
          {acoes ? <div className="shrink-0">{acoes}</div> : null}
        </div>
      ) : null}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Badge({
  tom = 'neutro',
  children,
}: {
  tom?: Tom;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-medium ${TOM_CHIP[tom]}`}
    >
      {children}
    </span>
  );
}

/** Números, scores, valores e trechos de transcrição sempre em mono. */
export function Mono({
  children,
  tom = 'neutro',
  className = '',
}: {
  children: ReactNode;
  tom?: Tom;
  className?: string;
}) {
  return (
    <span className={`font-mono tabular-nums ${TOM_TEXTO[tom]} ${className}`}>{children}</span>
  );
}

export function StatTile({
  rotulo,
  valor,
  detalhe,
  tom = 'neutro',
}: {
  rotulo: string;
  valor: string;
  detalhe?: string;
  tom?: Tom;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{rotulo}</p>
      <p className={`mt-2 font-mono text-2xl tabular-nums ${TOM_TEXTO[tom]}`}>{valor}</p>
      {detalhe ? <p className="mt-1 text-[11px] text-ink-faint">{detalhe}</p> : null}
    </div>
  );
}

/**
 * Estado vazio. Toda tela do InsightIQ tem um — a regra 10.5 proíbe tela sem
 * estado vazio desenhado. Ele explica o que vai aparecer ali e como fazer aparecer.
 */
export function EmptyState({
  icone,
  titulo,
  descricao,
  acao,
}: {
  icone: ReactNode;
  titulo: string;
  descricao: string;
  acao?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-line bg-surface/50 px-6 py-14 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-faint">
        {icone}
      </div>
      <h3 className="text-[13px] font-semibold text-ink">{titulo}</h3>
      <p className="mt-1.5 max-w-md text-[12px] leading-relaxed text-ink-dim">{descricao}</p>
      {acao ? <div className="mt-4">{acao}</div> : null}
    </div>
  );
}

export function BotaoLink({
  href,
  children,
  variante = 'secundario',
}: {
  href: string;
  children: ReactNode;
  variante?: 'primario' | 'secundario';
}) {
  const base =
    'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors';
  const estilo =
    variante === 'primario'
      ? 'bg-accent text-canvas hover:opacity-90'
      : 'border border-line bg-surface-2 text-ink hover:border-line-strong';
  return (
    <a href={href} className={`${base} ${estilo}`}>
      {children}
    </a>
  );
}
