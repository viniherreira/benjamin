import type { ReactNode } from 'react';

/* ------------------------------------------------------------------ *
 * Primitivas de interface do Benjamin.
 *
 * Componentes próprios, sem UI kit. O material é um só — vidro sobre papel —
 * e está definido em um único lugar (`.vidro`, no globals.css). Nenhuma
 * primitiva daqui redefine sombra, blur ou borda por conta própria: quando o
 * material muda, muda em todas as telas de uma vez.
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
  neutro: 'bg-surface-2 text-ink-dim border-line',
  accent: 'bg-accent-soft text-accent border-accent/25',
  ai: 'bg-ai-soft text-ai border-ai/25',
  health: 'bg-health-soft text-health border-health/25',
  warn: 'bg-warn-soft text-warn border-line',
  risk: 'bg-risk-soft text-risk border-risk/25',
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
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4 border-b border-line pb-6">
      <div className="min-w-0">
        <h1 className="text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {titulo}
        </h1>
        {descricao ? (
          <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-ink-dim">{descricao}</p>
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
    <section className={`vidro overflow-hidden rounded-xl ${className}`}>
      {titulo ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
          <div className="min-w-0">
            <h2 className="text-[12.5px] font-semibold tracking-[-0.01em] text-ink">{titulo}</h2>
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
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${TOM_CHIP[tom]}`}
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

/**
 * Indicador. O número é o objeto — corpo grande, mono, tabular — e o rótulo
 * recua para caixa alta minúscula. Quem varre um painel lê os valores primeiro
 * e só depois descobre o que eles medem.
 */
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
    <div className="vidro vidro-hover rounded-xl p-4">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
        {rotulo}
      </p>
      <p className={`mt-2.5 font-mono text-[28px] leading-none tabular-nums ${TOM_TEXTO[tom]}`}>
        {valor}
      </p>
      {detalhe ? <p className="mt-2 text-[11px] leading-snug text-ink-faint">{detalhe}</p> : null}
    </div>
  );
}

/**
 * Estado vazio. Toda tela do Benjamin tem um — a regra 10.5 proíbe tela sem
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
    <div className="vidro-sutil flex flex-col items-center justify-center rounded-xl border border-dashed border-line-strong px-6 py-16 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-xl border border-line bg-accent-soft text-accent">
        {icone}
      </div>
      <h3 className="text-[13px] font-semibold text-ink">{titulo}</h3>
      <p className="mt-2 max-w-md text-[12px] leading-relaxed text-ink-dim">{descricao}</p>
      {acao ? <div className="mt-5">{acao}</div> : null}
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
    'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition-all duration-300';
  const estilo =
    variante === 'primario'
      ? 'bg-accent font-semibold text-canvas hover:shadow-glow'
      : 'border border-line bg-surface-2 text-ink hover:border-line-strong hover:text-accent';
  return (
    <a href={href} className={`${base} ${estilo}`}>
      {children}
    </a>
  );
}
