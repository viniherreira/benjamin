import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Lightbulb,
  ShieldCheck,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
} from 'lucide-react';
import { Badge, Mono, PageHeader, type Tom } from '@/components/ui';
import { tomInteresse } from '@/components/cliente-ui';
import { visaoDoCliente } from '@/lib/memory';
import { supabaseConfigurado } from '@/lib/supabase/server';
import { SemBanco } from '@/components/sem-banco';
import { montarPreparacao, preparacaoEmTexto } from '@/lib/preparacao';
import { AcoesPreparacao } from './acoes';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Preparar reunião' };

const fmtData = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');

function Linha({
  rotulo,
  icone,
  children,
}: {
  rotulo: string;
  icone?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line/60 py-2 last:border-0">
      <span className="inline-flex w-[168px] shrink-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {icone}
        {rotulo}
      </span>
      <div className="min-w-0 flex-1 text-[13px] leading-relaxed text-ink">{children}</div>
    </div>
  );
}

export default async function PrepararPage({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader
          titulo="Preparar reunião"
          descricao="O briefing de 2 minutos antes de entrar na próxima conversa com a conta."
        />
        <SemBanco oQueApareceAqui="Aqui fica a preparação montada a partir do histórico: o que ficou pendente, as objeções que voltaram, as perguntas a fazer e os riscos a evitar." />
      </>
    );
  }

  const { id } = await params;

  const v = await visaoDoCliente(id);
  if (!v) notFound();

  const p = montarPreparacao(v);
  const texto = preparacaoEmTexto(v.cliente.name, p);

  const semHistorico = v.interesseHistorico.length === 0;

  const tomVariacao: Tom =
    p.interesse?.variacao == null ? 'neutro' : p.interesse.variacao >= 0 ? 'health' : 'risk';

  return (
    <>
      <Link
        href={`/clientes/${v.cliente.id}`}
        className="no-print mb-3 inline-flex items-center gap-1 text-[12px] text-ink-dim transition-colors hover:text-ink"
      >
        <ArrowLeft size={13} />
        {v.cliente.name}
      </Link>

      <PageHeader
        titulo="Briefing pré-reunião"
        descricao={`${v.cliente.name} — leitura de 5 minutos antes da call, montada a partir do histórico analisado.`}
        acoes={<AcoesPreparacao texto={texto} />}
      />

      {semHistorico ? (
        <div className="rounded-lg border border-dashed border-line bg-surface/50 px-6 py-12 text-center">
          <div className="mx-auto mb-3 flex size-10 items-center justify-center rounded-lg border border-line bg-surface-2 text-ink-faint">
            <CalendarClock size={18} />
          </div>
          <h3 className="text-[13px] font-semibold text-ink">Ainda não há histórico para preparar</h3>
          <p className="mx-auto mt-1.5 max-w-md text-[12px] leading-relaxed text-ink-dim">
            O briefing pré-reunião nasce das conversas já analisadas: necessidades recorrentes, objeções
            em aberto, pendências dos dois lados e evolução do interesse. Analise a primeira reunião desta
            conta para ele passar a existir.
          </p>
          <Link
            href="/reunioes/nova"
            className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-accent px-3 py-1.5 text-[12px] font-semibold text-canvas hover:opacity-90"
          >
            Analisar uma reunião
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_minmax(300px,38%)]">
          {/* Situação */}
          <section className="rounded-lg border border-line bg-surface p-4 shadow-panel">
            <h2 className="mb-1 text-[13px] font-semibold text-ink">Onde a conta está</h2>
            <p className="mb-3 text-[11px] text-ink-faint">
              Cada linha vem de reuniões analisadas — nada aqui foi digitado à mão.
            </p>

            {p.ultimaConversa ? (
              <Linha rotulo="Última conversa">
                <span className="font-mono text-[12px]">{fmtData(p.ultimaConversa.data)}</span>{' '}
                <span className={p.ultimaConversa.dias > 30 ? 'text-warn' : 'text-ink-dim'}>
                  (há {p.ultimaConversa.dias} dia{p.ultimaConversa.dias === 1 ? '' : 's'})
                </span>
                <span className="text-ink-dim"> — {p.ultimaConversa.titulo}</span>
              </Linha>
            ) : null}

            {p.principalNecessidade ? (
              <Linha rotulo="Principal necessidade" icone={<Target size={11} />}>
                {p.principalNecessidade.texto}{' '}
                <Mono tom="accent" className="text-[11px]">
                  {p.principalNecessidade.mencoes}×
                </Mono>
              </Linha>
            ) : null}

            {p.principalObjecao ? (
              <Linha rotulo="Principal objeção" icone={<TriangleAlert size={11} />}>
                <span className="inline-flex flex-wrap items-center gap-2">
                  <Badge tom={p.principalObjecao.resolvida ? 'health' : 'warn'}>
                    {p.principalObjecao.categoria}
                  </Badge>
                  <span className="text-ink-dim">
                    {p.principalObjecao.mencoes} menção(ões) ·{' '}
                    {p.principalObjecao.resolvida ? 'endereçada' : 'não endereçada'}
                  </span>
                </span>
                <p className="mt-0.5 text-[12px] text-ink-dim">{p.principalObjecao.texto}</p>
              </Linha>
            ) : null}

            {p.ultimaDecisao ? (
              <Linha rotulo="Última decisão">
                {p.ultimaDecisao.texto}{' '}
                <span className="font-mono text-[11px] text-ink-faint">
                  ({fmtData(p.ultimaDecisao.data)})
                </span>
              </Linha>
            ) : null}

            {p.pendenciasNossas.map((t, i) => (
              <Linha key={`n${i}`} rotulo="Pendência nossa">
                {t.descricao}
                {t.diasAtraso > 0 ? (
                  <span className="ml-2 inline-flex items-center gap-1 rounded border border-risk/40 bg-risk-soft px-1.5 py-0.5 text-[10.5px] font-medium text-risk">
                    <TriangleAlert size={10} /> atrasada há {t.diasAtraso}d
                  </span>
                ) : t.prazo ? (
                  <span className="ml-2 font-mono text-[11px] text-ink-faint">prazo {fmtData(t.prazo)}</span>
                ) : null}
              </Linha>
            ))}

            {p.pendenciasCliente.map((t, i) => (
              <Linha key={`c${i}`} rotulo="Pendência do cliente">
                {t.descricao}
                {t.diasAtraso > 0 ? (
                  <span className="ml-2 font-mono text-[11px] text-warn">atrasada há {t.diasAtraso}d</span>
                ) : null}
              </Linha>
            ))}

            {p.ameacas.map((a) => (
              <Linha key={a.nome} rotulo="Ameaça ativa" icone={<Swords size={11} />}>
                <span className="font-medium text-risk">{a.nome}</span>{' '}
                <span className="text-ink-dim">— mencionada {a.mencoes}×</span>
              </Linha>
            ))}
          </section>

          {/* Indicadores */}
          <aside className="space-y-4">
            <div className="rounded-lg border border-line bg-surface p-4 shadow-panel">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
                    Interesse
                  </p>
                  {p.interesse ? (
                    <>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <Mono tom={tomInteresse(p.interesse.atual)} className="text-2xl">
                          {p.interesse.atual}
                        </Mono>
                        {p.interesse.variacao != null && p.interesse.variacao !== 0 ? (
                          <span
                            className={`inline-flex items-center gap-0.5 text-[11px] ${
                              tomVariacao === 'health' ? 'text-health' : 'text-risk'
                            }`}
                          >
                            {p.interesse.variacao > 0 ? (
                              <TrendingUp size={11} />
                            ) : (
                              <TrendingDown size={11} />
                            )}
                            {Math.abs(p.interesse.variacao)}
                          </span>
                        ) : null}
                      </div>
                      {p.interesse.anterior != null ? (
                        <p className="text-[10.5px] text-ink-faint">era {p.interesse.anterior}</p>
                      ) : null}
                    </>
                  ) : (
                    <p className="mt-1 text-[12px] text-ink-faint">—</p>
                  )}
                </div>

                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
                    Confiança
                  </p>
                  {p.confianca ? (
                    <>
                      <div className="mt-1 flex items-baseline gap-1.5">
                        <Mono tom="ai" className="text-2xl">
                          {p.confianca.atual}
                        </Mono>
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-ink-dim">
                          <ShieldCheck size={11} />
                          {p.confianca.rotulo}
                        </span>
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-[12px] text-ink-faint">—</p>
                  )}
                </div>
              </div>

              {p.bant ? (
                <div className="mt-4 border-t border-line pt-3">
                  <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
                    Cobertura BANT do ciclo
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Mono tom={p.bant.score >= 3 ? 'health' : p.bant.score >= 2 ? 'warn' : 'risk'}>
                      {p.bant.score}/4
                    </Mono>
                    {(['budget', 'authority', 'need', 'timeline'] as const).map((k) => (
                      <Badge key={k} tom={p.bant![k] ? 'health' : 'neutro'}>
                        {k}
                      </Badge>
                    ))}
                  </div>
                  {p.bant.missing.length > 0 ? (
                    <p className="mt-1.5 text-[11px] text-warn">falta: {p.bant.missing.join(', ')}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </aside>

          {/* Recomendações */}
          <section className="rounded-lg border border-ai/30 bg-ai-soft/20 p-4 lg:col-span-2">
            <h2 className="mb-1 flex items-center gap-1.5 text-[13px] font-semibold text-ink">
              <Lightbulb size={14} className="text-ai" />
              Recomendações para esta conversa
            </h2>
            <p className="mb-3 text-[11px] text-ink-faint">
              Priorizadas pelo que trava o negócio. Cada uma mostra o dado do histórico que a originou — a
              decisão continua sendo sua.
            </p>

            {p.recomendacoes.length === 0 ? (
              <p className="text-[12px] text-ink-dim">
                Nada trava esta conta no momento: sem objeção em aberto, sem pendência atrasada e sem
                concorrente ativo. Siga com o próximo passo combinado.
              </p>
            ) : (
              <ol className="space-y-2">
                {p.recomendacoes.map((r) => (
                  <li
                    key={r.ordem}
                    className="flex gap-3 rounded-md border border-line bg-surface px-3 py-2.5"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ai-soft font-mono text-[11px] font-semibold text-ai">
                      {r.ordem}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[12.5px] font-medium leading-relaxed text-ink">{r.titulo}</p>
                      <p className="mt-0.5 flex items-start gap-1 text-[11.5px] leading-relaxed text-ink-dim">
                        <ArrowRight size={11} className="mt-[3px] shrink-0 text-ink-faint" />
                        {r.porque}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </>
  );
}
