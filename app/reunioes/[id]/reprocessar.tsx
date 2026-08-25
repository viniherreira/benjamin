'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, RefreshCw, TriangleAlert } from 'lucide-react';

/**
 * Relê a transcrição com a versão atual do motor.
 *
 * A transcrição não muda; o que muda é a leitura. Fica ao lado das exportações
 * porque é a mesma família de ação: operar sobre a análise já existente.
 */
export function BotaoReprocessar({ meetingId }: { meetingId: string }) {
  const router = useRouter();
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function reprocessar() {
    setRodando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/meetings/${meetingId}/analyze`, { method: 'POST' });
      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) {
        setErro(j.erro ?? `Falha ao reprocessar (HTTP ${r.status}).`);
        setRodando(false);
        return;
      }
      router.refresh();
      // O refresh é assíncrono; soltar o botão só depois evita duplo clique.
      setTimeout(() => setRodando(false), 600);
    } catch {
      setErro('Não foi possível falar com o servidor.');
      setRodando(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={reprocessar}
        disabled={rodando}
        title="Relê esta transcrição com a versão atual do motor"
        className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-60"
      >
        {rodando ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
        {rodando ? 'Reprocessando' : 'Reprocessar'}
      </button>
      {erro ? (
        <span className="inline-flex items-center gap-1 text-[11px] text-risk">
          <TriangleAlert size={11} />
          {erro}
        </span>
      ) : null}
    </span>
  );
}
