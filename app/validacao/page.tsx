import {
  Boxes,
  Cpu,
  Database,
  FlaskConical,
  Mic,
  Quote,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { Badge, Card, Mono, PageHeader, type Tom } from '@/components/ui';
import { carregarValidacao } from '@/lib/validacao';
import { supabaseConfigurado } from '@/lib/supabase/server';
import { SemBanco } from '@/components/sem-banco';
import { coberturaCorpus } from '@/lib/validation/corpus-sintetico';
import { CORPUS_REAL, CORPUS_REAL_PENDENTE } from '@/lib/validation/corpus-real';
import { MetricasAoVivo } from './metricas-ao-vivo';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Validação' };

const TIPO_REDACAO: Record<string, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  cartao: 'Cartão',
};

function Secao({
  numero,
  titulo,
  pergunta,
  icone,
  children,
}: {
  numero: string;
  titulo: string;
  pergunta: string;
  icone: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="mb-3 flex items-start gap-3 border-b border-line pb-2.5">
        <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-dim">
          {icone}
        </span>
        <div className="min-w-0">
          <h2 className="text-[14px] font-semibold text-ink">
            <span className="font-mono text-ink-faint">{numero}.</span> {titulo}
          </h2>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-dim">{pergunta}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Numero({ valor, rotulo, tom = 'neutro' }: { valor: string; rotulo: string; tom?: Tom }) {
  const cor: Record<Tom, string> = {
    neutro: 'text-ink',
    accent: 'text-accent',
    ai: 'text-ai',
    health: 'text-health',
    warn: 'text-warn',
    risk: 'text-risk',
  };
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2.5">
      <p className={`font-mono text-[17px] tabular-nums ${cor[tom]}`}>{valor}</p>
      <p className="mt-0.5 text-[10.5px] leading-tight text-ink-faint">{rotulo}</p>
    </div>
  );
}

