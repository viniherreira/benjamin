'use client';

import { useId, useRef, useState, type ReactNode } from 'react';

/* ------------------------------------------------------------------ *
 * Abas.
 *
 * Existe porque o briefing tinha dezessete painéis de vidro empilhados numa
 * coluna só. O vidro precisa de espaço negativo para parecer material: com
 * dezessete arestas seguidas ele vira textura de fundo e o vendedor não sabe
 * onde olhar. As abas devolvem o espaço sem esconder nada — tudo continua a um
 * clique, e nenhuma extração saiu do produto.
 *
 * A aba ativa é marcada por sublinhado em tinta, não por pílula com fundo.
 * Pílula seria mais um retângulo dentro de um retângulo, que é exatamente o
 * problema que este componente veio resolver.
 *
 * Teclado segue o padrão ARIA de tablist: setas navegam, Home e End vão para as
 * pontas, e o foco acompanha a seleção.
 * ------------------------------------------------------------------ */

export type Aba = {
  id: string;
  rotulo: string;
  icone?: ReactNode;
  /** Aparece à direita do rótulo. Omitido quando é zero — contador vazio é ruído. */
  contador?: number;
  conteudo: ReactNode;
};

export function Abas({ abas, inicial }: { abas: Aba[]; inicial?: string }) {
  const base = useId();
  const [ativa, setAtiva] = useState(inicial ?? abas[0]?.id ?? '');
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  if (abas.length === 0) return null;

  const indice = Math.max(
    0,
    abas.findIndex((a) => a.id === ativa),
  );

  function irPara(i: number) {
    const alvo = abas[(i + abas.length) % abas.length];
    if (!alvo) return;
    setAtiva(alvo.id);
    refs.current[alvo.id]?.focus();
  }

  function aoTeclar(e: React.KeyboardEvent) {
    const mapa: Record<string, number> = {
      ArrowRight: indice + 1,
      ArrowLeft: indice - 1,
      Home: 0,
      End: abas.length - 1,
    };
    const destino = mapa[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    irPara(destino);
  }

  const atual = abas[indice];

  return (
    <section className="vidro overflow-hidden rounded-xl">
      {/*
        No telefone as quatro abas não cabem e a faixa rola. Sem sinal disso, a
        última aba fica cortada parecendo defeito de layout; a máscara esfuma a
        borda direita e diz que há mais conteúdo — sem gastar uma seta que
        ocuparia o espaço de meia aba.
      */}
      <div
        role="tablist"
        aria-label="Seções do briefing"
        onKeyDown={aoTeclar}
        className="flex gap-1 overflow-x-auto border-b border-line px-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,#000_calc(100%-2rem),transparent)] sm:[mask-image:none]"
      >
        {abas.map((a) => {
          const selecionada = a.id === ativa;
          return (
            <button
              key={a.id}
              ref={(el) => {
                refs.current[a.id] = el;
              }}
              role="tab"
              id={`${base}-tab-${a.id}`}
              aria-selected={selecionada}
              aria-controls={`${base}-painel-${a.id}`}
              tabIndex={selecionada ? 0 : -1}
              onClick={() => setAtiva(a.id)}
              className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-3 py-2.5 text-[12.5px] font-medium transition-colors duration-200 ${
                selecionada ? 'text-ink' : 'text-ink-faint hover:text-ink-dim'
              }`}
            >
              {a.icone ? <span aria-hidden>{a.icone}</span> : null}
              {a.rotulo}
              {a.contador ? (
                <span className="font-mono text-[11px] text-ink-faint">{a.contador}</span>
              ) : null}
              {/*
                O sublinhado é um irmão absoluto em vez de `border-bottom` para
                cobrir o hairline do tablist sem empurrar o texto meio pixel
                quando a aba muda.
              */}
              <span
                aria-hidden
                className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent transition-opacity duration-200 ${
                  selecionada ? 'opacity-100' : 'opacity-0'
                }`}
              />
            </button>
          );
        })}
      </div>

      {atual ? (
        <div
          role="tabpanel"
          id={`${base}-painel-${atual.id}`}
          aria-labelledby={`${base}-tab-${atual.id}`}
          tabIndex={0}
          className="p-4 focus-visible:outline-none"
        >
          {atual.conteudo}
        </div>
      ) : null}
    </section>
  );
}
