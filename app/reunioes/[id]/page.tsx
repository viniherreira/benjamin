import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Cpu, ShieldAlert, Timer, TriangleAlert } from 'lucide-react';
import { Badge, PageHeader } from '@/components/ui';
import { carregarBriefing } from '@/lib/supabase/persistencia';
import { Briefing } from './briefing';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Briefing' };

const TIPO_LABEL: Record<string, string> = {
  primeiro_contato: 'Primeiro contato',
  descoberta: 'Descoberta',
  demonstracao: 'Demonstração',
  negociacao: 'Negociação',
  proposta: 'Proposta',
  follow_up: 'Follow-up',
  customer_success: 'Customer Success',
  renovacao: 'Renovação',
  reuniao: 'Reunião',
};

const MOTOR_LABEL: Record<string, string> = { rules: 'regras', hybrid: 'híbrido', llm: 'LLM' };

export default async function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const dados = await carregarBriefing(id);
  if (!dados) notFound();

  const { reuniao, analise, transcricao } = dados;

  const metaLinha = [
    reuniao.cliente,
    TIPO_LABEL[reuniao.meeting_type] ?? reuniao.meeting_type,
    new Date(`${reuniao.meeting_date}T00:00:00`).toLocaleDateString('pt-BR'),
    reuniao.duration_min ? `~${reuniao.duration_min} min` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const avisos = analise?.transcript_quality.warnings ?? [];

  return (
    <>
      <Link
        href="/reunioes"
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-ink-dim transition-colors hover:text-ink"
      >
        <ArrowLeft size={13} />
        Reuniões
      </Link>

      <PageHeader
        titulo={reuniao.title}
        descricao={metaLinha}
        acoes={
          analise ? (
            <div className="flex items-center gap-2">
              <Badge tom="ai">
                <Cpu size={11} />
                motor: {MOTOR_LABEL[analise.engine] ?? analise.engine}
              </Badge>
              <Badge tom="neutro">
                <Timer size={11} />
                {analise.latency_ms} ms
              </Badge>
            </div>
          ) : null
        }
      />

      {analise ? (
        <>
          {avisos.length > 0 ? (
            <div className="mb-4 rounded-lg border border-warn/30 bg-warn-soft/25 px-4 py-3">
              <p className="flex items-center gap-1.5 text-[12px] font-semibold text-warn">
                <ShieldAlert size={14} />
                Qualidade do dado — trate as extrações com cautela
              </p>
              <ul className="mt-1.5 space-y-1">
                {avisos.map((a, i) => (
                  <li key={i} className="flex gap-1.5 text-[11.5px] leading-relaxed text-ink-dim">
                    <span className="mt-[6px] size-1 shrink-0 rounded-full bg-warn" />
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <Briefing transcricao={transcricao} analise={analise} />
        </>
      ) : (
        <div className="rounded-lg border border-risk/30 bg-risk-soft/25 px-6 py-10 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-risk/40 bg-surface text-risk">
            <TriangleAlert size={18} />
          </div>
          <h3 className="text-[13px] font-semibold text-ink">Esta reunião não tem análise disponível</h3>
          <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-ink-dim">
            O status é <span className="font-mono text-risk">{reuniao.status}</span>. A análise pode ter
            falhado durante a ingestão. Tente enviar a transcrição novamente.
          </p>
          <Link
            href="/reunioes/nova"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-semibold text-canvas hover:opacity-90"
          >
            Nova análise
          </Link>
        </div>
      )}
    </>
  );
}
