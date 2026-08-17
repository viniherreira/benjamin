import { Hammer } from 'lucide-react';

/**
 * Marcador temporário de fase de construção.
 *
 * Existe só durante o desenvolvimento faseado: diz com honestidade em que fase
 * a tela é construída e o que ela vai conter, em vez de mostrar um "em breve"
 * vazio ou um botão que não faz nada. Cada ocorrência é removida quando a fase
 * correspondente entrega a tela de verdade.
 */
export function PlaceholderFase({
  fase,
  conteudo,
}: {
  fase: number;
  conteudo: string[];
}) {
  return (
    <div className="rounded-lg border border-dashed border-warn/40 bg-warn-soft/30 px-6 py-10">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-warn/40 bg-surface text-warn">
          <Hammer size={17} />
        </div>
        <h3 className="text-[13px] font-semibold text-ink">
          Tela construída na{' '}
          <span className="font-mono text-warn">Fase {fase}</span>
        </h3>
        <p className="mt-1.5 text-[12px] text-ink-dim">
          A rota, a navegação e o layout já existem. O conteúdo abaixo entra quando a fase rodar:
        </p>
        <ul className="mt-4 space-y-1.5 text-left">
          {conteudo.map((linha) => (
            <li
              key={linha}
              className="flex gap-2 text-[12px] leading-relaxed text-ink-dim before:mt-[7px] before:size-1 before:shrink-0 before:rounded-full before:bg-warn"
            >
              {linha}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
