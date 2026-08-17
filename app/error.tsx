'use client';

import { TriangleAlert } from 'lucide-react';

/**
 * Erro honesto. A regra 10.5 proíbe esconder falha atrás de tela vazia:
 * se o banco caiu ou o ambiente está mal configurado, a interface diz isso.
 */
export default function Erro({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-risk/40 bg-risk-soft/30 px-6 py-14 text-center">
      <div className="mb-3 flex size-10 items-center justify-center rounded-lg border border-risk/40 bg-surface text-risk">
        <TriangleAlert size={18} />
      </div>
      <h2 className="text-[13px] font-semibold text-ink">Algo falhou ao carregar esta tela</h2>
      <p className="mt-1.5 max-w-lg font-mono text-[11px] leading-relaxed text-ink-dim">
        {error.message}
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-line-strong"
      >
        Tentar de novo
      </button>
    </div>
  );
}
