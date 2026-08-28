import Link from 'next/link';
import { Building2, Radar, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge, BotaoLink, Card, EmptyState, Mono, PageHeader, type Tom } from '@/components/ui';
import { carregarRadar, NOME_UNIDADE, type Periodo } from '@/lib/pains';
import { supabaseConfigurado } from '@/lib/supabase/server';
import { SemBanco } from '@/components/sem-banco';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Radar de dores' };

const TOM_UNIDADE: Record<string, Tom> = {
  gestao: 'accent',
  techfin: 'health',
  rd_station: 'ai',
  indefinido: 'neutro',
};

const PERIODOS: { valor: Periodo; rotulo: string }[] = [
  { valor: 0, rotulo: 'tudo' },
  { valor: 180, rotulo: '180 dias' },
  { valor: 90, rotulo: '90 dias' },
  { valor: 30, rotulo: '30 dias' },
];

function Chip({ ativo, href, children }: { ativo: boolean; href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={`rounded-md border px-2.5 py-1 text-[11.5px] font-medium transition-colors ${
        ativo
          ? 'border-accent/40 bg-accent-soft text-accent'
          : 'border-line bg-surface-2 text-ink-dim hover:border-line-strong hover:text-ink'
      }`}
    >
      {children}
    </Link>
  );
}

