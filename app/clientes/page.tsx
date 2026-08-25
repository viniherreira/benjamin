import Link from 'next/link';
import { Building2 } from 'lucide-react';
import { Badge, BotaoLink, EmptyState, Mono, PageHeader } from '@/components/ui';
import { tomHealth } from '@/components/cliente-ui';
import { supabaseServer } from '@/lib/supabase/server';
import { diasEntre } from '@/lib/memory';
import type { CustomerRow, MeetingRow } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Clientes' };

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const fmtBRL = (n: number | null) => (n == null ? '—' : BRL.format(n));

const ESTAGIO: Record<string, string> = {
  prospeccao: 'Prospecção',
  qualificacao: 'Qualificação',
  negociacao: 'Negociação',
  proposta: 'Proposta',
  fechado_ganho: 'Fechado ganho',
  fechado_perdido: 'Fechado perdido',
  base_ativa: 'Base ativa',
};

type Objecao = { categoria?: string; texto?: string; resolvida?: boolean };

export default async function ClientesPage() {
  const sb = supabaseServer();

  const [clientesRes, reunioesRes] = await Promise.all([
    sb
      .from('customers')
      .select(
        'id, name, segment, stage, health_score, health_band, open_objections, contract_value, upsell_potential',
      )
      .order('health_score', { ascending: true })
      .limit(100),
    sb.from('meetings').select('customer_id, meeting_date').limit(1000),
  ]);

  if (clientesRes.error) throw new Error(`Falha ao carregar clientes: ${clientesRes.error.message}`);
  if (reunioesRes.error) throw new Error(`Falha ao carregar reuniões: ${reunioesRes.error.message}`);

  const clientes = (clientesRes.data ?? []) as Pick<
    CustomerRow,
    | 'id'
    | 'name'
    | 'segment'
    | 'stage'
    | 'health_score'
    | 'health_band'
    | 'open_objections'
    | 'contract_value'
    | 'upsell_potential'
  >[];

  // Uma varredura só: contagem e último contato por cliente, sem N+1.
  const agregado = new Map<string, { total: number; ultima: string }>();
  for (const m of (reunioesRes.data ?? []) as Pick<MeetingRow, 'customer_id' | 'meeting_date'>[]) {
    if (!m.customer_id) continue;
    const atual = agregado.get(m.customer_id);
    if (atual) {
      atual.total++;
      if (m.meeting_date > atual.ultima) atual.ultima = m.meeting_date;
    } else {
      agregado.set(m.customer_id, { total: 1, ultima: m.meeting_date });
    }
  }

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descricao="A memória de cada conta: health score, estágio, objeções em aberto e valor de contrato."
        acoes={
          <BotaoLink href="/reunioes/nova" variante="primario">
            Analisar reunião
          </BotaoLink>
        }
      />

      {clientes.length === 0 ? (
        <EmptyState
          icone={<Building2 size={18} />}
          titulo="Nenhum cliente na base"
          descricao="Os clientes nascem da primeira reunião analisada. A lista traz health score colorido, estágio no funil, número de reuniões, último contato, objeções abertas e o valor de contrato de cada conta."
          acao={
            <BotaoLink href="/reunioes/nova" variante="primario">
              Analisar uma reunião
            </BotaoLink>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-[12.5px]">
            <thead className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Health</th>
                <th className="px-4 py-2.5 font-medium">Estágio</th>
                <th className="px-4 py-2.5 font-medium">Reuniões</th>
                <th className="px-4 py-2.5 font-medium">Último contato</th>
                <th className="px-4 py-2.5 font-medium">Objeções abertas</th>
                <th className="px-4 py-2.5 text-right font-medium">Contrato</th>
                <th className="px-4 py-2.5 text-right font-medium">Pipeline</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => {
                const ag = agregado.get(c.id);
                const dias = ag ? diasEntre(ag.ultima) : null;
                const objecoes = (c.open_objections as unknown as Objecao[]) ?? [];
                return (
                  <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
                    <td className="px-4 py-2.5">
                      <Link href={`/clientes/${c.id}`} className="font-medium text-ink hover:text-accent">
                        {c.name}
                      </Link>
                      {c.segment ? <p className="text-[11px] text-ink-faint">{c.segment}</p> : null}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tom={tomHealth(c.health_band)}>{c.health_score}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-ink-dim">{ESTAGIO[c.stage] ?? c.stage}</td>
                    <td className="px-4 py-2.5">
                      <Mono>{ag?.total ?? 0}</Mono>
                    </td>
                    <td className="px-4 py-2.5 text-ink-dim">
                      {dias == null ? (
                        '—'
                      ) : (
                        <span className={dias > 30 ? 'text-warn' : undefined}>
                          {dias === 0 ? 'hoje' : `há ${dias}d`}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5">
                      {objecoes.length === 0 ? (
                        <span className="text-ink-faint">nenhuma</span>
                      ) : (
                        <span className="flex flex-wrap gap-1">
                          {objecoes.slice(0, 3).map((o, i) => (
                            <Badge key={i} tom="warn">
                              {o.categoria ?? 'outro'}
                            </Badge>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Mono>{fmtBRL(c.contract_value)}</Mono>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Mono tom={c.upsell_potential ? 'health' : 'neutro'}>
                        {fmtBRL(c.upsell_potential)}
                      </Mono>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
