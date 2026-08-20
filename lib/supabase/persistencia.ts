import { supabaseServer } from './server';
import type {
  ActionItemRow,
  AlertRow,
  AnalysisRow,
  Json,
  MeetingRow,
  TranscriptRow,
} from './database.types';
import { analisar, preparar } from '@/lib/analysis';
import type {
  AnalysisResult,
  Concorrente,
  Evidence,
  Motor,
  Oportunidade,
} from '@/lib/analysis';

/**
 * Camada de ESCRITA e leitura consolidada do InsightIQ.
 *
 * Regras do produto que este módulo materializa:
 *  - Banco só pelo servidor (importa supabaseServer, que guarda contra o cliente).
 *  - O que é guardado e exibido é o texto ANONIMIZADO (textoSeguro). Os offsets de
 *    evidência do motor apontam para ele, então é ele que vai em transcripts.raw_text
 *    e é sobre ele que o briefing destaca as citações. O PII original nunca é gravado.
 *  - Nenhum item sem evidência entra no briefing — isso já é garantido pelo motor.
 */

/** Facilita jogar estruturas tipadas nas colunas jsonb sem poluir com casts soltos. */
const j = (v: unknown): Json => v as unknown as Json;

/* ------------------------------------------------------------------ *
 * Bootstrap — a base começa vazia; toda reunião precisa de org e dono.
 * ------------------------------------------------------------------ */

const ORG_SLUG = 'totvs';
const ANA_EMAIL = 'ana.torres@totvs.example';

export type Contexto = { orgId: string; userId: string };

/**
 * Garante a organização TOTVS e a executiva de contas Ana Torres (a usuária
 * principal do produto, persona da Entrega 1). Idempotente: roda em toda
 * ingestão e nunca duplica.
 */
export async function garantirOrgEUsuaria(): Promise<Contexto> {
  const sb = supabaseServer();

  const existente = await sb
    .from('organizations')
    .select('id')
    .eq('slug', ORG_SLUG)
    .maybeSingle();
  if (existente.error) throw new Error(`Falha ao ler organização: ${existente.error.message}`);

  let orgId = existente.data?.id;
  if (!orgId) {
    const criada = await sb
      .from('organizations')
      .insert({ name: 'TOTVS', slug: ORG_SLUG })
      .select('id')
      .single();
    if (criada.error) throw new Error(`Falha ao criar organização: ${criada.error.message}`);
    orgId = criada.data.id;
  }

  const usuaria = await sb
    .from('app_users')
    .select('id')
    .eq('org_id', orgId)
    .eq('email', ANA_EMAIL)
    .maybeSingle();
  if (usuaria.error) throw new Error(`Falha ao ler usuária: ${usuaria.error.message}`);

  let userId = usuaria.data?.id;
  if (!userId) {
    const criada = await sb
      .from('app_users')
      .insert({ org_id: orgId, name: 'Ana Torres', email: ANA_EMAIL, role: 'vendedor' })
      .select('id')
      .single();
    if (criada.error) throw new Error(`Falha ao criar usuária: ${criada.error.message}`);
    userId = criada.data.id;
  }

  return { orgId, userId };
}

/**
 * Vincula a reunião a um cliente pelo nome, criando um registro mínimo se ainda
 * não existir. A memória do cliente (health score, stack, histórico) é populada
 * na Fase 4 — aqui só garantimos a entidade para a reunião não ficar órfã.
 */
async function upsertCliente(
  ctx: Contexto,
  nome: string | undefined,
  ownerId: string,
): Promise<string | null> {
  const limpo = nome?.trim();
  if (!limpo) return null;

  const sb = supabaseServer();
  const existente = await sb
    .from('customers')
    .select('id')
    .eq('org_id', ctx.orgId)
    .ilike('name', limpo)
    .maybeSingle();
  if (existente.error) throw new Error(`Falha ao ler cliente: ${existente.error.message}`);
  if (existente.data?.id) return existente.data.id;

  const criado = await sb
    .from('customers')
    .insert({ org_id: ctx.orgId, name: limpo, owner_id: ownerId })
    .select('id')
    .single();
  if (criado.error) throw new Error(`Falha ao criar cliente: ${criado.error.message}`);
  return criado.data.id;
}

