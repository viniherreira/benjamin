import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AlarmClock,
  Building2,
  CheckCircle2,
  Gavel,
  Layers,
  MessagesSquare,
  Repeat,
  ShieldCheck,
  Swords,
  Target,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import { Badge, BotaoLink, Card, Mono, PageHeader, type Tom } from '@/components/ui';
import {
  ListaFatores,
  Medidor,
  Rotulo,
  Sparkline,
  tomChurn,
  tomHealth,
  tomInteresse,
} from '@/components/cliente-ui';
import { visaoDoCliente } from '@/lib/memory';
import { supabaseConfigurado } from '@/lib/supabase/server';
import { SemBanco } from '@/components/sem-banco';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Cliente' };

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});
const fmtBRL = (n: number | null) => (n == null ? '—' : BRL.format(n));
const fmtData = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');

const TIPO: Record<string, string> = {
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

const STATUS_PRODUTO: Record<string, { rotulo: string; tom: Tom }> = {
  em_uso: { rotulo: 'Em uso', tom: 'health' },
  avaliando: { rotulo: 'Avaliando', tom: 'warn' },
  oportunidade: { rotulo: 'Oportunidade', tom: 'accent' },
  mencionado: { rotulo: 'Mencionado', tom: 'neutro' },
};

const UNIDADE: Record<string, string> = {
  gestao: 'Gestão',
  rd_station: 'RD Station',
  techfin: 'Techfin',
  indefinido: '—',
};

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader titulo="Cliente" descricao="A memória da conta, reunião a reunião." />
        <SemBanco oQueApareceAqui="Aqui fica a ficha da conta: health score explicado fator a fator, linha do tempo das reuniões, objeções recorrentes, ecossistema TOTVS mapeado e o que ficou pendente." />
      </>
    );
  }

  const { id } = await params;

  const v = await visaoDoCliente(id);
  if (!v) notFound();

  const c = v.cliente;
  const analisadas = v.linhaTempo.filter((p) => p.analisada);
  const ultimoInteresse = v.interesseHistorico.at(-1) ?? null;
  const ultimaConfianca = v.confiancaHistorica.at(-1) ?? null;
  const churnAtual = v.ultimaReuniao?.analise?.churn_risk ?? null;

  return (
    <>
      <Link
        href="/clientes"
        className="mb-3 inline-flex items-center gap-1 text-[12px] text-ink-dim transition-colors hover:text-ink"
      >
        <Building2 size={13} />
        Clientes
      </Link>

      <PageHeader
        titulo={c.name}
        descricao={[c.segment, c.size, `${analisadas.length} reunião(ões) analisada(s)`]
          .filter(Boolean)
          .join(' · ')}
        acoes={
          <BotaoLink href={`/clientes/${c.id}/preparar`} variante="primario">
            Preparar próxima reunião
          </BotaoLink>
        }
      />

      {/* Health + séries */}
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr]">
        <Card titulo="Health score" legenda="Composição sobre todo o histórico da conta">
          <Medidor valor={v.health.score} tom={tomHealth(v.health.band)} />
          <p className="mt-1 text-[11px] text-ink-faint">
            banda <span className="font-mono">{v.health.band}</span>
          </p>
          <div className="mt-4 border-t border-line pt-3">
            <Rotulo>Fatores</Rotulo>
            <ListaFatores fatores={v.health.factors} />
          </div>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card titulo="Interesse ao longo das reuniões" legenda="Uma leitura por reunião analisada">
            {ultimoInteresse != null ? (
              <>
                <div className="flex items-baseline gap-2">
                  <Mono tom={tomInteresse(ultimoInteresse)} className="text-2xl">
                    {ultimoInteresse}
                  </Mono>
                  <span className="text-[11px] text-ink-faint">atual</span>
                </div>
                <Sparkline
                  valores={v.interesseHistorico}
                  tom={tomInteresse(ultimoInteresse)}
                  rotulo="Evolução do interesse"
                />
              </>
            ) : (
              <p className="text-[12px] text-ink-faint">Sem reunião analisada ainda.</p>
            )}
          </Card>

          <Card titulo="Confiança no vendedor" legenda="Rapport medido por sinais na conversa">
            {ultimaConfianca != null ? (
              <>
                <div className="flex items-baseline gap-2">
                  <Mono tom={tomInteresse(ultimaConfianca)} className="text-2xl">
                    {ultimaConfianca}
                  </Mono>
                  <span className="text-[11px] text-ink-faint">atual</span>
                </div>
                <Sparkline
                  valores={v.confiancaHistorica}
                  tom="ai"
                  rotulo="Evolução da confiança"
                />
              </>
            ) : (
              <p className="text-[12px] text-ink-faint">Sem reunião analisada ainda.</p>
            )}
          </Card>

          <Card titulo="Valor de negócio" legenda="Estimativa a partir de parâmetros da conta">
            <dl className="space-y-2 text-[12px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-dim">Valor de contrato</dt>
                <dd>
                  <Mono>{fmtBRL(c.contract_value)}</Mono>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-dim">Pipeline identificado</dt>
                <dd>
                  <Mono tom={c.upsell_potential ? 'health' : 'neutro'}>{fmtBRL(c.upsell_potential)}</Mono>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-dim">Risco de churn (última)</dt>
                <dd>
                  {churnAtual == null ? (
                    <span className="text-ink-faint">—</span>
                  ) : (
                    <Mono tom={tomChurn(churnAtual)}>{churnAtual}</Mono>
                  )}
                </dd>
              </div>
            </dl>
            <p className="mt-3 border-t border-line pt-2 text-[10.5px] leading-relaxed text-ink-faint">
              Contrato é parâmetro configurado por conta; pipeline é a soma das oportunidades da última
              análise ponderada pela probabilidade. Estimativa, não previsão.
            </p>
          </Card>

          <Card titulo="Persona no ciclo" legenda="Maior poder de decisão identificado">
            {v.personaTopo ? (
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  {v.personaTopo.name ? <span className="font-medium text-ink">{v.personaTopo.name}</span> : null}
                  {v.personaTopo.role ? <span className="text-ink-dim">{v.personaTopo.role}</span> : null}
                </div>
                <Badge tom={v.personaTopo.decision_power === 'decisor' ? 'accent' : 'neutro'}>
                  {v.personaTopo.decision_power}
                </Badge>
                {v.personaTopo.decision_power !== 'decisor' ? (
                  <p className="pt-1 text-[11px] leading-relaxed text-warn">
                    Nenhuma reunião contou com quem assina — é o que mais pesa contra o health score.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="text-[12px] text-ink-faint">Persona ainda não identificada.</p>
            )}
          </Card>
        </div>
      </div>

      {/* Objeções recorrentes — o achado que nenhuma reunião isolada revela */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          titulo="Objeções recorrentes"
          legenda="Contadas por categoria ao longo de todas as reuniões"
          acoes={<Repeat size={14} className="text-ink-faint" />}
        >
          {v.objecoes.length === 0 ? (
            <p className="text-[12px] text-ink-faint">Nenhuma objeção registrada até aqui.</p>
          ) : (
            <ul className="space-y-2">
              {v.objecoes.map((o) => {
                const recorrente = o.mencoes >= 2 && !o.resolvida;
                return (
                  <li
                    key={o.categoria}
                    className={`rounded-md border px-3 py-2 ${
                      recorrente ? 'border-warn/40 bg-warn-soft/25' : 'border-line bg-surface-2'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tom={o.resolvida ? 'health' : recorrente ? 'warn' : 'neutro'}>
                        {o.categoria}
                      </Badge>
                      <Mono className="text-[11px]">
                        {o.mencoes}× {o.mencoes === 1 ? 'reunião' : 'reuniões'}
                      </Mono>
                      {o.resolvida ? (
                        <span className="text-[10.5px] text-health">endereçada</span>
                      ) : (
                        <span className="text-[10.5px] text-warn">em aberto</span>
                      )}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-ink-dim">{o.texto}</p>
                    {recorrente ? (
                      <p className="mt-1.5 flex items-start gap-1.5 text-[11px] font-medium text-warn">
                        <TriangleAlert size={12} className="mt-0.5 shrink-0" />
                        Apareceu em {o.mencoes} reuniões e segue sem resolução — trate antes do próximo passo.
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          titulo="Necessidades em aberto"
          legenda="Com contador de menções ao longo do relacionamento"
          acoes={<Target size={14} className="text-ink-faint" />}
        >
          {v.necessidades.length === 0 ? (
            <p className="text-[12px] text-ink-faint">Nenhuma necessidade extraída ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {v.necessidades.slice(0, 8).map((n, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 rounded-md border border-line bg-surface-2 px-3 py-2"
                >
                  <p className="text-[12px] leading-relaxed text-ink-dim">{n.texto}</p>
                  <Mono tom={n.mencoes > 1 ? 'accent' : 'neutro'} className="shrink-0 text-[11px]">
                    {n.mencoes}×
                  </Mono>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Stack e concorrentes */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          titulo="Stack TOTVS"
          legenda="O que está em uso e o que é oportunidade, por unidade de negócio"
          acoes={<Layers size={14} className="text-ink-faint" />}
        >
          {v.stack.length === 0 ? (
            <p className="text-[12px] text-ink-faint">Nenhum produto identificado ainda.</p>
          ) : (
            <ul className="space-y-1.5">
              {v.stack.map((s) => {
                const st = STATUS_PRODUTO[s.status] ?? STATUS_PRODUTO.mencionado;
                return (
                  <li
                    key={s.produto}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2"
                  >
                    <span className="text-[12.5px] font-medium text-ink">{s.produto}</span>
                    <Badge tom={st!.tom}>{st!.rotulo}</Badge>
                    {s.unidade !== 'indefinido' ? (
                      <span className="text-[11px] text-ink-faint">{UNIDADE[s.unidade] ?? s.unidade}</span>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          titulo="Concorrentes no ciclo"
          legenda="Menções acumuladas e se a ameaça está ativa"
          acoes={<Swords size={14} className="text-ink-faint" />}
        >
          {v.concorrentes.length === 0 ? (
            <p className="text-[12px] text-ink-faint">Nenhum concorrente citado.</p>
          ) : (
            <ul className="space-y-1.5">
              {v.concorrentes.map((k) => (
                <li
                  key={k.nome}
                  className={`flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 ${
                    k.ativo ? 'border-risk/40 bg-risk-soft/25' : 'border-line bg-surface-2'
                  }`}
                >
                  <span className="text-[12.5px] font-medium text-ink">{k.nome}</span>
                  <Badge tom={k.ativo ? 'risk' : 'neutro'}>{k.ativo ? 'ativo' : 'histórico'}</Badge>
                  <Mono className="text-[11px]">{k.mencoes}×</Mono>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Tarefas */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          titulo="Compromissos em aberto"
          legenda="Dos dois lados, com atraso destacado"
          acoes={<AlarmClock size={14} className="text-ink-faint" />}
        >
          {v.tarefasAbertas.length === 0 ? (
            <p className="text-[12px] text-ink-faint">
              Nenhum compromisso pendente. {v.tarefasConcluidas > 0 ? `${v.tarefasConcluidas} concluído(s).` : ''}
            </p>
          ) : (
            <ul className="space-y-1.5">
              {v.tarefasAbertas.map((t, i) => {
                const atrasada = t.diasAtraso > 0;
                return (
                  <li
                    key={i}
                    className={`rounded-md border px-3 py-2 ${
                      atrasada ? 'border-risk/40 bg-risk-soft/25' : 'border-line bg-surface-2'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tom={t.lado === 'interno' ? 'accent' : 'neutro'}>
                        {t.lado === 'interno' ? 'nosso' : 'cliente'}
                      </Badge>
                      <span className="text-[12px] text-ink">{t.descricao}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                      {t.responsavel ? <span className="text-ink-faint">{t.responsavel}</span> : null}
                      {t.prazo ? (
                        <span className={atrasada ? 'font-medium text-risk' : 'text-ink-faint'}>
                          {atrasada ? `atrasada há ${t.diasAtraso}d` : `prazo ${fmtData(t.prazo)}`}
                        </span>
                      ) : (
                        <span className="text-ink-faint">sem prazo</span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card
          titulo="Decisões registradas"
          legenda="O que ficou combinado ao longo do ciclo"
          acoes={<Gavel size={14} className="text-ink-faint" />}
        >
          {v.decisoes.length === 0 ? (
            <p className="text-[12px] text-ink-faint">Nenhuma decisão registrada.</p>
          ) : (
            <ul className="space-y-1.5">
              {v.decisoes.map((d, i) => (
                <li key={i} className="rounded-md border border-line bg-surface-2 px-3 py-2">
                  <p className="text-[12px] leading-relaxed text-ink-dim">{d.texto}</p>
                  <p className="mt-0.5 font-mono text-[10.5px] text-ink-faint">{fmtData(d.data)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Linha do tempo */}
      <div className="mt-4">
        <Card
          titulo="Linha do tempo"
          legenda="Cada reunião com seus indicadores — clique para abrir o briefing"
          acoes={<MessagesSquare size={14} className="text-ink-faint" />}
        >
          {v.linhaTempo.length === 0 ? (
            <p className="text-[12px] text-ink-faint">Nenhuma reunião registrada.</p>
          ) : (
            <ol className="space-y-2">
              {[...v.linhaTempo].reverse().map((p) => (
                <li key={p.meetingId}>
                  <Link
                    href={`/reunioes/${p.meetingId}`}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md border border-line bg-surface-2 px-3 py-2.5 transition-colors hover:border-line-strong"
                  >
                    <span className="font-mono text-[11px] tabular-nums text-ink-faint">
                      {fmtData(p.data)}
                    </span>
                    <span className="min-w-0 flex-1 text-[12.5px] text-ink">{p.titulo}</span>
                    <Badge tom="neutro">{TIPO[p.tipo] ?? p.tipo}</Badge>
                    {p.analisada ? (
                      <>
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                          <TrendingUp size={11} />
                          <Mono tom={tomInteresse(p.interesse ?? 0)}>{p.interesse}</Mono>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                          <ShieldCheck size={11} />
                          <Mono tom="ai">{p.confianca}</Mono>
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                          <TriangleAlert size={11} />
                          <Mono tom={tomChurn(p.churn ?? 0)}>{p.churn}</Mono>
                        </span>
                      </>
                    ) : (
                      <Badge tom="warn">sem análise</Badge>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      {v.tarefasConcluidas > 0 ? (
        <p className="mt-3 flex items-center gap-1.5 text-[11px] text-ink-faint">
          <CheckCircle2 size={12} className="text-health" />
          {v.tarefasConcluidas} compromisso(s) já concluído(s) nesta conta.
        </p>
      ) : null}
    </>
  );
}
