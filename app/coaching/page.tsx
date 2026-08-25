import Link from 'next/link';
import { GraduationCap, MessageCircleQuestion, Mic, TrendingUp } from 'lucide-react';
import { Badge, BotaoLink, Card, EmptyState, Mono, PageHeader, type Tom } from '@/components/ui';
import { Sparkline } from '@/components/cliente-ui';
import { supabaseServer } from '@/lib/supabase/server';
import type { AnalysisRow, MeetingRow } from '@/lib/supabase/database.types';
import type { Bant, MetricasConversa } from '@/lib/analysis';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Coaching' };

/**
 * Faixa de referência do talk-to-listen ratio.
 *
 * Em venda consultiva, quem fala demais não descobre. A faixa é parâmetro
 * configurável e está declarada na tela — não é lei, é referência para
 * conversa de desenvolvimento. O tom da página é construtivo por decisão de
 * produto: a ferramenta é de coaching, não de punição (valor IH + IA).
 */
const FAIXA_IDEAL = { min: 0.35, max: 0.55 };

const parse = <T,>(v: unknown, padrao: T): T => (v == null ? padrao : (v as T));
const pct = (n: number) => `${Math.round(n * 100)}%`;
const fmtData = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');

function tomTalkRatio(v: number): Tom {
  if (v >= FAIXA_IDEAL.min && v <= FAIXA_IDEAL.max) return 'health';
  if (v > FAIXA_IDEAL.max && v <= 0.7) return 'warn';
  if (v > 0.7) return 'risk';
  return 'accent'; // fala pouco demais também é sinal, não é vitória
}

function leituraTalkRatio(v: number): string {
  if (v > 0.7) return 'O vendedor dominou a conversa — pouco espaço para o cliente revelar dor.';
  if (v > FAIXA_IDEAL.max) return 'Acima da faixa de referência: dá para abrir mais espaço de escuta.';
  if (v < FAIXA_IDEAL.min) return 'Bem abaixo da faixa: reunião conduzida pelo cliente, vale checar se a agenda foi coberta.';
  return 'Dentro da faixa de referência de venda consultiva.';
}