/* ------------------------------------------------------------------ *
 * Evidência agregada e alertas — derivados da análise.
 * ------------------------------------------------------------------ */

type EvidenciaAgregada = { field: string; quote: string; start: number; end: number; speaker?: string };

/**
 * Índice plano de todas as citações da análise. Serve de atalho para auditoria
 * e mantém a promessa "todo item carrega evidência" verificável numa coluna só.
 */
function agregarEvidencia(a: AnalysisResult): EvidenciaAgregada[] {
  const saida: EvidenciaAgregada[] = [];
  const add = (field: string, ev?: Evidence) => {
    if (ev && ev.quote) saida.push({ field, quote: ev.quote, start: ev.start, end: ev.end, speaker: ev.speaker });
  };

  a.totvs_products.forEach((p) => add('produto', p.evidence));
  a.opportunities.forEach((o) => add('oportunidade', o.evidence));
  a.competitors.forEach((c) => add('concorrente', c.evidence));
  a.churn_signals.forEach((s) => add('churn', s.evidence));
  a.upsell_signals.forEach((s) => add('upsell', s.evidence));
  a.customer_needs.forEach((n) => add('necessidade', n.evidence));
  a.problems.forEach((p) => add('problema', p.evidence));
  a.decisions.forEach((d) => add('decisao', d.evidence));
  a.objections.forEach((o) => add('objecao', o.evidence));
  a.next_steps.forEach((n) => add('proximo_passo', n.evidence));
  a.risks.forEach((r) => add('risco', r.evidence));
  a.action_items.forEach((t) => add('tarefa', t.evidence));
  a.budget.forEach((b) => add('budget', b.evidence));
  a.aspect_sentiment.forEach((s) => add('sentimento_aspecto', s.evidence));
  a.voice_of_customer.forEach((v) => add('voz_do_cliente', v.evidence));
  a.trust_signals.forEach((s) => add('confianca', s.evidence));
  if (a.persona.evidence) add('persona', a.persona.evidence);

  return saida;
}

type AlertaInsert = {
  org_id: string;
  customer_id: string | null;
  meeting_id: string;
  kind: AlertRow['kind'];
  severity: 'alta' | 'media' | 'baixa';
  audience: 'vendedor' | 'gestor' | 'diretor';
  title: string;
  message: string;
  evidence: string | null;
  value_at_stake: number | null;
};

const rotuloCliente = (nome: string | null) => nome ?? 'este cliente';
const peso = (t: 'alta' | 'media' | 'baixa') => (t === 'alta' ? 3 : t === 'media' ? 2 : 1);

/**
 * Alertas são efeito colateral natural da análise — este é o momento certo de
 * gerá-los. Cobre a história ALTA "Alerta de Churn" e alimenta o painel /alertas.
 */
