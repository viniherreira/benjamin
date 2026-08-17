import { Bell } from 'lucide-react';
import { Badge, EmptyState, PageHeader } from '@/components/ui';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Alertas' };

export default async function AlertasPage() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('alerts')
    .select('id, kind, severity, audience, title, message, value_at_stake, created_at')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(`Falha ao carregar alertas: ${error.message}`);

  const alertas = data ?? [];

  return (
    <>
      <PageHeader
        titulo="Alertas"
        descricao="O que exige ação agora, por severidade, tipo e público — com a evidência que originou cada alerta e o valor em risco."
      />

      {alertas.length === 0 ? (
        <EmptyState
          icone={<Bell size={18} />}
          titulo="Nenhum alerta aberto"
          descricao="Os alertas nascem da análise: risco de churn acima de 67, concorrente ativo na conversa, budget declarado, prazo estourado e desvio de talk ratio. Cada um traz a citação da transcrição e o R$ em jogo."
        />
      ) : (
        <ul className="space-y-2">
          {alertas.map((a) => (
            <li key={a.id} className="rounded-lg border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tom={a.severity === 'alta' ? 'risk' : a.severity === 'media' ? 'warn' : 'neutro'}>
                  {a.severity}
                </Badge>
                <Badge tom="neutro">{a.kind}</Badge>
                <Badge tom="accent">{a.audience}</Badge>
              </div>
              <h3 className="mt-2 text-[13px] font-semibold text-ink">{a.title}</h3>
              <p className="mt-1 text-[12px] text-ink-dim">{a.message}</p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