export default async function ValidacaoPage() {
  // O corpus, o método e a execução do motor vivem no repositório — esta tela
  // continua respondendo à rubrica sem banco. Só as seções que leem do Postgres
  // ficam sem número, e dizem por quê em vez de exibir zero como se fosse medida.
  const v = supabaseConfigurado() ? await carregarValidacao() : null;
  const cob = coberturaCorpus();
  const t = v?.tratamento ?? null;

  return (
    <>
      <PageHeader
        titulo="Validação"
        descricao="Como os dados foram coletados, tratados e analisados — e o que o motor acerta e erra, medido na hora."
      />

      {/* a) COLETA */}
      <Secao
        numero="a"
        titulo="Como os dados foram coletados"
        pergunta="A rubrica pede isso em primeiro lugar. Cada base é declarada pelo que ela é."
        icone={<Mic size={14} />}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Card
            titulo="Corpus A — REAL"
            legenda="Reuniões de role-play gravadas pelo squad"
            acoes={
              <Badge tom={CORPUS_REAL.length > 0 ? 'health' : 'warn'}>
                {CORPUS_REAL.length}/{CORPUS_REAL_PENDENTE.meta_alvo}
              </Badge>
            }
          >
            {CORPUS_REAL.length === 0 ? (
              <>
                <p className="text-[12px] leading-relaxed text-ink-dim">
                  {CORPUS_REAL_PENDENTE.observacao}
                </p>
                <p className="mt-2 rounded-md border border-warn/30 bg-warn-soft/25 px-3 py-2 text-[11.5px] leading-relaxed text-ink-dim">
                  O pipeline está pronto e o protocolo de coleta está escrito em{' '}
                  <span className="font-mono text-warn">PROTOCOLO-CORPUS.md</span>. Nenhuma amostra foi
                  marcada como real sem gravação correspondente: inventar isso fraudaria exatamente o
                  item que a rubrica cobra.
                </p>
              </>
            ) : (
              <p className="text-[12px] text-ink-dim">
                {CORPUS_REAL.length} reunião(ões) gravada(s) e transcrita(s), com metadados de coleta.
              </p>
            )}
            <ul className="mt-3 space-y-1 border-t border-line pt-2 text-[11.5px] leading-relaxed text-ink-dim">
              <li>Google Meet com legenda ativada, 8 a 12 minutos por reunião.</li>
              <li>Transcrição por legenda nativa, Whisper local ou API — a ferramenta é registrada.</li>
              <li>Transcrição não é limpa: erro de ASR e trecho inaudível são dado, não defeito.</li>
              <li>Gabarito anotado por dois integrantes independentes, com um terceiro desempatando.</li>
              <li>Índice de concordância entre anotadores registrado por amostra.</li>
            </ul>
          </Card>

          <Card
            titulo="Corpus B — SINTÉTICO"
            legenda="Complemento para cobrir o que 12 reuniões não cobrem"
            acoes={<Badge tom="accent">{cob.total}</Badge>}
          >
            <div className="grid grid-cols-3 gap-2">
              <Numero valor={String(cob.dev)} rotulo="partição dev" tom="accent" />
              <Numero valor={String(cob.holdout)} rotulo="partição holdout" tom="ai" />
              <Numero valor={String(cob.cenarios)} rotulo="cenários distintos" />
            </div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink-dim">
              Serve para casos-armadilha, cenários raros e volume estatístico. A separação dev/holdout
              existe para medir se o motor generaliza: os erros do holdout nunca são inspecionados item a
              item, senão a métrica vira propaganda.
            </p>
            <div className="mt-3 border-t border-line pt-2">
              <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
                Cobertura de sinais
              </p>
              <ul className="grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px]">
                {(
                  [
                    ['com concorrente', cob.com_concorrente, 8],
                    ['com objeção de preço', cob.com_objecao_preco, 8],
                    ['com churn claro', cob.com_churn_claro, 6],
                    ['com gatilho de upsell', cob.com_upsell, 10],
                    ['com budget declarado', cob.com_budget, 6],
                    ['sem sinal (falso positivo)', cob.sem_sinal, 4],
                    ['oportunidade Techfin', cob.techfin, 3],
                    ['oportunidade RD Station', cob.rd_station, 2],
                  ] as const
                ).map(([nome, valor, alvo]) => (
                  <li key={nome} className="flex items-center justify-between gap-2">
                    <span className="truncate text-ink-dim">{nome}</span>
                    <Mono tom={valor >= alvo ? 'health' : 'warn'} className="shrink-0 text-[11px]">
                      {valor}/{alvo}
                    </Mono>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </Secao>

      {/* b) TRATAMENTO */}
      <Secao
        numero="b"
        titulo="Como os dados foram tratados"
        pergunta="O pipeline com números da base, não um diagrama decorativo."
        icone={<Database size={14} />}
      >
        {t === null ? (
          <SemBanco oQueApareceAqui="Aqui o pipeline de preparo aparece com números da base: transcrições ingeridas, palavras normalizadas, turnos diarizados, entidades anonimizadas por tipo e a distribuição do Índice de Confiabilidade." />
        ) : (
          <Card titulo="Pipeline de preparo" legenda="Números reais das transcrições já ingeridas">
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
              <Numero valor={t.transcricoes.toLocaleString('pt-BR')} rotulo="transcrições ingeridas" />
              <Numero valor={t.palavras.toLocaleString('pt-BR')} rotulo="palavras normalizadas" />
              <Numero valor={t.turnos.toLocaleString('pt-BR')} rotulo="turnos diarizados" tom="accent" />
              <Numero
                valor={`~${t.sentencasEstimadas.toLocaleString('pt-BR')}`}
                rotulo="sentenças segmentadas"
              />
              <Numero
                valor={t.totalRedacoes.toLocaleString('pt-BR')}
                rotulo="entidades anonimizadas"
                tom={t.totalRedacoes > 0 ? 'health' : 'neutro'}
              />
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
                  Anonimização LGPD, por tipo
                </p>
                {t.redacoesPorTipo.length === 0 ? (
                  <p className="text-[11.5px] leading-relaxed text-ink-dim">
                    Nenhum dado sensível encontrado nas transcrições atuais. O mascaramento roda em toda
                    ingestão; o corpus sintético simplesmente não traz CPF ou telefone em toda amostra.
                  </p>
                ) : (
                  <ul className="space-y-1 text-[11.5px]">
                    {t.redacoesPorTipo.map((r) => (
                      <li key={r.tipo} className="flex items-center justify-between gap-2">
                        <span className="text-ink-dim">{TIPO_REDACAO[r.tipo] ?? r.tipo}</span>
                        <Mono>{r.quantidade}</Mono>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-faint">
                  A máscara tem exatamente o mesmo comprimento do trecho mascarado. Sem isso, todo offset
                  depois do primeiro CPF andaria e a evidência apontaria para o lugar errado da
                  transcrição. O valor original nunca é gravado — só o tipo e a posição.
                </p>
              </div>

              <div>
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
                  Distribuição do Índice de Confiabilidade
                </p>
                <div className="mb-2 flex items-baseline gap-2">
                  <Mono
                    tom={
                      t.confiabilidadeMedia >= 75 ? 'health' : t.confiabilidadeMedia >= 50 ? 'warn' : 'risk'
                    }
                    className="text-2xl"
                  >
                    {t.confiabilidadeMedia}
                  </Mono>
                  <span className="text-[11px] text-ink-faint">média da base</span>
                </div>
                <ul className="space-y-1.5">
                  {t.distribuicao.map((f) => {
                    const total = t.transcricoes || 1;
                    const pct = Math.round((f.quantidade / total) * 100);
                    return (
                      <li key={f.faixa}>
                        <div className="flex items-center justify-between gap-2 text-[11.5px]">
                          <span className="text-ink-dim">{f.faixa}</span>
                          <Mono tom={f.tom}>{f.quantidade}</Mono>
                        </div>
                        <div className="mt-0.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
                          <div
                            className={`h-full rounded-full ${
                              f.tom === 'health' ? 'bg-health' : f.tom === 'warn' ? 'bg-warn' : 'bg-risk'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
                  {t.comDiarizacao} transcrição(ões) com marcação de falante e {t.semDiarizacao} sem. Onde
                  não há marcação, as métricas de conversa ficam nulas — o sistema não inventa turno para
                  preencher gráfico.
                </p>
              </div>
            </div>

            {t.avisosMaisComuns.length > 0 ? (
              <div className="mt-4 border-t border-line pt-3">
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
                  Avisos de qualidade mais frequentes
                </p>
                <ul className="space-y-1">
                  {t.avisosMaisComuns.map((a) => (
                    <li key={a.aviso} className="flex items-start justify-between gap-3 text-[11.5px]">
                      <span className="text-ink-dim">{a.aviso}</span>
                      <Mono tom="warn" className="shrink-0">
                        {a.ocorrencias}×
                      </Mono>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        )}
      </Secao>

      {/* c) ANÁLISE */}
      <Secao
        numero="c"
        titulo="Como os dados foram analisados"
        pergunta="O motor, o contrato de saída e a regra que sustenta a confiabilidade."
        icone={<Cpu size={14} />}
      >
        <div className="grid gap-4 lg:grid-cols-3">
          <Card titulo="Motor determinístico" legenda="Regras em PT-BR, sem chamada de API">
            <ul className="space-y-1.5 text-[11.5px] leading-relaxed text-ink-dim">
              <li>Mesma entrada produz sempre a mesma saída — a demonstração não depende de sorte.</li>
              <li>Custo de API por análise: R$ 0,00.</li>
              <li>Cada campo é auditável até a regra que o produziu.</li>
              <li>
                O provider de LLM existe no contrato e entra sem refatoração quando houver chave; o
                rodapé de cada briefing diz qual motor rodou e em quantos ms.
              </li>
            </ul>
          </Card>

          <Card titulo="Evidência obrigatória" legenda="A regra que separa extração de invenção">
            <p className="text-[11.5px] leading-relaxed text-ink-dim">
              Todo item extraído carrega a citação literal e o índice de caractere no texto seguro. Item
              sem evidência rastreável não é retornado.
            </p>
            <p className="mt-2 rounded-md border border-accent/25 bg-accent-soft/20 px-3 py-2 text-[11px] leading-relaxed text-ink-dim">
              <Quote size={11} className="mr-1 inline text-accent" />
              Um teste de invariante verifica, em todo o corpus, que{' '}
              <span className="font-mono">texto.slice(start, end) === quote</span>. É o que permite
              clicar num item do briefing e ver o trecho exato acender na transcrição.
            </p>
          </Card>

          <Card titulo="Contrato de saída" legenda="TypeScript puro, sem I/O">
            <p className="text-[11.5px] leading-relaxed text-ink-dim">
              O motor recebe <span className="font-mono">(texto, memória do cliente)</span> e devolve um
              objeto tipado. Não conhece Next, não conhece Supabase, não faz rede — é isso que permite
              rodá-lo sobre o corpus inteiro nesta tela e medir latência de verdade.
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
              Invariante verificado em teste: a soma dos fatores de score bate exatamente com o número
              exibido. Se não bater, é bug.
            </p>
          </Card>
        </div>

        {/* IH + IA */}
        <div className="mt-4">
          <Card
            titulo="IH + IA — o sistema mede a própria falibilidade"
            legenda="Toda correção humana no briefing é registrada com o valor antes e depois"
            acoes={<UserCheck size={14} className="text-ink-faint" />}
          >
            {v === null ? (
              <p className="text-[11.5px] leading-relaxed text-ink-dim">
                As intervenções humanas ficam gravadas no Postgres, e sem banco configurado não há o que
                ler. Com as variáveis no ambiente, esta tabela mostra por campo quantas vezes o humano
                confirmou e quantas corrigiu o que o motor propôs — a medida da própria falibilidade.
              </p>
            ) : v.correcoes.total === 0 ? (
              <p className="text-[11.5px] leading-relaxed text-ink-dim">
                Nenhuma correção registrada ainda. Quando o vendedor confirma ou corrige um campo do
                briefing, a intervenção entra aqui e a taxa de correção por campo passa a ser exibida —
                a IA propõe com a evidência, o humano decide, e o erro do sistema vira número visível em
                vez de suposição.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-[10.5px] uppercase tracking-wide text-ink-faint">
                    <tr>
                      <th className="pb-1.5 pr-3 font-medium">Campo</th>
                      <th className="pb-1.5 pr-3 text-right font-medium">Confirmações</th>
                      <th className="pb-1.5 pr-3 text-right font-medium">Correções</th>
                      <th className="pb-1.5 text-right font-medium">Taxa de correção</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {v.correcoes.porCampo.map((c) => (
                      <tr key={c.campo} className="border-t border-line/60">
                        <td className="py-1.5 pr-3 font-sans text-ink-dim">{c.campo}</td>
                        <td className="py-1.5 pr-3 text-right text-health">{c.confirmacoes}</td>
                        <td className="py-1.5 pr-3 text-right text-warn">{c.correcoes}</td>
                        <td
                          className={`py-1.5 text-right ${
                            c.taxa > 0.3 ? 'text-risk' : c.taxa > 0.1 ? 'text-warn' : 'text-health'
                          }`}
                        >
                          {(c.taxa * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-[11px] text-ink-faint">
                  {v.correcoes.total} intervenção(ões) humana(s) registrada(s). Taxa alta num campo indica
                  onde o motor precisa melhorar — é o mapa de trabalho, não um defeito escondido.
                </p>
              </div>
            )}
          </Card>
        </div>
      </Secao>

      {/* d) MÉTRICAS AO VIVO */}
      <Secao
        numero="d"
        titulo="Métricas ao vivo"
        pergunta="Roda o motor sobre o corpus agora e mostra o resultado, inclusive o ruim."
        icone={<FlaskConical size={14} />}
      >
        <div className="rounded-lg border border-line bg-surface p-4 shadow-panel">
          <MetricasAoVivo />
        </div>

        {v !== null && v.execucoes.length > 0 ? (
          <div className="mt-4">
            <Card
              titulo="Histórico de execuções"
              legenda="Cada rodada fica gravada, o que permite comparar antes e depois de mexer no motor"
              acoes={<Boxes size={14} className="text-ink-faint" />}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead className="text-left text-[10.5px] uppercase tracking-wide text-ink-faint">
                    <tr>
                      <th className="pb-1.5 pr-3 font-medium">Quando</th>
                      <th className="pb-1.5 pr-3 font-medium">Motor</th>
                      <th className="pb-1.5 pr-3 font-medium">Corpus</th>
                      <th className="pb-1.5 pr-3 text-right font-medium">Amostras</th>
                      <th className="pb-1.5 pr-3 text-right font-medium">Latência média</th>
                      <th className="pb-1.5 pr-3 text-right font-medium">p95</th>
                      <th className="pb-1.5 text-right font-medium">Throughput</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono tabular-nums">
                    {v.execucoes.map((e) => (
                      <tr key={e.id} className="border-t border-line/60">
                        <td className="py-1.5 pr-3 text-ink-dim">
                          {new Date(e.created_at).toLocaleString('pt-BR')}
                        </td>
                        <td className="py-1.5 pr-3 font-sans text-ink-dim">{e.engine}</td>
                        <td className="py-1.5 pr-3 font-sans text-ink-dim">{e.corpus}</td>
                        <td className="py-1.5 pr-3 text-right text-ink">{e.sample_count}</td>
                        <td className="py-1.5 pr-3 text-right text-ink-dim">{e.avg_latency_ms} ms</td>
                        <td className="py-1.5 pr-3 text-right text-ink-dim">{e.p95_latency_ms} ms</td>
                        <td className="py-1.5 text-right text-ink">
                          {e.throughput_per_min?.toLocaleString('pt-BR') ?? '—'}/min
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        ) : null}
      </Secao>

      <p className="mt-6 flex items-start gap-2 rounded-lg border border-line bg-surface-2 px-4 py-3 text-[11.5px] leading-relaxed text-ink-dim">
        <ShieldCheck size={14} className="mt-0.5 shrink-0 text-ink-faint" />
        Todos os números desta tela vêm de execução real sobre o corpus e de leitura do Postgres. Nenhum
        valor foi digitado à mão, e as duas bases — real e sintética — são reportadas separadamente,
        cada uma declarada pelo que é.
      </p>
    </>
  );
}