function montarAlertas(
  a: AnalysisResult,
  ref: { orgId: string; customerId: string | null; meetingId: string; clienteNome: string | null },
): AlertaInsert[] {
  const alertas: AlertaInsert[] = [];
  const base = { org_id: ref.orgId, customer_id: ref.customerId, meeting_id: ref.meetingId };

  if (a.churn_risk >= 67) {
    const sinal = [...a.churn_signals].sort((x, y) => y.weight - x.weight)[0];
    alertas.push({
      ...base,
      kind: 'churn',
      severity: 'alta',
      audience: 'gestor',
      title: `Risco de churn alto — ${rotuloCliente(ref.clienteNome)}`,
      message: sinal
        ? `Risco ${a.churn_risk}/100. Sinal mais forte: "${sinal.text}".`
        : `Risco de churn em ${a.churn_risk}/100 nesta reunião.`,
      evidence: sinal?.evidence.quote ?? null,
      value_at_stake: a.business_value.revenue_at_risk,
    });
  }

  const concorrenteAtivo: Concorrente | undefined = a.competitors
    .filter((c) => c.active)
    .sort((x, y) => peso(y.threat) - peso(x.threat))[0];
  if (concorrenteAtivo) {
    alertas.push({
      ...base,
      kind: 'concorrente',
      severity: concorrenteAtivo.threat,
      audience: 'gestor',
      title: `Concorrente ativo: ${concorrenteAtivo.name}`,
      message: concorrenteAtivo.context || `${concorrenteAtivo.name} apareceu em contexto comparativo.`,
      evidence: concorrenteAtivo.evidence.quote,
      value_at_stake: null,
    });
  }

  const oportunidade: Oportunidade | undefined = a.opportunities
    .filter((o) => o.probability >= 0.6)
    .sort((x, y) => y.probability - x.probability)[0];
  if (oportunidade) {
    alertas.push({
      ...base,
      kind: 'oportunidade',
      severity: 'media',
      audience: 'vendedor',
      title: `Oportunidade: ${oportunidade.product}`,
      message: oportunidade.rationale,
      evidence: oportunidade.evidence.quote,
      value_at_stake: oportunidade.estimated_value ?? null,
    });
  }

  return alertas;
}

/* ------------------------------------------------------------------ *
 * Ingestão — o coração da Fase 3.
 * ------------------------------------------------------------------ */

export type EntradaIngestao = {
  titulo: string;
  tipo: MeetingRow['meeting_type'];
  data: string; // ISO yyyy-mm-dd
  clienteNome?: string;
  texto: string;
};

/**
 * Fluxo completo: cria a reunião, roda o motor, persiste transcript + análise +
 * tarefas + alertas e marca a reunião como analisada. Devolve o id para a UI
 * redirecionar ao briefing. Em falha, marca a reunião como 'error' com a mensagem.
 */
