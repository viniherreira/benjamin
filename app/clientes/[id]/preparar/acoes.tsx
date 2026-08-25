'use client';

import { useState } from 'react';
import { Check, Copy, Printer } from 'lucide-react';

/**
 * O briefing pré-reunião existe para ser levado para fora da tela: colado no
 * CRM, mandado no chat ou impresso. Estes são os dois caminhos.
 */
export function AcoesPreparacao({ texto }: { texto: string }) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Clipboard bloqueado (contexto inseguro ou permissão negada): o usuário
      // ainda pode selecionar o texto na tela. Nada de erro silencioso.
      window.prompt('Copie o briefing abaixo:', texto);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={copiar}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-line-strong"
      >
        {copiado ? <Check size={13} className="text-health" /> : <Copy size={13} />}
        {copiado ? 'Copiado' : 'Copiar'}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-line-strong"
      >
        <Printer size={13} />
        Imprimir
      </button>
    </div>
  );
}
