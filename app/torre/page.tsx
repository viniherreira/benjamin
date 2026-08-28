import Link from 'next/link';
import {
  Activity,
  BellRing,
  Clock,
  Gauge,
  Layers,
  RadioTower,
  Swords,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import { Badge, Card, EmptyState, Mono, PageHeader, BotaoLink, type Tom } from '@/components/ui';
import { tomChurn, tomHealth } from '@/components/cliente-ui';
import { carregarTorre } from '@/lib/torre';
import { supabaseConfigurado } from '@/lib/supabase/server';
import { SemBanco } from '@/components/sem-banco';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Torre de controle' };

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const fmtBRL = (n: number | null) => (n == null ? '—' : BRL.format(n));

/** Bloco de valor com as premissas do cálculo sempre visíveis. */
function CardValor({
  rotulo,
  valor,
  tom,
  detalhe,
  premissas,
  icone,
}: {
  rotulo: string;
  valor: string;
  tom: Tom;
  detalhe: string;
  premissas: string[];
  icone: React.ReactNode;
}) {
  const cor: Record<Tom, string> = {
    neutro: 'text-ink',
    accent: 'text-accent',
    ai: 'text-ai',
    health: 'text-health',
    warn: 'text-warn',
    risk: 'text-risk',
  };
  return (
    <section className="rounded-lg border border-line bg-surface p-4 shadow-panel">
      <div className="flex items-center gap-1.5 text-ink-faint">
        {icone}
        <h2 className="text-[11px] font-semibold uppercase tracking-wide">{rotulo}</h2>
      </div>
      <p className={`mt-2 font-mono text-3xl tabular-nums ${cor[tom]}`}>{valor}</p>
      <p className="mt-1 text-[11.5px] text-ink-dim">{detalhe}</p>
      <ul className="mt-3 space-y-1 border-t border-line pt-2">
        {premissas.map((p, i) => (
          <li key={i} className="flex gap-1.5 text-[10.5px] leading-relaxed text-ink-faint">
            <span className="mt-[5px] size-1 shrink-0 rounded-full bg-ink-faint" />
            {p}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function TorrePage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader
          titulo="Torre de controle"
          descricao="A visão do Diretor Comercial: onde está a receita em risco, o pipeline identificado e o dinheiro que ninguém foi buscar."
        />
        <SemBanco oQueApareceAqui="Aqui a torre consolida todas as contas em reais: receita em risco por churn alto, pipeline ponderado por probabilidade e por unidade de negócio, upsell detectado e não trabalhado, e o throughput real do motor." />
      </>
    );
  }

  const t = await carregarTorre();

  if (t.totalAnalises === 0) {
    return (
      <>
        <PageHeader
          titulo="Torre de controle"
          descricao="A visão do Diretor Comercial: onde está a receita em risco, o pipeline identificado e o dinheiro que ninguém foi buscar."
        />
        <EmptyState
          icone={<RadioTower size={18} />}
          titulo="Nenhuma análise na base"
          descricao="A torre consolida todas as contas em reais: receita em risco por churn alto, pipeline ponderado por probabilidade e por unidade de negócio, upsell detectado e não trabalhado, e o throughput real do motor. Analise a primeira reunião para os números existirem."
          acao={
            <BotaoLink href="/reunioes/nova" variante="primario">
              Analisar uma reunião
            </BotaoLink>
          }
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        titulo="Torre de controle"
        descricao="A visão do Diretor Comercial: onde está a receita em risco, o pipeline identificado e o dinheiro que ninguém foi buscar."
        acoes={<BotaoLink href="/alertas">Ver alertas</BotaoLink>}
      />

      {/* Os três números que respondem "onde está o dinheiro" */}
      <div className="grid gap-4 lg:grid-cols-3">
        <CardValor
          rotulo="Receita em risco"
          valor={fmtBRL(t.receita.total)}
          tom={t.receita.total > 0 ? 'risk' : 'neutro'}
          detalhe={`${t.receita.contas.length} conta(s) com risco de churn alto`}
          premissas={t.receita.premissas}
          icone={<TriangleAlert size={13} />}
        />
        <CardValor
          rotulo="Pipeline identificado"
          valor={fmtBRL(t.pipeline.total)}
          tom={t.pipeline.total > 0 ? 'health' : 'neutro'}
          detalhe={`${t.pipeline.porUnidade.reduce((s, u) => s + u.oportunidades, 0)} oportunidade(s) extraída(s) das conversas`}
          premissas={t.pipeline.premissas}
          icone={<TrendingUp size={13} />}
        />
        <CardValor
          rotulo="Upsell não trabalhado"
          valor={fmtBRL(t.upsellParado.total)}
          tom={t.upsellParado.total > 0 ? 'warn' : 'neutro'}
          detalhe={`${t.upsellParado.contas.length} conta(s) com oportunidade parada`}
          premissas={t.upsellParado.premissas}
          icone={<Clock size={13} />}
        />
      </div>

      {/* Cross-BU: a prova de que o sistema enxerga além do ERP */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          titulo="Oportunidades por unidade de negócio"
          legenda="Gestão, RD Station e Techfin — o mapeamento Cross-BU"
          acoes={<Layers size={14} className="text-ink-faint" />}
        >
          {t.pipeline.porUnidade.length === 0 ? (
            <p className="text-[12px] text-ink-faint">Nenhuma oportunidade identificada ainda.</p>
          ) : (
            <ul className="space-y-2">
              {t.pipeline.porUnidade.map((u) => {
                const maior = Math.max(...t.pipeline.porUnidade.map((x) => x.valor), 1);
                return (
                  <li key={u.unidade}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12.5px] text-ink">{u.unidade}</span>
                      <span className="flex items-baseline gap-2">
                        <span className="text-[11px] text-ink-faint">{u.oportunidades} oport.</span>
                        <Mono tom={u.valor > 0 ? 'health' : 'neutro'}>{fmtBRL(u.valor)}</Mono>
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                      <div
                        className="h-full rounded-full bg-health"
                        style={{ width: `${Math.round((u.valor / maior) * 100)}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          titulo="Escala do motor"
          legenda="Medido sobre as análises desta base, não estimado"
          acoes={<Activity size={14} className="text-ink-faint" />}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-line bg-surface-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-faint">Latência média</p>
              <p className="mt-1 font-mono text-[15px] text-ink">{t.custo.latenciaMediaMs} ms</p>
            </div>
            <div className="rounded-md border border-line bg-surface-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-faint">Throughput</p>
              <p className="mt-1 font-mono text-[15px] text-ink">
                {t.custo.analisesPorMinuto.toLocaleString('pt-BR')}/min
              </p>
            </div>
            <div className="rounded-md border border-line bg-surface-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-faint">Custo por análise</p>
              <p className="mt-1 font-mono text-[15px] text-health">R$ 0,00</p>
            </div>
            <div className="rounded-md border border-line bg-surface-2 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-ink-faint">10.000 reuniões/dia</p>
              <p className="mt-1 font-mono text-[15px] text-ink">
                {t.custo.projecao10k.horasProcesso}h de processo
              </p>
            </div>
          </div>
          <div className="mt-3 rounded-md border border-health/30 bg-health-soft/20 px-3 py-2">
            <p className="text-[11.5px] leading-relaxed text-ink-dim">
              <span className="font-medium text-health">
                {t.produtividade.horasEconomizadas}h devolvidas ao time
              </span>{' '}
              em {t.produtividade.reunioes} reunião(ões) analisada(s).
            </p>
          </div>
          <ul className="mt-3 space-y-1 border-t border-line pt-2">
            {[...t.custo.premissas, ...t.produtividade.premissas].map((p, i) => (
              <li key={i} className="flex gap-1.5 text-[10.5px] leading-relaxed text-ink-faint">
                <span className="mt-[5px] size-1 shrink-0 rounded-full bg-ink-faint" />
                {p}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Contas em risco, ranqueadas por valor */}
      <div className="mt-4">
        <Card
          titulo="Contas que pedem atenção"
          legenda="Ranqueadas por valor de contrato — churn médio ou alto, health baixo ou concorrente ativo"
          acoes={<Gauge size={14} className="text-ink-faint" />}
        >
          {t.contasEmRisco.length === 0 ? (
            <p className="text-[12px] text-ink-faint">
              Nenhuma conta em risco no momento. Todas as contas estão com health saudável, sem concorrente
              ativo e sem sinal de churn relevante.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12.5px]">
                <thead className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Conta</th>
                    <th className="py-2 pr-4 font-medium">Health</th>
                    <th className="py-2 pr-4 font-medium">Churn</th>
                    <th className="py-2 pr-4 font-medium">Concorrente</th>
                    <th className="py-2 pr-4 font-medium">Último contato</th>
                    <th className="py-2 pr-4 text-right font-medium">Contrato</th>
                    <th className="py-2 text-right font-medium">Pipeline</th>
                  </tr>
                </thead>
                <tbody>
                  {t.contasEmRisco.map((c) => (
                    <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
                      <td className="py-2 pr-4">
                        <Link href={`/clientes/${c.id}`} className="font-medium text-ink hover:text-accent">
                          {c.nome}
                        </Link>
                        {c.segmento ? <p className="text-[11px] text-ink-faint">{c.segmento}</p> : null}
                      </td>
                      <td className="py-2 pr-4">
                        <Badge tom={tomHealth(c.banda)}>{c.health}</Badge>
                      </td>
                      <td className="py-2 pr-4">
                        {c.churn == null ? (
                          <span className="text-ink-faint">—</span>
                        ) : (
                          <Mono tom={tomChurn(c.churn)}>{c.churn}</Mono>
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {c.concorrentesAtivos.length === 0 ? (
                          <span className="text-ink-faint">—</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-risk">
                            <Swords size={11} />
                            {c.concorrentesAtivos.join(', ')}
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-ink-dim">
                        {c.diasDesdeContato == null ? (
                          '—'
                        ) : (
                          <span className={c.diasDesdeContato > 30 ? 'text-warn' : undefined}>
                            há {c.diasDesdeContato}d
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-right">
                        <Mono>{fmtBRL(c.contrato)}</Mono>
                      </td>
                      <td className="py-2 text-right">
                        <Mono tom={c.upsell ? 'health' : 'neutro'}>{fmtBRL(c.upsell)}</Mono>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {/* Alertas de alta severidade */}
      <div className="mt-4">
        <Card
          titulo="Alertas de alta severidade"
          legenda="O que exige decisão agora"
          acoes={
            <span className="inline-flex items-center gap-1.5">
              <BellRing size={14} className="text-ink-faint" />
              <Mono tom={t.alertasAltos.length > 0 ? 'risk' : 'neutro'}>{t.alertasAltos.length}</Mono>
            </span>
          }
        >
          {t.alertasAltos.length === 0 ? (
            <p className="text-[12px] text-ink-faint">
              Nenhum alerta de alta severidade. Os {t.totalAlertas} alerta(s) da base são de severidade
              média ou baixa — veja em Alertas.
            </p>
          ) : (
            <ul className="space-y-2">
              {t.alertasAltos.slice(0, 8).map((a) => (
                <li key={a.id} className="rounded-md border border-risk/30 bg-risk-soft/20 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tom="risk">{a.kind}</Badge>
                    <span className="text-[12.5px] font-medium text-ink">{a.title}</span>
                    {a.value_at_stake ? (
                      <Mono tom="risk" className="ml-auto text-[12px]">
                        {fmtBRL(a.value_at_stake)}
                      </Mono>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-ink-dim">{a.message}</p>
                  {a.evidence ? (
                    <p className="mt-1 font-mono text-[11px] italic leading-snug text-ink-faint">
                      “{a.evidence}”
                    </p>
                  ) : null}
                  {a.meeting_id ? (
                    <Link
                      href={`/reunioes/${a.meeting_id}`}
                      className="mt-1.5 inline-block text-[11px] text-accent hover:underline"
                    >
                      abrir briefing →
                    </Link>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </>
  );
}
