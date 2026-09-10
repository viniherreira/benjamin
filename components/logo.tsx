'use client';

import { useId } from 'react';

/**
 * Marca do Benjamin.
 *
 * O símbolo é uma ficha âmbar com a onda vazada: a fala entra como três traços
 * de amplitude e sai como um ponto único — conversa vira dado. É a mesma ideia
 * da marca anterior, dita com quatro formas em vez de doze.
 *
 * A ficha carrega a própria cor em vez de ler o token de tema, porque marca que
 * muda de cor conforme o fundo deixa de ser marca. É o único lugar do sistema
 * onde o âmbar incandescente aparece sozinho, e por isso ele brilha.
 *
 * O id do gradiente vem do `useId` e não de uma constante. A marca é renderizada
 * duas vezes ao mesmo tempo — barra lateral e cabeçalho do mobile coexistem no
 * DOM, cada uma escondida na largura da outra — e com id fixo o segundo SVG
 * aponta para um gradiente que mora dentro de um `display:none`. O Chrome não
 * pinta esse gradiente, e no celular a ficha some: logo invisível, wordmark
 * órfão. Id único por instância resolve na raiz.
 */
export function Logo({ size = 28 }: { size?: number }) {
  const gradiente = `bj-ficha-${useId()}`;

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
      <defs>
        <linearGradient id={gradiente} x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFB37A" />
          <stop offset="0.55" stopColor="#FF8A3D" />
          <stop offset="1" stopColor="#F26D1B" />
        </linearGradient>
      </defs>

      <rect x="1" y="1" width="30" height="30" rx="9" fill={`url(#${gradiente})`} />
      {/* aresta superior clara: o mesmo brilho interno que define o vidro */}
      <rect
        x="1.5"
        y="1.5"
        width="29"
        height="29"
        rx="8.5"
        stroke="#FFFFFF"
        strokeOpacity="0.38"
        strokeWidth="1"
      />

      {/* onda vazada: amplitude decrescente até virar ponto */}
      <g stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" opacity="0.96">
        <path d="M9 10.5v11" />
        <path d="M14.5 13v6" />
        <path d="M20 14.75v2.5" />
      </g>
      <circle cx="24.5" cy="16" r="1.6" fill="#FFFFFF" />
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
