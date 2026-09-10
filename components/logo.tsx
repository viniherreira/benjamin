/**
 * Marca do Benjamin.
 *
 * Uma ficha sólida com a onda vazada: a fala entra como três traços de
 * amplitude e sai como um ponto único — conversa vira dado.
 *
 * A ficha lê `--ink` e a onda lê `--canvas`, então ela inverte junto com o
 * tema. Antes a marca carregava a própria cor, o que fazia sentido enquanto era
 * âmbar: âmbar aparece nos dois fundos. Tinta não — ficha preta sobre canvas
 * preto é um buraco. Numa identidade monocromática a marca não pode ignorar o
 * tema, porque a tinta dela É o tema.
 *
 * Sem gradiente, some também o `id` de SVG que precisava ser único por
 * instância (a barra lateral e o cabeçalho do mobile coexistem no DOM). Quatro
 * formas chapadas não têm o que colidir, e o componente volta a ser renderizável
 * no servidor.
 */
export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      role="img"
      aria-label="Benjamin"
      className="shrink-0"
    >
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--ink)" />

      {/* onda vazada: amplitude decrescente até virar ponto */}
      <g stroke="var(--canvas)" strokeWidth="2.4" strokeLinecap="round">
        <path d="M9 10.5v11" />
        <path d="M14.5 13v6" />
        <path d="M20 14.75v2.5" />
      </g>
      <circle cx="24.5" cy="16" r="1.6" fill="var(--canvas)" />
    </svg>
  );
}

/**
 * O nome espaçado É a identidade — é o pedido central deste redesenho, não um
 * detalhe tipográfico. O tracking largo transforma oito letras em uma régua
 * horizontal, e por isso o wordmark nunca aparece em corpo grande: ele ocupa
 * largura, não altura.
 *
 * `aria-label` devolve a palavra inteira ao leitor de tela, que de outro modo
 * soletraria as letras uma a uma por causa do espaçamento.
 */
export function Wordmark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-label="Benjamin"
      className={`block text-[12.5px] font-medium uppercase leading-none tracking-[0.42em] text-ink ${className}`}
    >
      Benjamin
    </span>
  );
}
