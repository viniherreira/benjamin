import Link from 'next/link';
import {
  AlarmClock,
  BellRing,
  Building2,
  CalendarClock,
  MessagesSquare,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import { Badge, BotaoLink, Card, EmptyState, Mono, PageHeader, StatTile } from '@/components/ui';
import { tomChurn, tomHealth } from '@/components/cliente-ui';
import { supabaseConfigurado, supabaseServer } from '@/lib/supabase/server';
import { SemBanco } from '@/components/sem-banco';
import { carregarTorre } from '@/lib/torre';
import { diasEntre } from '@/lib/memory';
import type { ActionItemRow, AlertRow, MeetingRow } from '@/lib/supabase/database.types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Dashboard' };

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const fmtBRL = (n: number | null) => (n == null ? '—' : BRL.format(n));
const fmtData = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');

export default async function DashboardPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader
          titulo="Dashboard"
          descricao="Suas reuniões, suas contas e o que precisa da sua atenção hoje."
        />
        <SemBanco oQueApareceAqui="Aqui ficam seus indicadores da semana, as contas por health score, as tarefas atrasadas e os alertas dos seus clientes." />
      </>
    );
  }

  const sb = supabaseServer();
  const t = await carregarTorre();

  const [reunioesRes, tarefasRes, alertasRes] = await Promise.all([
    sb
      .from('meetings')
      .select('id, title, meeting_date, meeting_type, status, customer_id')
      .order('meeting_date', { ascending: false })
      .limit(8),
    sb.from('action_items').select('*').eq('done', false).order('due_date').limit(50),
    sb.from('alerts').select('*').order('created_at', { ascending: false }).limit(6),
  ]);

  if (reunioesRes.error) throw new Error(`Falha ao carregar reuniões: ${reunioesRes.error.message}`);
  if (tarefasRes.error) throw new Error(`Falha ao carregar tarefas: ${tarefasRes.error.message}`);
  if (alertasRes.error) throw new Error(`Falha ao carregar alertas: ${alertasRes.error.message}`);

  const reunioes = (reunioesRes.data ?? []) as Pick<
    MeetingRow,
    'id' | 'title' | 'meeting_date' | 'meeting_type' | 'status' | 'customer_id'
  >[];
  const tarefas = (tarefasRes.data ?? []) as ActionItemRow[];
  const alertas = (alertasRes.data ?? []) as AlertRow[];

  const nomeConta = new Map(t.contas.map((c) => [c.id, c.nome]));

  const atrasadas = tarefas
    .filter((t2) => t2.due_date != null && diasEntre(t2.due_date) > 0)
    .map((t2) => ({ ...t2, atraso: diasEntre(t2.due_date as string) }))
    .sort((a, b) => b.atraso - a.atraso);

  const contasPorSaude = [...t.contas].sort((a, b) => a.health - b.health).slice(0, 6);

  if (t.totalAnalises === 0) {
    return (
      <>
        <PageHeader
          titulo="Dashboard"
          descricao="Suas reuniões, suas contas e o que precisa da sua atenção hoje."
          acoes={
            <BotaoLink href="/reunioes/nova" variante="primario">
              Analisar reunião
            </BotaoLink>
          }
        />
        <EmptyState
          icone={<MessagesSquare size={18} />}
          titulo="Nenhuma reunião analisada ainda"
          descricao="Assim que você analisar a primeira transcrição, aparecem aqui seus indicadores da semana, as contas por health score, as tarefas atrasadas e os alertas dos seus clientes."
          acao={
            <BotaoLink href="/reunioes/nova" variante="primario">
              Analisar a primeira reunião
            </BotaoLink>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Dashboard"
        descricao="Suas reuniões, suas contas e o que precisa da sua atenção hoje."
        acoes={
          <BotaoLink href="/reunioes/nova" variante="primario">
            Analisar reunião
          </BotaoLink>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          rotulo="Reuniões analisadas"
          valor={String(t.totalAnalises)}
          detalhe={`${t.produtividade.horasEconomizadas}h de pós-reunião evitadas`}
        />
        <StatTile
          rotulo="Pipeline identificado"
          valor={fmtBRL(t.pipeline.total)}
          detalhe="ponderado por probabilidade"
          tom={t.pipeline.total > 0 ? 'health' : 'neutro'}
        />
        <StatTile
          rotulo="Receita em risco"
          valor={fmtBRL(t.receita.total)}
          detalhe={`${t.receita.contas.length} conta(s) em churn alto`}
          tom={t.receita.total > 0 ? 'risk' : 'neutro'}
        />
        <StatTile
          rotulo="Tarefas atrasadas"
          valor={String(atrasadas.length)}
          detalhe={`${tarefas.length} em aberto no total`}
          tom={atrasadas.length > 0 ? 'warn' : 'neutro'}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          titulo="Reuniões recentes"
          legenda="As últimas transcrições analisadas"
          acoes={
            <Link href="/reunioes" className="text-[11.5px] text-accent hover:underline">
              ver todas
            </Link>
          }
        >
          <ul className="space-y-1.5">
            {reunioes.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/reunioes/${r.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-surface-2 px-3 py-2 transition-colors hover:border-line-strong"
                >
                  <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                    {fmtData(r.meeting_date)}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{r.title}</span>
                  {r.customer_id && nomeConta.get(r.customer_id) ? (
                    <span className="text-[11px] text-ink-faint">{nomeConta.get(r.customer_id)}</span>
                  ) : null}
                  {r.status !== 'analyzed' ? <Badge tom="warn">{r.status}</Badge> : null}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          titulo="Minhas contas por health score"
          legenda="As que mais precisam de atenção primeiro"
          acoes={
            <Link href="/clientes" className="text-[11.5px] text-accent hover:underline">
              ver todas
            </Link>
          }
        >
          <ul className="space-y-1.5">
            {contasPorSaude.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/clientes/${c.id}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-line bg-surface-2 px-3 py-2 transition-colors hover:border-line-strong"
                >
                  <Badge tom={tomHealth(c.banda)}>{c.health}</Badge>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-ink">{c.nome}</span>
                  {c.churn != null ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                      churn <Mono tom={tomChurn(c.churn)}>{c.churn}</Mono>
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                    <TrendingUp size={11} />
                    {fmtBRL(c.upsell)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        <Card
          titulo="Tarefas atrasadas"
          legenda="Compromissos vencidos, dos dois lados"
          acoes={<AlarmClock size={14} className="text-ink-faint" />}
        >
          {atrasadas.length === 0 ? (
            <p className="text-[12px] text-ink-faint">
              Nenhum compromisso atrasado. {tarefas.length} tarefa(s) em aberto dentro do prazo.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {atrasadas.slice(0, 6).map((t2) => (
                <li
                  key={t2.id}
                  className="rounded-md border border-risk/30 bg-risk-soft/20 px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tom={t2.side === 'interno' ? 'accent' : 'neutro'}>
                      {t2.side === 'interno' ? 'nosso' : 'cliente'}
                    </Badge>
                    <span className="min-w-0 flex-1 text-[12px] text-ink">{t2.description}</span>
                    <Mono tom="risk" className="text-[11px]">
                      {t2.atraso}d
                    </Mono>
                  </div>
                  {t2.customer_id && nomeConta.get(t2.customer_id) ? (
                    <Link
                      href={`/clientes/${t2.customer_id}`}
                      className="mt-0.5 inline-block text-[11px] text-ink-faint hover:text-accent"
                    >
                      {nomeConta.get(t2.customer_id)}
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card
          titulo="Alertas recentes"
          legenda="O que o motor encontrou nas suas contas"
          acoes={
            <Link href="/alertas" className="text-[11.5px] text-accent hover:underline">
              ver todos
            </Link>
          }
        >
          {alertas.length === 0 ? (
            <p className="text-[12px] text-ink-faint">Nenhum alerta gerado até agora.</p>
          ) : (
            <ul className="space-y-1.5">
              {alertas.map((a) => (
                <li
                  key={a.id}
                  className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2"
                >
                  <Badge tom={a.severity === 'alta' ? 'risk' : a.severity === 'media' ? 'warn' : 'neutro'}>
                    {a.kind}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{a.title}</span>
                  {a.value_at_stake ? (
                    <Mono tom={a.kind === 'oportunidade' ? 'health' : 'risk'} className="text-[11px]">
                      {fmtBRL(a.value_at_stake)}
                    </Mono>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Próximas ações sugeridas: preparar reunião das contas que mais precisam */}
      <div className="mt-4">
        <Card
          titulo="Prepare a próxima conversa"
          legenda="O briefing de 5 minutos das contas com menor health score"
          acoes={<CalendarClock size={14} className="text-ink-faint" />}
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {contasPorSaude.slice(0, 3).map((c) => (
              <Link
                key={c.id}
                href={`/clientes/${c.id}/preparar`}
                className="rounded-md border border-line bg-surface-2 px-3 py-2.5 transition-colors hover:border-accent/40"
              >
                <div className="flex items-center gap-2">
                  <Building2 size={12} className="shrink-0 text-ink-faint" />
                  <span className="min-w-0 truncate text-[12.5px] font-medium text-ink">{c.nome}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-faint">
                  <Badge tom={tomHealth(c.banda)}>{c.health}</Badge>
                  {c.diasDesdeContato != null ? <span>há {c.diasDesdeContato}d</span> : null}
                  {c.concorrentesAtivos.length > 0 ? (
                    <span className="inline-flex items-center gap-1 text-risk">
                      <TriangleAlert size={10} />
                      {c.concorrentesAtivos[0]}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1.5 text-[11px] text-accent">preparar briefing →</p>
              </Link>
            ))}
          </div>
        </Card>
      </div>

      {t.alertasAltos.length > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-risk">
          <BellRing size={12} />
          {t.alertasAltos.length} alerta(s) de alta severidade exigem decisão —{' '}
          <Link href="/torre" className="underline">
            ver na torre de controle
          </Link>
        </p>
      ) : null}
    </>
  );
}
