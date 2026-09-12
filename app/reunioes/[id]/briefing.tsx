'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  TriangleAlert,
  Ban,
  BadgeDollarSign,
  Building2,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Lock,
  MessagesSquare,
  Quote,
  ShieldCheck,
  Swords,
  Target,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import type { AnalysisResult, BusinessUnit, Evidence } from '@/lib/analysis';
import { Badge, Mono, type Tom } from '@/components/ui';
import { ControleCorrecao } from './correcao';
import { PainelEnriquecimento } from './enriquecer';
import { Abas } from '@/components/abas';

/* ------------------------------------------------------------------ *
 * Formatação
 * ------------------------------------------------------------------ */

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const fmtBRL = (n: number | null | undefined) => (n == null ? '—' : BRL.format(n));
const pct = (n: number) => `${Math.round(n * 100)}%`;

const UNIDADE: Record<BusinessUnit, string> = {
  gestao: 'Gestão',
  rd_station: 'RD Station',
  techfin: 'Techfin',
  indefinido: '—',
};

const STATUS_PRODUTO: Record<'em_uso' | 'avaliando' | 'mencionado' | 'oportunidade', { rotulo: string; tom: Tom }> = {
  em_uso: { rotulo: 'Em uso', tom: 'health' },
  avaliando: { rotulo: 'Avaliando', tom: 'warn' },
  mencionado: { rotulo: 'Mencionado', tom: 'neutro' },
  oportunidade: { rotulo: 'Oportunidade', tom: 'accent' },
};

const SEVERIDADE: Record<'alta' | 'media' | 'baixa', Tom> = { alta: 'risk', media: 'warn', baixa: 'neutro' };

/** `media` é chave de dado; a tela escreve "média". */
const AMEACA: Record<'alta' | 'media' | 'baixa', string> = {
  alta: 'alta',
  media: 'média',
  baixa: 'baixa',
};
const SENTIMENTO: Record<'positivo' | 'neutro' | 'negativo' | 'misto', { rotulo: string; tom: Tom }> = {
  positivo: { rotulo: 'Positivo', tom: 'health' },
  neutro: { rotulo: 'Neutro', tom: 'neutro' },
  negativo: { rotulo: 'Negativo', tom: 'risk' },
  misto: { rotulo: 'Misto', tom: 'warn' },
};

const PODER: Record<'decisor' | 'influenciador' | 'usuario' | 'desconhecido', string> = {
  decisor: 'Decisor',
  influenciador: 'Influenciador',
  usuario: 'Usuário',
  desconhecido: 'Não identificado',
};

type Sel = { start: number; end: number } | null;

/* ------------------------------------------------------------------ *
 * Componente principal
 * ------------------------------------------------------------------ */

export function Briefing({
  meetingId,
  transcricao,
  analise,
}: {
  meetingId: string;
  transcricao: string;
  analise: AnalysisResult;
}) {
  const [sel, setSel] = useState<Sel>(null);

  function selecionar(ev: Evidence | undefined) {
    if (!ev || !ev.quote) return;
    let { start, end } = ev;
    if (end <= start) {
      const i = transcricao.indexOf(ev.quote);
      if (i >= 0) {
        start = i;
        end = i + ev.quote.length;
      } else {
        return;
      }
    }
    setSel({ start, end });
  }

  const q = analise.transcript_quality;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(340px,42%)]">
      {/*
        Coluna do briefing.

        Três superfícies de vidro, não dezessete: a capa com o que o vendedor
        precisa antes de entrar na call, o que fazer depois dela, e o resto
        atrás de abas. Nada saiu do produto — toda extração continua a um
        clique, com a citação que a originou.
      */}
      <div className="min-w-0 space-y-4">
        <Capa analise={analise} onSelect={selecionar} />

        <Acoes analise={analise} sel={sel} onSelect={selecionar} />

        <Abas
          abas={[
            {
              id: 'conta',
              rotulo: 'Conta',
              icone: <Building2 size={13} />,
              conteudo: (
                <Grupo>
                  <Ecossistema analise={analise} sel={sel} onSelect={selecionar} />
                  <Oportunidades analise={analise} sel={sel} onSelect={selecionar} />
                  <Concorrentes analise={analise} sel={sel} onSelect={selecionar} />
                  <ValorNegocio analise={analise} />
                </Grupo>
              ),
            },
            {
              id: 'conversa',
              rotulo: 'Conversa',
              icone: <MessagesSquare size={13} />,
              conteudo: (
                <Grupo>
                  <Sentimento analise={analise} sel={sel} onSelect={selecionar} />
                  <Persona analise={analise} onSelect={selecionar} />
                  <Voz analise={analise} sel={sel} onSelect={selecionar} />
                  <Confianca analise={analise} sel={sel} onSelect={selecionar} />
                  <Conversa analise={analise} />
                </Grupo>
              ),
            },
            {
              id: 'extracao',
              rotulo: 'Extração',
              icone: <Target size={13} />,
              conteudo: (
                <Grupo>
                  <SemAtribuicao analise={analise} />
                  <Extracoes analise={analise} sel={sel} onSelect={selecionar} />
                  <SinaisChurnUpsell analise={analise} sel={sel} onSelect={selecionar} />
                  <Financeiro analise={analise} sel={sel} onSelect={selecionar} />
                </Grupo>
              ),
            },
            {
              id: 'placar',
              rotulo: 'Como o motor calculou',
              icone: <Gauge size={13} />,
              conteudo: (
                <Grupo>
                  {/*
                    Interesse e poder de decisão são os campos mais fracos da
                    validação. Exibir o número sem dizer isso empresta a eles
                    uma precisão que a medição não sustenta — e o lugar de dizer
                    é aqui, junto da conta, não na capa.

                    O link em vez do número: acurácia publicada na tela envelhece
                    a cada ajuste de léxico, e número velho no produto é o mesmo
                    defeito que este projeto passou a semana consertando na
                    documentação.
                  */}
                  <p className="text-[11.5px] leading-relaxed text-ink-faint">
                    Estes dois scores são estimativa calibrada, não medida. A acurácia de cada campo
                    é medida sobre o corpus versionado e publicada em{' '}
                    <a href="/validacao" className="text-accent hover:underline">
                      Validação
                    </a>{' '}
                    — o interesse é hoje o campo mais fraco do motor.
                  </p>
                  <ScoreCard
                    titulo="Interesse"
                    icone={<Gauge size={14} />}
                    valor={analise.interest_score}
                    tom={
                      (analise.interest_score ?? 0) >= 60
                        ? 'health'
                        : (analise.interest_score ?? 0) >= 40
                          ? 'warn'
                          : 'risk'
                    }
                    fatores={analise.score_factors}
                    onSelect={selecionar}
                  />
                  <ScoreCard
                    titulo="Risco de churn"
                    icone={<TrendingDown size={14} />}
                    valor={analise.churn_risk}
                    tom={
                      (analise.churn_risk ?? 0) >= 67
                        ? 'risk'
                        : (analise.churn_risk ?? 0) >= 34
                          ? 'warn'
                          : 'health'
                    }
                    fatores={analise.churn_factors}
                    onSelect={selecionar}
                  />
                  <Qualidade analise={analise} />
                </Grupo>
              ),
            },
          ]}
        />

        <PainelEnriquecimento meetingId={meetingId} onSelecionar={selecionar} />
      </div>

      {/* Coluna da transcrição */}
      <aside className="lg:sticky lg:top-4 lg:h-fit">
        <div className="overflow-hidden vidro rounded-xl">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div className="flex items-center gap-2">
              <MessagesSquare size={14} className="text-ink-dim" />
              <h2 className="text-[13px] font-semibold text-ink">Transcrição</h2>
            </div>
            <SeloConfiabilidade valor={q.reliability_index} />
          </div>
          <Transcricao texto={transcricao} sel={sel} />
          <div className="border-t border-line px-4 py-2 text-[10.5px] text-ink-faint">
            Clique em qualquer item extraído para ver o trecho que o originou. {q.redacted_entities > 0
              ? `${q.redacted_entities} dado(s) sensível(is) anonimizado(s).`
              : 'Nenhum dado sensível encontrado.'}
          </div>
        </div>
      </aside>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Transcrição com destaque
 * ------------------------------------------------------------------ */