export async function criarReuniaoComAnalise(entrada: EntradaIngestao): Promise<string> {
  const sb = supabaseServer();
  const ctx = await garantirOrgEUsuaria();
  const customerId = await upsertCliente(ctx, entrada.clienteNome, ctx.userId);

  const criada = await sb
    .from('meetings')
    .insert({
      org_id: ctx.orgId,
      customer_id: customerId,
      owner_id: ctx.userId,
      title: entrada.titulo,
      meeting_type: entrada.tipo,
      meeting_date: entrada.data,
      source: 'paste',
      status: 'analyzing',
    })
    .select('id')
    .single();
  if (criada.error) throw new Error(`Falha ao criar reunião: ${criada.error.message}`);
  const meetingId = criada.data.id;

  try {
    // Um único preparo determinístico. analisar() reprepara com o mesmo texto e,
    // sendo determinístico, produz offsets idênticos aos deste prep.
    const prep = preparar(entrada.texto);
    const analise = analisar({ texto: entrada.texto, dataReuniao: entrada.data });

    const transcript = await sb.from('transcripts').insert({
      meeting_id: meetingId,
      raw_text: prep.textoSeguro, // anonimizado — é o que a UI exibe e o alvo dos offsets
      clean_text: prep.textoLimpo,
      language: 'pt-BR',
      word_count: analise.transcript_quality.word_count,
      turn_count: analise.transcript_quality.turn_count,
      speakers: j(
        prep.falantes.map((f) => ({
          name: f.nome,
          side: f.lado,
          words: f.palavras,
          turns: f.turnos,
          confidence: f.confianca,
        })),
      ),
      redactions: j(prep.redacoes),
      quality: j(analise.transcript_quality),
      stt_provider: null,
    });
    if (transcript.error) throw new Error(`Falha ao gravar transcrição: ${transcript.error.message}`);

    const analiseInsert = await sb
      .from('analyses')
      .insert({
        meeting_id: meetingId,
        engine: analise.engine,
        model: analise.model ?? null,
        summary: analise.summary,
        customer_needs: j(analise.customer_needs),
        problems: j(analise.problems),
        decisions: j(analise.decisions),
        objections: j(analise.objections),
        next_steps: j(analise.next_steps),
        opportunities: j(analise.opportunities),
        risks: j(analise.risks),
        totvs_products: j(analise.totvs_products),
        competitors: j(analise.competitors),
        budget: j(analise.budget),
        persona: j(analise.persona),
        sentiment: analise.sentiment,
        sentiment_score: analise.sentiment_score,
        aspect_sentiment: j(analise.aspect_sentiment),
        interest_score: analise.interest_score,
        churn_risk: analise.churn_risk,
        churn_signals: j(analise.churn_signals),
        upsell_signals: j(analise.upsell_signals),
        trust_score: analise.trust_score,
        trust_signals: j(analise.trust_signals),
        conversation_metrics: j(analise.conversation_metrics),
        bant: j(analise.bant),
        voice_of_customer: j(analise.voice_of_customer),
        business_value: j(analise.business_value),
        score_factors: j(analise.score_factors),
        churn_factors: j(analise.churn_factors),
        evidence: j(agregarEvidencia(analise)),
        latency_ms: analise.latency_ms,
        token_cost: 0, // motor determinístico: custo de API R$ 0,00
      })
      .select('id')
      .single();
    if (analiseInsert.error) throw new Error(`Falha ao gravar análise: ${analiseInsert.error.message}`);

    if (analise.action_items.length > 0) {
      const tarefas = await sb.from('action_items').insert(
        analise.action_items.map((t) => ({
          org_id: ctx.orgId,
          meeting_id: meetingId,
          customer_id: customerId,
          description: t.description,
          responsible: t.responsible,
          side: t.side,
          due_date: t.due_date,
          evidence: t.evidence.quote,
        })),
      );
      if (tarefas.error) throw new Error(`Falha ao gravar tarefas: ${tarefas.error.message}`);
    }

    const alertas = montarAlertas(analise, {
      orgId: ctx.orgId,
      customerId,
      meetingId,
      clienteNome: entrada.clienteNome?.trim() || null,
    });
    if (alertas.length > 0) {
      const ins = await sb.from('alerts').insert(alertas);
      if (ins.error) throw new Error(`Falha ao gravar alertas: ${ins.error.message}`);
    }

    const dur = Math.round(analise.transcript_quality.estimated_minutes);
    const fim = await sb
      .from('meetings')
      .update({ status: 'analyzed', duration_min: dur > 0 ? dur : null })
      .eq('id', meetingId);
    if (fim.error) throw new Error(`Falha ao finalizar reunião: ${fim.error.message}`);

    return meetingId;
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro desconhecido na análise.';
    await sb.from('meetings').update({ status: 'error', error_message: mensagem }).eq('id', meetingId);
    throw erro;
  }
}

/* ------------------------------------------------------------------ *
 * Leitura consolidada para o briefing.
 * ------------------------------------------------------------------ */

export type DadosBriefing = {
  reuniao: Pick<MeetingRow, 'id' | 'title' | 'meeting_type' | 'meeting_date' | 'status' | 'duration_min'> & {
    cliente: string | null;
  };
  transcricao: string;
  qualidade: TranscriptRow['quality'];
  analise: AnalysisResult | null;
};

/**
 * Reconstrói o AnalysisResult tipado a partir do banco.
 *
 * Dois campos não moram na linha de `analyses`:
 *  - transcript_quality vive em transcripts.quality (passado em `quality`).
 *  - action_items são entidades próprias (tabela action_items). Elas guardam a
 *    citação como texto; como toda citação é substring literal do texto seguro,
 *    reencontramos os offsets por indexOf para o destaque continuar funcionando.
 */