export default async function RadarPage({
  searchParams,
}: {
  searchParams: Promise<{ seg?: string; uni?: string; per?: string }>;
}) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader
          titulo="Radar de dores"
          descricao="Quais dores estão surgindo com mais frequência em toda a base — a pergunta que nenhuma reunião isolada responde."
        />
        <SemBanco oQueApareceAqui="Aqui as dores ditas pelos clientes aparecem agrupadas por tópico e ranqueadas por frequência, com filtro por segmento, unidade de negócio e período." />
      </>
    );
  }

  const sp = await searchParams;
  const periodo = (Number(sp.per ?? 0) as Periodo) ?? 0;

  const r = await carregarRadar({
    segmento: sp.seg ?? 'todos',
    unidade: sp.uni ?? 'todas',
    periodo,
  });

  const url = (novo: { seg?: string; uni?: string; per?: string | number }) =>
    `/radar?seg=${novo.seg ?? r.filtros.segmento}&uni=${novo.uni ?? r.filtros.unidade}&per=${
      novo.per ?? r.filtros.periodo
    }`;

  const maior = Math.max(...r.clusters.map((c) => c.ocorrencias), 1);

  return (
    <>
      <PageHeader
        titulo="Radar de dores"
        descricao="Quais dores estão surgindo com mais frequência em toda a base — a pergunta que nenhuma reunião isolada responde."
        acoes={<BotaoLink href="/torre">Torre de controle</BotaoLink>}
      />

      {r.totalSinais === 0 && r.filtros.segmento === 'todos' && r.filtros.unidade === 'todas' ? (
        <EmptyState
          icone={<Radar size={18} />}
          titulo="Nenhuma dor mapeada ainda"
          descricao="Cada dor dita pelo cliente vira um sinal com a citação que a originou. Aqui elas aparecem agrupadas por tópico e ranqueadas por frequência, com filtro por segmento, unidade de negócio e período — é o que mostra onde o mercado está apertando."
          acao={
            <BotaoLink href="/reunioes/nova" variante="primario">
              Analisar uma reunião
            </BotaoLink>
          }
        />
      ) : (
        <>
          {/* Filtros */}
          <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Unidade
              </span>
              <Chip ativo={r.filtros.unidade === 'todas'} href={url({ uni: 'todas' })}>
                todas
              </Chip>
              {(['gestao', 'techfin', 'rd_station'] as const).map((u) => (
                <Chip key={u} ativo={r.filtros.unidade === u} href={url({ uni: u })}>
                  {NOME_UNIDADE[u]}
                </Chip>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                Período
              </span>
              {PERIODOS.map((p) => (
                <Chip key={p.valor} ativo={r.filtros.periodo === p.valor} href={url({ per: p.valor })}>
                  {p.rotulo}
                </Chip>
              ))}
            </div>

            {r.segmentos.length > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                  Segmento
                </span>
                <Chip ativo={r.filtros.segmento === 'todos'} href={url({ seg: 'todos' })}>
                  todos
                </Chip>
                {r.segmentos.map((s) => (
                  <Chip key={s} ativo={r.filtros.segmento === s} href={url({ seg: s })}>
                    {s}
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Sinais de dor
              </p>
              <p className="mt-2 font-mono text-2xl text-ink">{r.totalSinais}</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Tópicos distintos
              </p>
              <p className="mt-2 font-mono text-2xl text-ink">{r.clusters.length}</p>
            </div>
            <div className="rounded-lg border border-line bg-surface p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
                Contas afetadas
              </p>
              <p className="mt-2 font-mono text-2xl text-ink">{r.totalClientes}</p>
            </div>
          </div>

          {/* Cross-BU */}
          {r.porUnidade.length > 0 ? (
            <div className="mt-4">
              <Card
                titulo="Dores por unidade de negócio"
                legenda="Fluxo de caixa é Techfin; previsibilidade de pipeline é RD Station — não é tudo ERP"
              >
                <ul className="flex flex-wrap gap-2">
                  {r.porUnidade.map((u) => (
                    <li key={u.unidade}>
                      <Badge tom={TOM_UNIDADE[u.unidade] ?? 'neutro'}>
                        {u.rotulo} · {u.ocorrencias}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          ) : null}

          {/* Ranking */}
          <div className="mt-4">
            {r.clusters.length === 0 ? (
              <div className="rounded-lg border border-dashed border-line bg-surface/50 px-6 py-10 text-center">
                <p className="text-[13px] font-semibold text-ink">Nenhuma dor com esse filtro</p>
                <p className="mt-1 text-[12px] text-ink-dim">
                  <Link href="/radar" className="text-accent hover:underline">
                    Limpar filtros
                  </Link>
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {r.clusters.map((c, i) => (
                  <li key={c.topico} className="rounded-lg border border-line bg-surface shadow-panel">
                    <div className="flex flex-wrap items-center gap-3 border-b border-line px-4 py-3">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 font-mono text-[11px] text-ink-dim">
                        {i + 1}
                      </span>
                      <h2 className="min-w-0 flex-1 text-[13px] font-semibold text-ink">{c.rotulo}</h2>
                      <Badge tom={TOM_UNIDADE[c.unidade] ?? 'neutro'}>{NOME_UNIDADE[c.unidade]}</Badge>
                      {c.tendencia.variacao !== 0 ? (
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] ${
                            c.tendencia.variacao > 0 ? 'text-warn' : 'text-health'
                          }`}
                          title="Ocorrências na metade mais recente do período vs. a anterior"
                        >
                          {c.tendencia.variacao > 0 ? (
                            <TrendingUp size={11} />
                          ) : (
                            <TrendingDown size={11} />
                          )}
                          {c.tendencia.variacao > 0 ? '+' : ''}
                          {c.tendencia.variacao}
                        </span>
                      ) : null}
                      <span className="text-[11px] text-ink-faint">
                        <Mono>{c.clientes}</Mono> conta(s)
                      </span>
                      <Mono tom="accent" className="text-[15px]">
                        {c.ocorrencias}
                      </Mono>
                    </div>

                    <div className="px-4 pt-3">
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                        <div
                          className="h-full rounded-full bg-accent"
                          style={{ width: `${Math.round((c.ocorrencias / maior) * 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="p-4">
                      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
                        Onde apareceu
                      </p>
                      <ul className="space-y-1.5">
                        {c.exemplos.map((e, j) => (
                          <li key={j} className="rounded-md border border-line bg-surface-2 px-3 py-2">
                            <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                              {e.clienteId ? (
                                <Link
                                  href={`/clientes/${e.clienteId}`}
                                  className="inline-flex items-center gap-1 font-medium text-ink hover:text-accent"
                                >
                                  <Building2 size={11} />
                                  {e.cliente}
                                </Link>
                              ) : (
                                <span className="text-ink-dim">{e.cliente}</span>
                              )}
                              {e.segmento ? <span className="text-ink-faint">{e.segmento}</span> : null}
                              <span className="ml-auto font-mono text-[10.5px] text-ink-faint">
                                {new Date(`${e.data}T00:00:00`).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                            {e.citacao ? (
                              <p className="mt-1 font-mono text-[11px] italic leading-relaxed text-ink-faint">
                                “{e.citacao}”
                              </p>
                            ) : null}
                            {e.meetingId ? (
                              <Link
                                href={`/reunioes/${e.meetingId}`}
                                className="mt-1 inline-block text-[10.5px] text-accent hover:underline"
                              >
                                abrir briefing →
                              </Link>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                      {c.ocorrencias > c.exemplos.length ? (
                        <p className="mt-2 text-[11px] text-ink-faint">
                          e mais {c.ocorrencias - c.exemplos.length} ocorrência(s).
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}
