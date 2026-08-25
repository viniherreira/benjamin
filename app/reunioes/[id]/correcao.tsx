'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';

/**
 * IH + IA no ponto onde a decisão acontece.
 *
 * A IA propõe o item com a evidência; o vendedor confirma ou marca como
 * incorreto. Cada intervenção vira uma linha em `corrections` com o valor
 * anterior, e a taxa de correção por campo aparece na tela de Validação.
 *
 * A interface nunca diz "a IA decidiu". Ela mostra o que foi identificado, de
 * onde veio, e deixa a palavra final com quem está na conta.
 */

const ContextoAnalise = createContext<string | null>(null);

export function ProvedorCorrecao({
  analiseId,
  children,
}: {
  analiseId: string | null;
  children: ReactNode;
}) {
  return <ContextoAnalise.Provider value={analiseId}>{children}</ContextoAnalise.Provider>;
}

type Estado = 'inicial' | 'enviando' | 'confirmado' | 'corrigido' | 'erro';

export function ControleCorrecao({ campo, valor }: { campo: string; valor: unknown }) {
  const analiseId = useContext(ContextoAnalise);
  const [estado, setEstado] = useState<Estado>('inicial');

  // Sem análise gravada não há o que corrigir: o controle simplesmente não aparece.
  if (!analiseId) return null;

  async function registrar(acao: 'confirm' | 'remove') {
    setEstado('enviando');
    try {
      const r = await fetch('/api/corrections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          analysis_id: analiseId,
          field: campo,
          action: acao,
          before_value: valor,
          after_value: null,
        }),
      });
      setEstado(r.ok ? (acao === 'confirm' ? 'confirmado' : 'corrigido') : 'erro');
    } catch {
      setEstado('erro');
    }
  }

  if (estado === 'confirmado') {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded border border-health/40 bg-health-soft px-1.5 py-0.5 text-[10px] font-medium text-health"
        title="Você confirmou esta extração"
      >
        <Check size={10} />
        confirmado
      </span>
    );
  }

  if (estado === 'corrigido') {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded border border-warn/40 bg-warn-soft px-1.5 py-0.5 text-[10px] font-medium text-warn"
        title="Marcado como incorreto — a taxa de correção deste campo sobe na tela de Validação"
      >
        <X size={10} />
        marcado como incorreto
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1">
      <button
        type="button"
        disabled={estado === 'enviando'}
        onClick={(e) => {
          e.stopPropagation();
          void registrar('confirm');
        }}
        title="Confirmar esta extração"
        aria-label={`Confirmar ${campo}`}
        className="rounded p-0.5 text-ink-faint transition-colors hover:bg-health-soft hover:text-health disabled:opacity-50"
      >
        <Check size={12} />
      </button>
      <button
        type="button"
        disabled={estado === 'enviando'}
        onClick={(e) => {
          e.stopPropagation();
          void registrar('remove');
        }}
        title="Marcar como incorreto"
        aria-label={`Marcar ${campo} como incorreto`}
        className="rounded p-0.5 text-ink-faint transition-colors hover:bg-risk-soft hover:text-risk disabled:opacity-50"
      >
        <X size={12} />
      </button>
      {estado === 'erro' ? <span className="text-[10px] text-risk">falhou</span> : null}
    </span>
  );
}
