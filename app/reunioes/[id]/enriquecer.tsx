'use client';

import { useState } from 'react';
import { Ban, Loader2, Quote, Sparkles, TriangleAlert } from 'lucide-react';
import type { Evidence } from '@/lib/analysis';
import { Badge, Mono } from '@/components/ui';

/**
 * Enriquecimento por LLM, ao lado do resumo determinístico — nunca no lugar dele.
 *
 * A separação visual é a mesma que existe no código: o que veio das regras tem
 * evidência obrigatória e move os números do produto; o que veio do modelo é
 * leitura adicional, marcada como gerada. Uma tela que misturasse os dois
 * destruiria a única garantia que o InsightIQ oferece.
 *
 * O que o modelo produziu e não pôde ser ancorado no texto aparece contado, não
 * escondido: é a medida da falibilidade dele, do mesmo jeito que a taxa de
 * correção humana mede a das regras.
 */

type ItemAncorado = { texto: string; evidence: Evidence };

type Enriquecimento = {
  resumo: string | null;
  nuance: ItemAncorado[];
  proxima_acao: ItemAncorado | null;
  descartados: { campo: string; texto: string; citacao: string }[];
  provider: string;
  model: string;
  latency_ms: number;
  tokens: { entrada: number; saida: number };
};

export function PainelEnriquecimento({
  meetingId,
  onSelecionar,
}: {
  meetingId: string;
  onSelecionar: (ev: Evidence | undefined) => void;
}) {
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<Enriquecimento | null>(null);

  async function enriquecer() {
    setRodando(true);
    setErro(null);
    try {
      const r = await fetch(`/api/meetings/${meetingId}/enrich`, { method: 'POST' });
      const j = (await r.json().catch(() => ({}))) as Partial<Enriquecimento> & { erro?: string };
      if (!r.ok) {
        setErro(j.erro ?? `Falha ao enriquecer (HTTP ${r.status}).`);
        return;
      }
      setDados(j as Enriquecimento);
    } catch {
      setErro('Não foi possível falar com o servidor.');
    } finally {
      setRodando(false);
    }
  }

  return (
    <section className="rounded-lg border border-ai/30 bg-ai-soft/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
            <Sparkles size={14} className="text-ai" />
            Leitura generativa
            <Badge tom="ai">opcional</Badge>
          </h3>
          <p className="mt-1 max-w-xl text-[11.5px] leading-relaxed text-ink-dim">
            O briefing acima é determinístico e não muda. Isto aqui é um segundo par de olhos:
            reescreve o resumo com fluência e aponta nuance que um léxico não pega. Cada observação
            só aparece se a citação que a sustenta existir literalmente na transcrição.
          </p>
        </div>

        <button
          type="button"
          onClick={enriquecer}
          disabled={rodando}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ai/40 bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ai transition-colors hover:border-ai disabled:opacity-60"
        >
          {rodando ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          {rodando ? 'Gerando' : dados ? 'Gerar de novo' : 'Enriquecer com IA'}
        </button>
      </div>

      {rodando ? (
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          A camada gratuita do provedor tem fila variável: medimos de 4,5 s a 25 s para a mesma
          reunião. O briefing determinístico ao lado levou milissegundos e já está pronto.
        </p>
      ) : null}

      {erro ? (
        <p className="mt-3 flex items-start gap-2 rounded-md border border-warn/30 bg-warn-soft/25 px-3 py-2 text-[11.5px] leading-relaxed text-ink-dim">
          <TriangleAlert size={13} className="mt-0.5 shrink-0 text-warn" />
          {erro}
        </p>
      ) : null}

      {dados ? (
        <div className="mt-4 space-y-3 border-t border-ai/20 pt-3">
          {dados.resumo ? (
            <div>
              <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
                Resumo gerado
              </p>
              <p className="text-[13px] leading-relaxed text-ink-dim">{dados.resumo}</p>
              <p className="mt-1.5 text-[10.5px] leading-relaxed text-ink-faint">
                Prosa gerada por modelo. Não é possível ancorar um texto corrido num trecho único,
                então ele fica aqui, rotulado, e não substitui o resumo extrativo acima.
              </p>
            </div>
          ) : null}

          {dados.nuance.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
                Nuance
              </p>
              <ul className="space-y-2">
                {dados.nuance.map((n) => (
                  <li key={n.evidence.start}>
                    <p className="text-[12.5px] leading-relaxed text-ink">{n.texto}</p>
                    <button
                      type="button"
                      onClick={() => onSelecionar(n.evidence)}
                      className="mt-0.5 flex w-full items-start gap-1.5 rounded border-l-2 border-ai/40 bg-surface-2/60 px-2 py-1 text-left text-[11px] italic leading-relaxed text-ink-dim transition-colors hover:border-ai hover:text-ink"
                    >
                      <Quote size={10} className="mt-0.5 shrink-0 text-ink-faint" />
                      {n.evidence.quote}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {dados.proxima_acao ? (
            <div>
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
                Próxima ação sugerida
              </p>
              <p className="text-[12.5px] leading-relaxed text-ink">{dados.proxima_acao.texto}</p>
              <button
                type="button"
                onClick={() => onSelecionar(dados.proxima_acao?.evidence)}
                className="mt-0.5 flex w-full items-start gap-1.5 rounded border-l-2 border-ai/40 bg-surface-2/60 px-2 py-1 text-left text-[11px] italic leading-relaxed text-ink-dim transition-colors hover:border-ai hover:text-ink"
              >
                <Quote size={10} className="mt-0.5 shrink-0 text-ink-faint" />
                {dados.proxima_acao.evidence.quote}
              </button>
            </div>
          ) : null}

          {dados.descartados.length > 0 ? (
            <div className="rounded-md border border-warn/30 bg-warn-soft/20 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-warn">
                <Ban size={12} />
                {dados.descartados.length} observação(ões) recusada(s)
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-ink-dim">
                O modelo produziu, mas a citação apresentada não existe na transcrição. Foram
                descartadas antes de chegar à tela — é a regra de evidência aplicada ao LLM.
              </p>
            </div>
          ) : null}

          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-ai/20 pt-2 text-[10.5px] text-ink-faint">
            <span>
              motor <Mono tom="ai">{dados.model}</Mono>
            </span>
            <span>
              <Mono>{dados.latency_ms}</Mono> ms
            </span>
            <span>
              <Mono>{dados.tokens.entrada}</Mono> tokens de entrada ·{' '}
              <Mono>{dados.tokens.saida}</Mono> de saída
            </span>
            <span>o briefing determinístico rodou em milissegundos e custou R$ 0,00</span>
          </p>
        </div>
      ) : null}
    </section>
  );
}