function Transcricao({ texto, sel }: { texto: string; sel: Sel }) {
  const markRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (sel && markRef.current) {
      markRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [sel]);

  const temDestaque = sel && sel.end > sel.start;

  return (
    <div className="max-h-[68vh] overflow-y-auto px-4 py-3">
      <pre className="whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-ink-dim">
        {temDestaque ? (
          <>
            {texto.slice(0, sel!.start)}
            <span
              ref={markRef}
              className="rounded bg-accent-soft px-0.5 text-ink ring-1 ring-accent/50"
            >
              {texto.slice(sel!.start, sel!.end)}
            </span>
            {texto.slice(sel!.end)}
          </>
        ) : (
          texto
        )}
      </pre>
    </div>
  );
}

function SeloConfiabilidade({ valor }: { valor: number }) {
  const tom: Tom = valor >= 75 ? 'health' : valor >= 50 ? 'warn' : 'risk';
  return (
    <span title="Índice de Confiabilidade da transcrição (0–100)">
      <Badge tom={tom}>
        <ShieldCheck size={11} />
        confiab. {valor}
      </Badge>
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Blocos de briefing
 * ------------------------------------------------------------------ */

function Secao({
  titulo,
  icone,
  contador,
  children,
}: {
  titulo: string;
  icone?: ReactNode;
  contador?: number;
  children: ReactNode;
}) {
  /*
   * Secao NÃO é vidro.
   *
   * Era, e esse foi o erro: com uma seção de vidro por assunto, o briefing
   * empilhava dezessete arestas, dezessete sombras e dezessete blurs numa
   * coluna só. Vidro precisa de espaço negativo para parecer material — em
   * série ele vira textura e some.
   *
   * Agora o vidro marca SUPERFÍCIE, não item: quem tem vidro é o painel ou a
   * aba que agrupa; aqui dentro a separação é feita com espaço e um hairline.
   * Card dentro de card é sempre erro.
   */
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2">
        {icone ? <span className="text-ink-faint">{icone}</span> : null}
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-dim">
          {titulo}
        </h2>
        {contador != null ? (
          <span className="ml-auto font-mono text-[11px] tabular-nums text-ink-faint">
            {contador}
          </span>
        ) : null}
      </div>
      {children}
    </section>
  );
}

const Vazio = ({ children }: { children: ReactNode }) => (
  <p className="text-[12px] text-ink-faint">{children}</p>
);

/** Linha clicável que destaca a evidência na transcrição. */
/**
 * Item extraído: clicar destaca a evidência na transcrição, e o controle ao
 * lado registra a confirmação ou a correção humana.
 *
 * É um `div` com um botão interno, não um botão externo: os controles de
 * correção são botões e não podem ser aninhados dentro de outro botão.
 */
function ItemEv({
  ev,
  sel,
  onSelect,
  campo,
  valor,
  children,
}: {
  ev?: Evidence;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
  /** Nome do campo em `corrections`. Sem ele, o item não é corrigível. */
  campo?: string;
  valor?: unknown;
  children: ReactNode;
}) {
  const clicavel = Boolean(ev?.quote);
  const ativo =
    ev != null && sel != null && ev.start === sel.start && ev.end === sel.end && ev.end > ev.start;
  return (
    <div
      className={`group rounded-md border px-3 py-2 transition-colors ${
        ativo ? 'border-accent/50 bg-accent-soft/40' : 'border-line bg-surface-2'
      } ${clicavel ? 'hover:border-line-strong' : ''}`}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          disabled={!clicavel}
          onClick={() => onSelect(ev)}
          title={clicavel ? 'Ver o trecho que originou este item' : undefined}
          className="min-w-0 flex-1 text-left text-[12.5px] leading-relaxed text-ink disabled:cursor-default"
        >
          {children}
        </button>
        {clicavel ? (
          <Quote
            size={12}
            className={`mt-0.5 shrink-0 ${ativo ? 'text-accent' : 'text-ink-faint group-hover:text-ink-dim'}`}
          />
        ) : null}
        {campo ? <ControleCorrecao campo={campo} valor={valor ?? ev?.quote ?? null} /> : null}
      </div>
      {ev?.quote ? (
        <p className="mt-1 line-clamp-2 font-mono text-[11px] italic leading-snug text-ink-faint">
          “{ev.quote}”
        </p>
      ) : null}
    </div>
  );
}

/**
 * Agrupa seções dentro de uma superfície de vidro.
 *
 * A separação entre assuntos é feita por espaço e um hairline — nunca por mais
 * um painel. Quem tem vidro é o container; aqui dentro é ritmo.
 */
function Grupo({ children }: { children: ReactNode }) {
  return <div className="divide-y divide-line [&>*]:py-5 [&>*:first-child]:pt-0 [&>*:last-child]:pb-0">{children}</div>;
}

/**
 * Um fato da capa: rótulo em micro-caixa-alta e o valor embaixo.
 *
 * Vira botão quando existe citação por trás — a promessa do produto é que todo
 * item leva à frase que o originou, e ela não pode valer só nas abas.
 */
function Fato({
  rotulo,
  ev,
  onSelect,
  children,
}: {
  rotulo: string;
  ev?: Evidence;
  onSelect?: (e: Evidence | undefined) => void;
  children: ReactNode;
}) {
  const clicavel = Boolean(ev?.quote && onSelect);
  const corpo = (
    <>
      <span className="block text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-faint">
        {rotulo}
      </span>
      <span className="mt-1 block text-[13px] leading-snug text-ink">{children}</span>
    </>
  );

  if (!clicavel) return <div className="min-w-0">{corpo}</div>;

  return (
    <button
      type="button"
      onClick={() => onSelect?.(ev)}
      title="Ver o trecho que originou este item"
      className="group min-w-0 rounded-md text-left transition-colors hover:text-ink"
    >
      <span className="block text-[10px] font-semibold uppercase tracking-[0.09em] text-ink-faint transition-colors group-hover:text-ink-dim">
        {rotulo}
      </span>
      <span className="mt-1 flex items-center gap-1.5 text-[13px] leading-snug text-ink">
        {children}
        <Quote size={10} className="shrink-0 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  );
}

/**
 * A capa.
 *
 * Substitui o que eram quatro painéis no topo — resumo, dois scores gigantes e
 * persona. O resumo é a manchete; abaixo dele vem a faixa de fatos que o
 * roteiro da demo já apontava como o que importa: produto, concorrente,
 * budget, persona e sentimento.
 *
 * Os dois scores entram como número na faixa, do mesmo tamanho dos demais
 * fatos. Cartão grande com barra dava a eles um peso que o próprio roteiro não
 * lhes dá — e agora que podem vir nulos, um "—" ocupando meia tela pareceria
 * defeito em vez de abstenção. A conta que produziu cada um continua inteira,
 * na aba "Como o motor calculou".
 */
function Capa({
  analise,
  onSelect,
}: {
  analise: AnalysisResult;
  onSelect: (e: Evidence | undefined) => void;
}) {
  const s = SENTIMENTO[analise.sentiment] ?? SENTIMENTO.neutro;
  const produto = analise.totvs_products[0];
  const outros = analise.totvs_products.length - 1;
  const ameaca = [...analise.competitors].sort((a, b) => Number(b.active) - Number(a.active))[0];
  const verba = analise.budget[0];
  const p = analise.persona;

  const num = (v: number | null) =>
    v === null ? <span className="text-ink-faint">—</span> : <span className="tabular-nums">{v}</span>;

  return (
    <section className="vidro rounded-xl p-5">
      <p className="max-w-[68ch] text-[14.5px] leading-relaxed text-ink">
        {analise.summary || 'Sem resumo para esta reunião.'}
      </p>

      <div className="mt-5 flex flex-wrap gap-x-7 gap-y-4 border-t border-line pt-4">
        {/*
          `tom="accent"` e não o default: Mono neutro é `text-ink-dim`, que numa
          faixa de fatos primários faz o número sair mais apagado que o rótulo
          dele. Na paleta monocromática do produto, accent É tinta cheia.
        */}
        <Fato rotulo="Interesse">
          <Mono tom="accent" className="text-[15px]">
            {num(analise.interest_score)}
          </Mono>
        </Fato>
        <Fato rotulo="Risco de churn">
          <Mono
            tom={(analise.churn_risk ?? 0) >= 67 ? 'risk' : (analise.churn_risk ?? 0) >= 34 ? 'warn' : 'accent'}
            className="text-[15px]"
          >
            {num(analise.churn_risk)}
          </Mono>
        </Fato>

        <Fato rotulo="Sentimento">
          <Badge tom={s.tom}>{s.rotulo}</Badge>
        </Fato>

        <Fato rotulo="Persona" ev={p.evidence} onSelect={onSelect}>
          {p.name ? `${p.name} · ` : ''}
          {PODER[p.decision_power] ?? p.decision_power}
        </Fato>

        {produto ? (
          <Fato rotulo="Produto" ev={produto.evidence} onSelect={onSelect}>
            {produto.name}
            <Badge tom={STATUS_PRODUTO[produto.status]?.tom ?? 'neutro'}>
              {STATUS_PRODUTO[produto.status]?.rotulo ?? produto.status}
            </Badge>
            {outros > 0 ? <span className="text-ink-faint">+{outros}</span> : null}
          </Fato>
        ) : null}

        {ameaca ? (
          <Fato rotulo="Concorrente" ev={ameaca.evidence} onSelect={onSelect}>
            {ameaca.name}
            <Badge tom={ameaca.active ? SEVERIDADE[ameaca.threat] ?? 'neutro' : 'neutro'}>
              {ameaca.active ? `ameaça ${AMEACA[ameaca.threat] ?? ameaca.threat}` : 'histórico'}
            </Badge>
          </Fato>
        ) : null}

        {verba ? (
          <Fato rotulo="Budget" ev={verba.evidence} onSelect={onSelect}>
            <Mono className="text-[13px] tabular-nums">{fmtBRL(verba.amount)}</Mono>
            {verba.confidential ? (
              <Badge tom="warn">
                <Lock size={10} />
                sigiloso
              </Badge>
            ) : null}
          </Fato>
        ) : null}
      </div>
    </section>
  );
}

/**
 * O que fazer.
 *
 * Próximos passos e tarefas estavam em 13º e 18º na rolagem. Para quem abre o
 * briefing antes da próxima call, é a única coisa acionável da tela — e agora
 * é a segunda superfície, logo abaixo da capa.
 */
function Acoes({
  analise,
  sel,
  onSelect,
}: {
  analise: AnalysisResult;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  const nada = analise.next_steps.length === 0 && analise.action_items.length === 0;

  return (
    <section className="vidro rounded-xl p-5">
      <div className="mb-3 flex items-center gap-2">
        <Target size={14} className="text-ink-faint" />
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-dim">
          O que fazer
        </h2>
      </div>

      {nada ? (
        <Vazio>
          A reunião terminou sem próximo passo acordado. Isso costuma ser o achado, não a falta
          dele.
        </Vazio>
      ) : (
        <div className="space-y-4">
          <GrupoTexto
            titulo="Próximos passos"
            itens={analise.next_steps}
            sel={sel}
            onSelect={onSelect}
            render={(n) => (n as (typeof analise.next_steps)[number]).text}
          />
          <Tarefas analise={analise} sel={sel} onSelect={onSelect} />
        </div>
      )}
    </section>
  );
}

/**
 * Ressalva de atribuição.
 *
 * Sem separar quem falou, `ehFalaDoCliente` passa a aceitar qualquer sentença —
 * a regra do projeto é extrair mesmo assim, só não afirmar de quem é a fala.
 * Só que a tela vinha afirmando: um bloco chamado "Problemas / dores" logo
 * abaixo do nome do cliente lê como dor DO cliente.
 *
 * Medido sobre as 37 amostras, removendo os rótulos: a lista de dores incha
 * 30%, e o que entra é o vendedor descrevendo o problema numa demonstração.
 * Não dá para separar depois; dá para avisar.
 */
function SemAtribuicao({ analise }: { analise: AnalysisResult }) {
  if (analise.transcript_quality.scores_atribuiveis) return null;
  return (
    <div className="flex gap-2 rounded-md border border-warn/30 bg-warn-soft/30 px-3 py-2.5">
      <TriangleAlert size={13} className="mt-0.5 shrink-0 text-warn" />
      <p className="text-[11.5px] leading-relaxed text-ink-dim">
        Esta transcrição não separa quem falou, então os itens abaixo saem da conversa inteira —{' '}
        <strong className="font-medium text-ink">não só da fala do cliente</strong>. Uma dor descrita
        pelo vendedor numa demonstração entra aqui do mesmo jeito. A citação de cada item continua
        exata; o que falta é de quem ela é.
      </p>
    </div>
  );
}

/**
 * Qualidade da matéria-prima.
 *
 * Antes só existia como um selo numérico ao lado da transcrição. Agora que o
 * motor se abstém de calcular interesse e churn quando não consegue separar
 * quem falou, o MOTIVO da abstenção precisa de um lugar — um "—" sem
 * explicação é pior que um número errado.
 */
function Qualidade({ analise }: { analise: AnalysisResult }) {
  const q = analise.transcript_quality;
  return (
    <Secao titulo="Qualidade da transcrição" icone={<ShieldCheck size={14} />}>
      <div className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
        <Metrica rotulo="Confiabilidade" valor={<Mono>{q.reliability_index}</Mono>} />
        <Metrica rotulo="Palavras" valor={<Mono>{q.word_count}</Mono>} />
        <Metrica rotulo="Falantes" valor={<Mono>{q.speaker_count}</Mono>} />
      </div>

      {analise.speakers.length > 0 ? (
        <div className="mt-4 space-y-1.5">
          {analise.speakers.map((f) => (
            <div
              key={f.name}
              className="flex flex-wrap items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 text-[12.5px]"
            >
              <span className="font-medium text-ink">{f.name}</span>
              <Badge tom={f.side === 'vendedor' ? 'accent' : f.side === 'cliente' ? 'health' : 'neutro'}>
                {f.side}
              </Badge>
              <Mono className="text-[11px] tabular-nums text-ink-faint">
                confiança {f.confidence.toFixed(2)}
              </Mono>
              {f.signals.length > 0 ? (
                <span className="min-w-0 truncate font-mono text-[10.5px] text-ink-faint">
                  {f.signals.join(' · ')}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      {q.warnings.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {q.warnings.map((w) => (
            <li key={w} className="flex gap-2 text-[12px] leading-snug text-ink-dim">
              <TriangleAlert size={13} className="mt-0.5 shrink-0 text-warn" />
              {w}
            </li>
          ))}
        </ul>
      ) : null}
    </Secao>
  );
}

function BarraScore({ valor, tom }: { valor: number; tom: Tom }) {
  const cor: Record<Tom, string> = {
    neutro: 'bg-ink-faint',
    accent: 'bg-accent',
    ai: 'bg-ai',
    health: 'bg-health',
    warn: 'bg-warn',
    risk: 'bg-risk',
  };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className={`h-full rounded-full ${cor[tom]}`} style={{ width: `${Math.max(0, Math.min(100, valor))}%` }} />
    </div>
  );
}

function ScoreCard({
  titulo,
  icone,
  valor,
  tom,
  fatores,
  onSelect,
}: {
  titulo: string;
  icone: ReactNode;
  valor: number | null;
  tom: Tom;
  fatores: AnalysisResult['score_factors'];
  onSelect: (e: Evidence | undefined) => void;
}) {
  /*
   * Score nulo é abstenção declarada do motor, não dado faltando. Mostrar "—"
   * com o motivo é mais honesto do que mostrar 0, que o vendedor leria como
   * "risco nenhum" — exatamente a leitura errada.
   */
  if (valor === null) {
    return (
      <section>
        <div className="flex items-center gap-1.5 text-ink-dim">
          {icone}
          <h3 className="text-[12px] font-semibold uppercase tracking-wide">{titulo}</h3>
        </div>
        <div className="mt-2 flex items-baseline gap-1">
          <Mono tom="neutro" className="text-3xl text-ink-faint">
            —
          </Mono>
        </div>
        <p className="mt-2 text-[11.5px] leading-snug text-ink-faint">
          Não calculado: sem separar quem é vendedor e quem é cliente, os sinais de risco não
          podem ser atribuídos a ninguém.
        </p>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center gap-1.5 text-ink-dim">
        {icone}
        <h3 className="text-[12px] font-semibold uppercase tracking-wide">{titulo}</h3>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <Mono tom={tom} className="text-3xl">
          {valor}
        </Mono>
        <span className="text-[12px] text-ink-faint">/100</span>
      </div>
      <div className="mt-2">
        <BarraScore valor={valor} tom={tom} />
      </div>
      {fatores.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {fatores.map((f, i) => {
            const clicavel = Boolean(f.evidence?.quote);
            return (
              <li key={`${f.label}-${i}`}>
                <button
                  type="button"
                  disabled={!clicavel}
                  onClick={() => onSelect(f.evidence)}
                  className={`flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-[11.5px] transition-colors ${
                    clicavel ? 'hover:bg-surface-2' : ''
                  }`}
                >
                  <span className="min-w-0 truncate text-ink-dim">{f.label}</span>
                  <Mono tom={f.delta >= 0 ? 'health' : 'risk'} className="shrink-0 text-[11.5px]">
                    {f.delta >= 0 ? '+' : ''}
                    {f.delta}
                  </Mono>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-2 text-[11px] text-ink-faint">Sem fatores registrados.</p>
      )}
    </section>
  );
}

function Confianca({
  analise,
  sel,
  onSelect,
}: {
  analise: AnalysisResult;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  const tom: Tom = analise.trust_score >= 70 ? 'health' : analise.trust_score >= 40 ? 'warn' : 'risk';
  return (
    <Secao titulo="Índice de confiança (rapport)" icone={<ShieldCheck size={14} />}>
      <div className="mb-3 flex items-center gap-3">
        <Mono tom={tom} className="text-2xl">
          {analise.trust_score}
        </Mono>
        <div className="flex-1">
          <BarraScore valor={analise.trust_score} tom={tom} />
        </div>
      </div>
      {analise.trust_signals.length > 0 ? (
        <div className="space-y-1.5">
          {analise.trust_signals.map((s, i) => (
            <ItemEv key={`${s.label}-${i}`} ev={s.evidence} sel={sel} onSelect={onSelect}>
              <span className="flex items-center justify-between gap-2">
                <span>{s.label}</span>
                <Mono tom={s.delta >= 0 ? 'health' : 'risk'} className="text-[11px]">
                  {s.delta >= 0 ? '+' : ''}
                  {s.delta}
                </Mono>
              </span>
            </ItemEv>
          ))}
        </div>
      ) : (
        <Vazio>Nenhum sinal de confiança detectado nesta reunião.</Vazio>
      )}
    </Secao>
  );
}

function Sentimento({
  analise,
  sel,
  onSelect,
}: {
  analise: AnalysisResult;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  const s = SENTIMENTO[analise.sentiment] ?? SENTIMENTO.neutro;
  return (
    <Secao titulo="Sentimento" icone={<Gauge size={14} />}>
      <div className="mb-3 flex items-center gap-2">
        <Badge tom={s.tom}>{s.rotulo}</Badge>
        <span className="text-[11px] text-ink-faint">
          global {analise.sentiment_score >= 0 ? '+' : ''}
          {analise.sentiment_score.toFixed(2)}
        </span>
      </div>
      {analise.aspect_sentiment.length > 0 ? (
        <div className="space-y-1.5">
          {analise.aspect_sentiment.map((a, i) => {
            const t = SENTIMENTO[a.polarity] ?? SENTIMENTO.neutro;
            return (
              <ItemEv key={`${a.aspect}-${i}`} ev={a.evidence} sel={sel} onSelect={onSelect}>
                <span className="flex items-center gap-2">
                  <Badge tom={t.tom}>{t.rotulo}</Badge>
                  <span className="font-medium">{a.aspect}</span>
                </span>
              </ItemEv>
            );
          })}
        </div>
      ) : (
        <Vazio>Sentimento sem decomposição por aspecto.</Vazio>
      )}
    </Secao>
  );
}

function Persona({
  analise,
  onSelect,
}: {
  analise: AnalysisResult;
  onSelect: (e: Evidence | undefined) => void;
}) {
  const p = analise.persona;
  return (
    <Secao titulo="Persona" icone={<Building2 size={14} />}>
      <button
        type="button"
        disabled={!p.evidence?.quote}
        onClick={() => onSelect(p.evidence)}
        className={`w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-left ${
          p.evidence?.quote ? 'hover:border-line-strong' : ''
        }`}
      >
        <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-ink">
          {p.name ? <span className="font-medium">{p.name}</span> : null}
          {p.role ? <span className="text-ink-dim">· {p.role}</span> : null}
          <Badge tom={p.decision_power === 'decisor' ? 'accent' : 'neutro'}>
            {PODER[p.decision_power] ?? p.decision_power}
          </Badge>
        </div>
        {p.evidence?.quote ? (
          <p className="mt-1 font-mono text-[11px] italic text-ink-faint">“{p.evidence.quote}”</p>
        ) : null}
      </button>
    </Secao>
  );
}

function Ecossistema({
  analise,
  sel,
  onSelect,
}: {
  analise: AnalysisResult;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  return (
    <Secao titulo="Ecossistema TOTVS" icone={<Target size={14} />} contador={analise.totvs_products.length}>
      {analise.totvs_products.length > 0 ? (
        <div className="space-y-1.5">
          {analise.totvs_products.map((p, i) => {
            const st = STATUS_PRODUTO[p.status] ?? STATUS_PRODUTO.mencionado;
            return (
              <ItemEv key={`${p.name}-${i}`} ev={p.evidence} sel={sel} onSelect={onSelect} campo="produto" valor={p.name}>
                <span className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{p.name}</span>
                  <Badge tom={st.tom}>{st.rotulo}</Badge>
                  {p.unit !== 'indefinido' ? (
                    <span className="text-[11px] text-ink-faint">{UNIDADE[p.unit]}</span>
                  ) : null}
                </span>
              </ItemEv>
            );
          })}
        </div>
      ) : (
        <Vazio>Nenhum produto TOTVS identificado no diálogo.</Vazio>
      )}
    </Secao>
  );
}

function Oportunidades({
  analise,
  sel,
  onSelect,
}: {
  analise: AnalysisResult;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  return (
    <Secao titulo="Oportunidades" icone={<TrendingUp size={14} />} contador={analise.opportunities.length}>
      {analise.opportunities.length > 0 ? (
        <div className="space-y-1.5">
          {analise.opportunities.map((o, i) => (
            <ItemEv key={`${o.product}-${i}`} ev={o.evidence} sel={sel} onSelect={onSelect} campo="oportunidade" valor={o.product}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{o.product}</span>
                {o.unit !== 'indefinido' ? <Badge tom="accent">{UNIDADE[o.unit]}</Badge> : null}
                <span className="ml-auto font-mono text-[11px] text-ink-dim">prob. {pct(o.probability)}</span>
                {o.estimated_value ? (
                  <Mono tom="health" className="text-[11px]">
                    {fmtBRL(o.estimated_value)}
                  </Mono>
                ) : null}
              </div>
              {o.rationale ? <p className="mt-0.5 text-[11.5px] text-ink-dim">{o.rationale}</p> : null}
            </ItemEv>
          ))}
        </div>
      ) : (
        <Vazio>Nenhum gatilho de compra detectado.</Vazio>
      )}
    </Secao>
  );
}

function Concorrentes({
  analise,
  sel,
  onSelect,
}: {
  analise: AnalysisResult;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  return (
    <Secao titulo="Concorrentes" icone={<Swords size={14} />} contador={analise.competitors.length}>
      {analise.competitors.length > 0 ? (
        <div className="space-y-1.5">
          {analise.competitors.map((c, i) => (
            <ItemEv key={`${c.name}-${i}`} ev={c.evidence} sel={sel} onSelect={onSelect} campo="concorrente" valor={c.name}>
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.name}</span>
                <Badge tom={c.active ? SEVERIDADE[c.threat] ?? 'neutro' : 'neutro'}>
                  {c.active ? `ameaça ${c.threat}` : 'histórico'}
                </Badge>
                {!c.active ? (
                  <span className="inline-flex items-center gap-1 text-[11px] text-ink-faint">
                    <Ban size={11} /> não é ameaça ativa
                  </span>
                ) : null}
                {c.context ? <span className="text-[11px] text-ink-faint">· {c.context}</span> : null}
              </span>
            </ItemEv>
          ))}
        </div>
      ) : (
        <Vazio>Nenhum concorrente citado.</Vazio>
      )}
    </Secao>
  );
}

function ListaSinais({
  titulo,
  sinais,
  tom,
  sel,
  onSelect,
}: {
  titulo: string;
  sinais: AnalysisResult['churn_signals'];
  tom: Tom;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">{titulo}</p>
      {sinais.length > 0 ? (
        <div className="space-y-1.5">
          {sinais.map((s, i) => (
            <ItemEv key={i} ev={s.evidence} sel={sel} onSelect={onSelect}>
              <span className="flex items-center justify-between gap-2">
                <span>{s.text}</span>
                <Mono tom={tom} className="shrink-0 text-[11px]">
                  {s.weight}
                </Mono>
              </span>
            </ItemEv>
          ))}
        </div>
      ) : (
        <Vazio>Nenhum.</Vazio>
      )}
    </div>
  );
}

function SinaisChurnUpsell({
  analise,
  sel,
  onSelect,
}: {
  analise: AnalysisResult;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  return (
    <Secao titulo="Sinais" icone={<TriangleAlert size={14} />}>
      <div className="grid gap-4 sm:grid-cols-2">
        <ListaSinais titulo="Churn" sinais={analise.churn_signals} tom="risk" sel={sel} onSelect={onSelect} />
        <ListaSinais titulo="Upsell" sinais={analise.upsell_signals} tom="health" sel={sel} onSelect={onSelect} />
      </div>
    </Secao>
  );
}

function GrupoTexto({
  titulo,
  itens,
  sel,
  onSelect,
  render,
}: {
  titulo: string;
  itens: { evidence: Evidence }[];
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
  render: (item: { evidence: Evidence }) => ReactNode;
}) {
  if (itens.length === 0) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-faint">
        {titulo} <span className="text-ink-faint">· {itens.length}</span>
      </p>
      <div className="space-y-1.5">
        {itens.map((it, i) => (
          <ItemEv key={i} ev={it.evidence} sel={sel} onSelect={onSelect}>
            {render(it)}
          </ItemEv>
        ))}
      </div>
    </div>
  );
}

function Extracoes({
  analise,
  sel,
  onSelect,
}: {
  analise: AnalysisResult;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  const vazio =
    analise.customer_needs.length === 0 &&
    analise.problems.length === 0 &&
    analise.objections.length === 0 &&
    analise.decisions.length === 0 &&
    analise.next_steps.length === 0 &&
    analise.risks.length === 0;

  return (
    <Secao titulo="Extração da conversa" icone={<MessagesSquare size={14} />}>
      {vazio ? (
        <Vazio>Nada extraído além dos blocos acima.</Vazio>
      ) : (
        <div className="space-y-4">
          <GrupoTexto
            titulo="Necessidades"
            itens={analise.customer_needs}
            sel={sel}
            onSelect={onSelect}
            render={(n) => (n as (typeof analise.customer_needs)[number]).text}
          />
          <GrupoTexto
            titulo="Problemas / dores"
            itens={analise.problems}
            sel={sel}
            onSelect={onSelect}
            render={(p) => {
              const item = p as (typeof analise.problems)[number];
              return (
                <span className="flex items-center justify-between gap-2">
                  <span>{item.text}</span>
                  <span className="shrink-0 rounded bg-surface-3 px-1.5 py-0.5 text-[10px] uppercase text-ink-faint">
                    {item.category}
                  </span>
                </span>
              );
            }}
          />
          <GrupoTexto
            titulo="Objeções"
            itens={analise.objections}
            sel={sel}
            onSelect={onSelect}
            render={(o) => {
              const item = o as (typeof analise.objections)[number];
              return (
                <span className="flex flex-wrap items-center gap-2">
                  <span>{item.text}</span>
                  <Badge tom={item.resolved ? 'health' : 'warn'}>{item.category}</Badge>
                  {item.resolved ? (
                    <span className="text-[10px] text-health">resolvida</span>
                  ) : (
                    <span className="text-[10px] text-warn">em aberto</span>
                  )}
                </span>
              );
            }}
          />
          <GrupoTexto
            titulo="Decisões"
            itens={analise.decisions}
            sel={sel}
            onSelect={onSelect}
            render={(d) => (d as (typeof analise.decisions)[number]).text}
          />
          {/* Próximos passos subiu para o painel "O que fazer". */}
          <GrupoTexto
            titulo="Riscos"
            itens={analise.risks}
            sel={sel}
            onSelect={onSelect}
            render={(r) => {
              const item = r as (typeof analise.risks)[number];
              return (
                <span className="flex items-center justify-between gap-2">
                  <span>{item.text}</span>
                  <Badge tom={SEVERIDADE[item.severity] ?? 'neutro'}>{item.severity}</Badge>
                </span>
              );
            }}
          />
        </div>
      )}
    </Secao>
  );
}

function Tarefas({
  analise,
  sel,
  onSelect,
}: {
  analise: AnalysisResult;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  return (
    <Secao titulo="Tarefas" icone={<CheckCircle2 size={14} />} contador={analise.action_items.length}>
      {analise.action_items.length > 0 ? (
        <div className="space-y-1.5">
          {analise.action_items.map((t, i) => (
            <ItemEv key={i} ev={t.evidence} sel={sel} onSelect={onSelect} campo="tarefa" valor={t.description}>
              <div className="flex flex-wrap items-center gap-2">
                <span>{t.description}</span>
                <Badge tom={t.side === 'interno' ? 'accent' : 'neutro'}>
                  {t.side === 'interno' ? 'nosso' : 'cliente'}
                </Badge>
                {t.responsible ? <span className="text-[11px] text-ink-faint">{t.responsible}</span> : null}
                {t.due_date ? (
                  <span className="ml-auto font-mono text-[11px] text-warn">{t.due_date}</span>
                ) : null}
              </div>
            </ItemEv>
          ))}
        </div>
      ) : (
        <Vazio>Nenhum compromisso datado — a reunião terminou sem próximo passo claro.</Vazio>
      )}
    </Secao>
  );
}

function Financeiro({
  analise,
  sel,
  onSelect,
}: {
  analise: AnalysisResult;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  if (analise.budget.length === 0) return null;
  return (
    <Secao titulo="Budget" icone={<BadgeDollarSign size={14} />}>
      <div className="space-y-1.5">
        {analise.budget.map((b, i) => (
          <ItemEv key={i} ev={b.evidence} sel={sel} onSelect={onSelect} campo="budget" valor={b.amount ?? b.raw}>
            <span className="flex flex-wrap items-center gap-2">
              <Mono tom="health" className="text-[14px]">
                {b.amount != null ? fmtBRL(b.amount) : b.raw}
              </Mono>
              <Badge tom="neutro">{b.kind}</Badge>
              {b.confidential ? (
                <span className="inline-flex items-center gap-1 rounded border border-warn/40 bg-warn-soft px-1.5 py-0.5 text-[10px] font-medium text-warn">
                  <Lock size={10} /> sigiloso
                </span>
              ) : null}
            </span>
          </ItemEv>
        ))}
      </div>
    </Secao>
  );
}

function Voz({
  analise,
  sel,
  onSelect,
}: {
  analise: AnalysisResult;
  sel: Sel;
  onSelect: (e: Evidence | undefined) => void;
}) {
  if (analise.voice_of_customer.length === 0) return null;
  return (
    <Secao titulo="Voz do cliente" icone={<Quote size={14} />} contador={analise.voice_of_customer.length}>
      <div className="space-y-1.5">
        {analise.voice_of_customer.map((v, i) => (
          <ItemEv key={i} ev={v.evidence} sel={sel} onSelect={onSelect}>
            <span className="flex flex-wrap items-center gap-2">
              <Badge tom="ai">{v.type.replace('_', ' ')}</Badge>
              {v.target ? <span className="text-[11px] text-ink-faint">{v.target}</span> : null}
              <span>{v.text}</span>
            </span>
          </ItemEv>
        ))}
      </div>
    </Secao>
  );
}

function Metrica({ rotulo, valor }: { rotulo: string; valor: ReactNode }) {
  return (
    <div className="rounded-md border border-line bg-surface-2 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-ink-faint">{rotulo}</p>
      <p className="mt-1 font-mono text-[15px] tabular-nums text-ink">{valor}</p>
    </div>
  );
}

function Conversa({ analise }: { analise: AnalysisResult }) {
  const m = analise.conversation_metrics;
  const semDiarizacao = m.talk_ratio_seller == null;
  const b = analise.bant;
  return (
    <Secao titulo="Métricas de conversa" icone={<Gauge size={14} />}>
      {semDiarizacao ? (
        <p className="mb-3 flex items-start gap-2 rounded-md border border-warn/30 bg-warn-soft/30 px-3 py-2 text-[11.5px] text-warn">
          <TriangleAlert size={13} className="mt-0.5 shrink-0" />
          Transcrição sem marcação de falante: talk ratio e perguntas não podem ser medidos sem inventar turnos.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metrica
            rotulo="Talk ratio vendedor"
            valor={m.talk_ratio_seller != null ? pct(m.talk_ratio_seller) : '—'}
          />
          <Metrica rotulo="Perguntas" valor={m.seller_questions ?? '—'} />
          <Metrica rotulo="Abertas / fechadas" valor={`${m.open_questions ?? 0}/${m.closed_questions ?? 0}`} />
          <Metrica rotulo="Maior monólogo" valor={`${m.longest_monologue_words ?? 0}p`} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-ink-faint">BANT</span>
        <Mono tom={b.score >= 3 ? 'health' : b.score >= 2 ? 'warn' : 'risk'}>{b.score}/4</Mono>
        {(['budget', 'authority', 'need', 'timeline'] as const).map((k) => (
          <Badge key={k} tom={b[k] ? 'health' : 'neutro'}>
            {k}
          </Badge>
        ))}
        {b.missing.length > 0 ? (
          <span className="text-[11px] text-ink-faint">falta: {b.missing.join(', ')}</span>
        ) : null}
      </div>
    </Secao>
  );
}

function ValorNegocio({ analise }: { analise: AnalysisResult }) {
  const v = analise.business_value;
  return (
    <Secao titulo="Valor de negócio" icone={<CircleDollarSign size={14} />}>
      <div className="grid grid-cols-2 gap-2">
        <Metrica
          rotulo="Receita em risco"
          valor={<span className={v.revenue_at_risk ? 'text-risk' : ''}>{fmtBRL(v.revenue_at_risk)}</span>}
        />
        <Metrica
          rotulo="Pipeline identificado"
          valor={<span className={v.pipeline_value ? 'text-health' : ''}>{fmtBRL(v.pipeline_value)}</span>}
        />
      </div>
      {v.assumptions.length > 0 ? (
        <ul className="mt-3 space-y-1">
          {v.assumptions.map((a, i) => (
            <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-ink-faint">
              <span className="mt-[6px] size-1 shrink-0 rounded-full bg-ink-faint" />
              {a}
            </li>
          ))}
        </ul>
      ) : null}
    </Secao>
  );
}