export default async function CoachingPage() {
  const sb = supabaseServer();

  const [reunioesRes, analisesRes] = await Promise.all([
    sb
      .from('meetings')
      .select('id, title, meeting_date, meeting_type, customer_id')
      .order('meeting_date', { ascending: true })
      .limit(500),
    sb.from('analyses').select('*').order('created_at', { ascending: true }).limit(500),
  ]);

  if (reunioesRes.error) throw new Error(`Falha ao carregar reuniões: ${reunioesRes.error.message}`);
  if (analisesRes.error) throw new Error(`Falha ao carregar análises: ${analisesRes.error.message}`);

  const reunioes = new Map(
    ((reunioesRes.data ?? []) as Pick<
      MeetingRow,
      'id' | 'title' | 'meeting_date' | 'meeting_type' | 'customer_id'
    >[]).map((m) => [m.id, m]),
  );
  const analises = (analisesRes.data ?? []) as AnalysisRow[];

  const linhas = analises
    .map((a) => {
      const m = reunioes.get(a.meeting_id);
      if (!m) return null;
      const cm = parse<MetricasConversa | null>(a.conversation_metrics, null);
      const bant = parse<Bant | null>(a.bant, null);
      return { analise: a, reuniao: m, metricas: cm, bant };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);

  const comTalkRatio = linhas.filter((l) => l.metricas?.talk_ratio_seller != null);
  const semDiarizacao = linhas.length - comTalkRatio.length;

  if (linhas.length === 0) {
    return (
      <>
        <PageHeader
          titulo="Coaching"
          descricao="A métrica que a TOTVS pediu por escrito: o vendedor está ouvindo mais do que falando?"
        />
        <EmptyState
          icone={<GraduationCap size={18} />}
          titulo="Nenhuma reunião analisada ainda"
          descricao="Esta tela mede a conversa, não o cliente: talk-to-listen ratio contra a faixa de referência, número e tipo de perguntas, maior monólogo e cobertura BANT — com evolução ao longo do tempo. Tom construtivo: é ferramenta de desenvolvimento."
          acao={
            <BotaoLink href="/reunioes/nova" variante="primario">
              Analisar uma reunião
            </BotaoLink>
          }
        />
      </>
    );
  }

  const media = (ns: number[]) => (ns.length > 0 ? ns.reduce((s, n) => s + n, 0) / ns.length : 0);

  const talkRatios = comTalkRatio.map((l) => l.metricas!.talk_ratio_seller as number);
  const mediaTalk = media(talkRatios);
  const mediaPerguntas = media(comTalkRatio.map((l) => l.metricas!.seller_questions ?? 0));
  const mediaAbertas = media(comTalkRatio.map((l) => l.metricas!.open_questions ?? 0));
  const mediaMonologo = media(comTalkRatio.map((l) => l.metricas!.longest_monologue_words ?? 0));
  const mediaBant = media(linhas.map((l) => l.bant?.score ?? 0));

  const naFaixa = talkRatios.filter((v) => v >= FAIXA_IDEAL.min && v <= FAIXA_IDEAL.max).length;

  return (
    <>
      <PageHeader
        titulo="Coaching"
        descricao="A métrica que a TOTVS pediu por escrito: o vendedor está ouvindo mais do que falando? Tom de desenvolvimento, não de avaliação."
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            Talk ratio médio
          </p>
          <p className={`mt-2 font-mono text-2xl ${mediaTalk > 0 ? '' : 'text-ink-faint'}`}>
            <Mono tom={mediaTalk > 0 ? tomTalkRatio(mediaTalk) : 'neutro'}>
              {mediaTalk > 0 ? pct(mediaTalk) : '—'}
            </Mono>
          </p>
          <p className="mt-1 text-[11px] text-ink-faint">
            faixa de referência {pct(FAIXA_IDEAL.min)}–{pct(FAIXA_IDEAL.max)}
          </p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            Perguntas por reunião
          </p>
          <p className="mt-2 font-mono text-2xl text-ink">{mediaPerguntas.toFixed(1)}</p>
          <p className="mt-1 text-[11px] text-ink-faint">{mediaAbertas.toFixed(1)} abertas em média</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            Maior monólogo
          </p>
          <p className="mt-2 font-mono text-2xl text-ink">{Math.round(mediaMonologo)}</p>
          <p className="mt-1 text-[11px] text-ink-faint">palavras, média das reuniões</p>
        </div>
        <div className="rounded-lg border border-line bg-surface p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide text-ink-faint">
            Cobertura BANT
          </p>
          <p className="mt-2 font-mono text-2xl text-ink">{mediaBant.toFixed(1)}/4</p>
          <p className="mt-1 text-[11px] text-ink-faint">média por reunião</p>
        </div>
      </div>

      {comTalkRatio.length > 0 ? (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <Card
            titulo="Evolução do talk ratio"
            legenda="Uma leitura por reunião com marcação de falante, da mais antiga para a mais recente"
            acoes={<TrendingUp size={14} className="text-ink-faint" />}
          >
            <Sparkline
              valores={talkRatios.map((v) => v * 100)}
              tom={tomTalkRatio(mediaTalk)}
              rotulo="Talk ratio do vendedor ao longo das reuniões"
            />
            <p className="mt-2 text-[11.5px] leading-relaxed text-ink-dim">
              <span className="font-medium text-ink">
                {naFaixa} de {comTalkRatio.length}
              </span>{' '}
              reunião(ões) dentro da faixa de referência. A linha tracejada marca 50%.
            </p>
          </Card>

          <Card titulo="Como ler estes números" legenda="Referência, não regra">
            <ul className="space-y-2 text-[12px] leading-relaxed text-ink-dim">
              <li className="flex gap-2">
                <Mic size={13} className="mt-0.5 shrink-0 text-ink-faint" />
                <span>
                  <span className="font-medium text-ink">Talk ratio</span> é o percentual de palavras
                  ditas pelo vendedor. Acima de 70% costuma indicar apresentação, não descoberta.
                </span>
              </li>
              <li className="flex gap-2">
                <MessageCircleQuestion size={13} className="mt-0.5 shrink-0 text-ink-faint" />
                <span>
                  <span className="font-medium text-ink">Pergunta aberta</span> (“como”, “por que”, “me
                  conta”) abre espaço para a dor aparecer; pergunta fechada confirma o que já se supõe.
                </span>
              </li>
              <li className="flex gap-2">
                <GraduationCap size={13} className="mt-0.5 shrink-0 text-ink-faint" />
                <span>
                  A faixa é parâmetro do time, e o número sozinho não julga a reunião: uma demonstração
                  tem talk ratio naturalmente alto. Use como ponto de partida da conversa.
                </span>
              </li>
            </ul>
            {semDiarizacao > 0 ? (
              <p className="mt-3 rounded-md border border-warn/30 bg-warn-soft/25 px-3 py-2 text-[11.5px] leading-relaxed text-warn">
                {semDiarizacao} reunião(ões) sem marcação de falante ficaram fora destas médias. Sem saber
                quem falou o quê, o sistema não inventa turno — o talk ratio simplesmente não existe.
              </p>
            ) : null}
          </Card>
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-warn/30 bg-warn-soft/25 px-5 py-6">
          <p className="text-[13px] font-semibold text-warn">
            Nenhuma reunião com marcação de falante
          </p>
          <p className="mt-1.5 max-w-2xl text-[12px] leading-relaxed text-ink-dim">
            Talk ratio, perguntas e monólogo só podem ser medidos quando a transcrição identifica quem
            falou. As {linhas.length} reunião(ões) analisadas não têm essa marcação, e o sistema não
            inventa turnos para preencher o gráfico. Para habilitar esta tela, use transcrições no
            formato <span className="font-mono">Nome: fala</span>.
          </p>
        </div>
      )}

      {/* Detalhe por reunião */}
      <div className="mt-4">
        <Card
          titulo="Reunião a reunião"
          legenda="Cada linha abre o briefing correspondente"
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="py-2 pr-4 font-medium">Reunião</th>
                  <th className="py-2 pr-4 font-medium">Data</th>
                  <th className="py-2 pr-4 font-medium">Talk ratio</th>
                  <th className="py-2 pr-4 font-medium">Perguntas</th>
                  <th className="py-2 pr-4 font-medium">Monólogo</th>
                  <th className="py-2 font-medium">BANT</th>
                </tr>
              </thead>
              <tbody>
                {[...linhas].reverse().map((l) => {
                  const tr = l.metricas?.talk_ratio_seller ?? null;
                  return (
                    <tr key={l.analise.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
                      <td className="py-2 pr-4">
                        <Link
                          href={`/reunioes/${l.reuniao.id}`}
                          className="text-ink hover:text-accent"
                          title={tr != null ? leituraTalkRatio(tr) : undefined}
                        >
                          {l.reuniao.title}
                        </Link>
                      </td>
                      <td className="py-2 pr-4 font-mono text-[11px] text-ink-dim">
                        {fmtData(l.reuniao.meeting_date)}
                      </td>
                      <td className="py-2 pr-4">
                        {tr == null ? (
                          <Badge tom="neutro">sem diarização</Badge>
                        ) : (
                          <span className="inline-flex items-center gap-2">
                            <Mono tom={tomTalkRatio(tr)}>{pct(tr)}</Mono>
                            <span className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-surface-3 sm:block">
                              <span
                                className={`block h-full rounded-full ${
                                  tomTalkRatio(tr) === 'health'
                                    ? 'bg-health'
                                    : tomTalkRatio(tr) === 'warn'
                                      ? 'bg-warn'
                                      : tomTalkRatio(tr) === 'risk'
                                        ? 'bg-risk'
                                        : 'bg-accent'
                                }`}
                                style={{ width: `${Math.round(tr * 100)}%` }}
                              />
                            </span>
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-ink-dim">
                        {l.metricas?.seller_questions == null ? (
                          '—'
                        ) : (
                          <>
                            <Mono>{l.metricas.seller_questions}</Mono>
                            <span className="text-[11px] text-ink-faint">
                              {' '}
                              ({l.metricas.open_questions ?? 0} abertas)
                            </span>
                          </>
                        )}
                      </td>
                      <td className="py-2 pr-4 text-ink-dim">
                        {l.metricas?.longest_monologue_words == null ? (
                          '—'
                        ) : (
                          <Mono tom={l.metricas.longest_monologue_words > 150 ? 'warn' : 'neutro'}>
                            {l.metricas.longest_monologue_words}p
                          </Mono>
                        )}
                      </td>
                      <td className="py-2">
                        <Mono
                          tom={
                            (l.bant?.score ?? 0) >= 3 ? 'health' : (l.bant?.score ?? 0) >= 2 ? 'warn' : 'risk'
                          }
                        >
                          {l.bant?.score ?? 0}/4
                        </Mono>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