function linhaParaAnalise(
  r: AnalysisRow,
  quality: Json,
  tarefas: ActionItemRow[],
  texto: string,
): AnalysisResult {
  const a = <T>(v: Json): T => v as unknown as T;
  const localizar = (quote: string): Evidence => {
    const start = quote ? texto.indexOf(quote) : -1;
    return start >= 0 ? { quote, start, end: start + quote.length } : { quote, start: 0, end: 0 };
  };

  return {
    summary: r.summary,
    totvs_products: a(r.totvs_products),
    opportunities: a(r.opportunities),
    competitors: a(r.competitors),
    churn_signals: a(r.churn_signals),
    upsell_signals: a(r.upsell_signals),
    customer_needs: a(r.customer_needs),
    problems: a(r.problems),
    decisions: a(r.decisions),
    objections: a(r.objections),
    next_steps: a(r.next_steps),
    risks: a(r.risks),
    action_items: tarefas.map((t) => ({
      description: t.description,
      responsible: t.responsible,
      side: (t.side === 'cliente' ? 'cliente' : 'interno') as 'interno' | 'cliente',
      due_date: t.due_date,
      evidence: localizar(t.evidence ?? ''),
    })),
    budget: a(r.budget),
    persona: a(r.persona),
    sentiment: r.sentiment as AnalysisResult['sentiment'],
    sentiment_score: r.sentiment_score,
    aspect_sentiment: a(r.aspect_sentiment),
    voice_of_customer: a(r.voice_of_customer),
    trust_score: r.trust_score,
    trust_signals: a(r.trust_signals),
    conversation_metrics: a(r.conversation_metrics),
    transcript_quality: a(quality),
    bant: a(r.bant),
    interest_score: r.interest_score,
    churn_risk: r.churn_risk,
    score_factors: a(r.score_factors),
    churn_factors: a(r.churn_factors),
    business_value: a(r.business_value),
    engine: r.engine as Motor,
    model: r.model ?? undefined,
    latency_ms: r.latency_ms ?? 0,
  };
}

export async function carregarBriefing(meetingId: string): Promise<DadosBriefing | null> {
  const sb = supabaseServer();

  const reuniao = await sb
    .from('meetings')
    .select('id, title, meeting_type, meeting_date, status, duration_min, customer_id')
    .eq('id', meetingId)
    .maybeSingle();
  if (reuniao.error) throw new Error(`Falha ao carregar reunião: ${reuniao.error.message}`);
  if (!reuniao.data) return null;
  const m = reuniao.data;

  let cliente: string | null = null;
  if (m.customer_id) {
    const c = await sb.from('customers').select('name').eq('id', m.customer_id).maybeSingle();
    if (c.error) throw new Error(`Falha ao carregar cliente: ${c.error.message}`);
    cliente = c.data?.name ?? null;
  }

  const [transcript, analise, tarefas] = await Promise.all([
    sb.from('transcripts').select('raw_text, quality').eq('meeting_id', meetingId).maybeSingle(),
    sb
      .from('analyses')
      .select('*')
      .eq('meeting_id', meetingId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb.from('action_items').select('*').eq('meeting_id', meetingId).order('created_at'),
  ]);
  if (transcript.error) throw new Error(`Falha ao carregar transcrição: ${transcript.error.message}`);
  if (analise.error) throw new Error(`Falha ao carregar análise: ${analise.error.message}`);
  if (tarefas.error) throw new Error(`Falha ao carregar tarefas: ${tarefas.error.message}`);

  const texto = transcript.data?.raw_text ?? '';
  const quality: Json = transcript.data?.quality ?? {};

  return {
    reuniao: {
      id: m.id,
      title: m.title,
      meeting_type: m.meeting_type,
      meeting_date: m.meeting_date,
      status: m.status,
      duration_min: m.duration_min,
      cliente,
    },
    transcricao: texto,
    qualidade: quality,
    analise: analise.data
      ? linhaParaAnalise(analise.data as AnalysisRow, quality, (tarefas.data ?? []) as ActionItemRow[], texto)
      : null,
  };
}
