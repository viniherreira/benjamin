import type { ReactNode } from 'react';
import type { Tom } from './ui';

/* ------------------------------------------------------------------ *
 * Peças visuais das telas de cliente.
 *
 * Tudo aqui é renderizado no servidor: os gráficos são SVG inline, sem
 * biblioteca e sem hidratação. Um sparkline não justifica mandar um runtime de
 * gráficos para o navegador.
 * ------------------------------------------------------------------ */

export function tomHealth(band: string): Tom {
  return band === 'alto' ? 'health' : band === 'baixo' ? 'risk' : 'warn';
}

export function tomInteresse(valor: number): Tom {
  return valor >= 60 ? 'health' : valor >= 40 ? 'warn' : 'risk';
}

export function tomChurn(valor: number): Tom {
  return valor >= 67 ? 'risk' : valor >= 34 ? 'warn' : 'health';
}

const CLASSE_TRACO: Record<Tom, string> = {
  neutro: 'stroke-ink-faint',
  accent: 'stroke-accent',
  ai: 'stroke-ai',
  health: 'stroke-health',
  warn: 'stroke-warn',
  risk: 'stroke-risk',
};

const CLASSE_PREENCHE: Record<Tom, string> = {
  neutro: 'fill-ink-faint',
  accent: 'fill-accent',
  ai: 'fill-ai',
  health: 'fill-health',
  warn: 'fill-warn',
  risk: 'fill-risk',
};

/**
 * Série de valores 0–100 ao longo das reuniões.
 * Com um ponto só não há linha — mostra o ponto e diz que falta série.
 */
export function Sparkline({
  valores,
  tom = 'accent',
  largura = 240,
  altura = 44,
  rotulo,
}: {
  valores: number[];
  tom?: Tom;
  largura?: number;
  altura?: number;
  rotulo?: string;
}) {
  if (valores.length === 0) {
    return <p className="text-[11px] text-ink-faint">Sem série ainda.</p>;
  }

  const pad = 4;
  const w = largura - pad * 2;
  const h = altura - pad * 2;
  const n = valores.length;

  const x = (i: number) => pad + (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const y = (v: number) => pad + h - (Math.max(0, Math.min(100, v)) / 100) * h;

  const pontos = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${largura} ${altura}`}
      className="h-11 w-full"
      role="img"
      aria-label={rotulo ?? `Evolução: ${valores.join(', ')}`}
      preserveAspectRatio="none"
    >
      {/* Linha de referência em 50 */}
      <line
        x1={pad}
        x2={largura - pad}
        y1={y(50)}
        y2={y(50)}
        className="stroke-line"
        strokeWidth="1"
        strokeDasharray="3 3"
      />
      {n > 1 ? (
        <polyline
          points={pontos}
          fill="none"
          className={CLASSE_TRACO[tom]}
          strokeWidth="1.8"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      {valores.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === n - 1 ? 3 : 2} className={CLASSE_PREENCHE[tom]} />
      ))}
    </svg>
  );
}

/** Score grande com barra — usado no health e nos indicadores da conta. */
export function Medidor({
  valor,
  tom,
  rotulo,
  sufixo = '/100',
}: {
  valor: number;
  tom: Tom;
  rotulo?: string;
  sufixo?: string;
}) {
  const cor: Record<Tom, string> = {
    neutro: 'bg-ink-faint',
    accent: 'bg-accent',
    ai: 'bg-ai',
    health: 'bg-health',
    warn: 'bg-warn',
    risk: 'bg-risk',
  };
  const texto: Record<Tom, string> = {
    neutro: 'text-ink-dim',
    accent: 'text-accent',
    ai: 'text-ai',
    health: 'text-health',
    warn: 'text-warn',
    risk: 'text-risk',
  };

  return (
    <div>
      {rotulo ? (
        <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">{rotulo}</p>
      ) : null}
      <div className="mt-1 flex items-baseline gap-1">
        <span className={`font-mono text-4xl tabular-nums ${texto[tom]}`}>{valor}</span>
        <span className="text-[12px] text-ink-faint">{sufixo}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className={`h-full rounded-full ${cor[tom]}`}
          style={{ width: `${Math.max(0, Math.min(100, valor))}%` }}
        />
      </div>
    </div>
  );
}

/** Lista de fatores que compõem um score, com a contribuição de cada um. */
export function ListaFatores({
  fatores,
}: {
  fatores: { label: string; delta: number; detalhe?: string }[];
}) {
  if (fatores.length === 0) {
    return <p className="text-[11px] text-ink-faint">Sem fatores registrados.</p>;
  }
  return (
    <ul className="space-y-1.5">
      {fatores.map((f, i) => (
        <li key={`${f.label}-${i}`} className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] leading-snug text-ink-dim">{f.label}</p>
            {f.detalhe ? <p className="text-[11px] text-ink-faint">{f.detalhe}</p> : null}
          </div>
          <span className="shrink-0 font-mono text-[12px] tabular-nums text-ink">
            {f.delta >= 0 ? '+' : ''}
            {f.delta}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Rotulo({ children }: { children: ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{children}</p>
  );
}
