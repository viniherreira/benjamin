/**
 * Marca do InsightIQ.
 * A onda sonora da esquerda vira estrutura de dados à direita — é literalmente
 * o que o produto faz: conversa entra, dado estruturado sai.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="InsightIQ"
      className="shrink-0"
    >
      {/* onda: fala bruta */}
      <g stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round">
        <path d="M3 13v6" />
        <path d="M8 8.5v15" />
        <path d="M13 5v22" />
      </g>
      {/* transição: o sinal vira nó */}
      <g stroke="var(--ai)" strokeWidth="1.6" strokeLinecap="round" opacity="0.85">
        <path d="M17.5 10.5 24 7" />
        <path d="M17.5 10.5 23 17" />
        <path d="M23 17l3 6.5" />
      </g>
      {/* nós: dado estruturado */}
      <g fill="var(--ai)">
        <circle cx="17.5" cy="10.5" r="2.6" />
        <circle cx="24.6" cy="6.6" r="1.9" />
        <circle cx="23" cy="17" r="1.9" />
        <circle cx="26.4" cy="23.6" r="1.9" />
      </g>
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="text-[15px] font-semibold tracking-tight text-ink">
      Insight<span className="text-accent">IQ</span>
    </span>
  );
}
