import { supabaseServer } from './supabase/server';
import type { ActionItemRow, AnalysisRow, CustomerRow, Json, MeetingRow } from './supabase/database.types';
import { calcularHealth, type ResultadoHealth } from './health';
import type {
  Bant,
  BusinessUnit,
  CategoriaObjecao,
  Concorrente,
  Decisao,
  MemoriaCliente,
  Necessidade,
  Objecao,
  Persona,
  ProdutoTotvs,
  StatusProduto,
} from './analysis';

/**
 * Camada 2 — memória do cliente.
 *
 * A análise de uma reunião isolada não sabe que "preço" já apareceu em três das
 * quatro últimas conversas. Este módulo lê o histórico do cliente no Postgres e
 * o consolida em dois formatos:
 *
 *  - `MemoriaCliente`, injetada no motor a cada nova análise (o motor usa isso
 *    no cálculo de churn: queda de interesse, objeção recorrente, promessa
 *    atrasada);
 *  - `VisaoCliente`, o modelo de leitura das telas de cliente e de preparação.
 *
 * Uma única carga do histórico alimenta os dois — a tela e o motor enxergam
 * exatamente o mesmo passado.
 */

/* ------------------------------------------------------------------ *
 * Utilidades
 * ------------------------------------------------------------------ */

const semAcento = (s: string): string =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Chave de agrupamento: tolera pontuação e caixa, mas não junta coisas distintas. */
const chave = (s: string): string => semAcento(s).replace(/[^\p{L}\p{N} ]/gu, '');

const HOJE = () => new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00');

export function diasEntre(dataISO: string, referencia = HOJE()): number {
  const d = new Date(`${dataISO.slice(0, 10)}T00:00:00`);
  return Math.round((referencia.getTime() - d.getTime()) / 86_400_000);
}

const parse = <T>(v: Json, padrao: T): T => (v == null ? padrao : (v as unknown as T));

/* ------------------------------------------------------------------ *
 * Carga do histórico
 * ------------------------------------------------------------------ */

export type ReuniaoHistorico = {
  id: string;
  title: string;
  meeting_type: string;
  meeting_date: string;
  status: string;
  analise: AnalysisRow | null;
};

export type Historico = {
  cliente: CustomerRow;
  reunioes: ReuniaoHistorico[];
  tarefas: ActionItemRow[];
};

/** Carrega cliente, reuniões (mais antiga → mais nova), análises e tarefas. */
export async function carregarHistorico(customerId: string): Promise<Historico | null> {
  const sb = supabaseServer();

  const cliente = await sb.from('customers').select('*').eq('id', customerId).maybeSingle();
  if (cliente.error) throw new Error(`Falha ao carregar cliente: ${cliente.error.message}`);
  if (!cliente.data) return null;

  const [reunioes, tarefas] = await Promise.all([
    sb
      .from('meetings')
      .select('id, title, meeting_type, meeting_date, status')
      .eq('customer_id', customerId)
      .order('meeting_date', { ascending: true }),
    sb.from('action_items').select('*').eq('customer_id', customerId).order('due_date'),
  ]);
  if (reunioes.error) throw new Error(`Falha ao carregar reuniões: ${reunioes.error.message}`);
  if (tarefas.error) throw new Error(`Falha ao carregar tarefas: ${tarefas.error.message}`);

  const linhas = (reunioes.data ?? []) as Pick<
    MeetingRow,
    'id' | 'title' | 'meeting_type' | 'meeting_date' | 'status'
  >[];

  let analises: AnalysisRow[] = [];
  if (linhas.length > 0) {
    const res = await sb
      .from('analyses')
      .select('*')
      .in('meeting_id', linhas.map((m) => m.id))
      .order('created_at', { ascending: true });
    if (res.error) throw new Error(`Falha ao carregar análises: ${res.error.message}`);
    analises = (res.data ?? []) as AnalysisRow[];
  }

  // Uma reunião pode ter sido reprocessada: a análise mais recente vence.
  const porReuniao = new Map<string, AnalysisRow>();
  for (const a of analises) porReuniao.set(a.meeting_id, a);

  return {
    cliente: cliente.data as CustomerRow,
    reunioes: linhas.map((m) => ({ ...m, analise: porReuniao.get(m.id) ?? null })),
    tarefas: (tarefas.data ?? []) as ActionItemRow[],
  };
}

/* ------------------------------------------------------------------ *
 * Consolidação
 * ------------------------------------------------------------------ */

export type NecessidadeAberta = { texto: string; mencoes: number; ultimaReuniao: string };
export type ObjecaoRecorrente = {
  texto: string;
  categoria: CategoriaObjecao;
  mencoes: number;
  resolvida: boolean;
};
export type ItemStack = {
  produto: string;
  unidade: BusinessUnit;
  status: StatusProduto;
};
export type PontoLinhaTempo = {
  meetingId: string;
  titulo: string;
  tipo: string;
  data: string;
  interesse: number | null;
  confianca: number | null;
  churn: number | null;
  sentimento: string | null;
  analisada: boolean;
};
export type TarefaPendente = {
  descricao: string;
  responsavel: string | null;
  lado: 'interno' | 'cliente';
  prazo: string | null;
  diasAtraso: number;
};

export type VisaoCliente = {
  cliente: CustomerRow;
  health: ResultadoHealth;
  linhaTempo: PontoLinhaTempo[];
  necessidades: NecessidadeAberta[];
  objecoes: ObjecaoRecorrente[];
  decisoes: { texto: string; data: string }[];
  stack: ItemStack[];
  concorrentes: { nome: string; mencoes: number; ativo: boolean }[];
  tarefasAbertas: TarefaPendente[];
  tarefasAtrasadas: TarefaPendente[];
  tarefasConcluidas: number;
  ultimaReuniao: ReuniaoHistorico | null;
  diasDesdeUltimoContato: number | null;
  interesseHistorico: number[];
  confiancaHistorica: number[];
  /** Poder de decisão mais alto visto no ciclo. */
  personaTopo: Persona | null;
  budgetMaisRecente: number | null;
  /** BANT de cada reunião analisada — a preparação acumula os quatro pilares. */
  bantPorReuniao: (Bant | null)[];
};

/** Ordem de força: um produto em uso não regride para "mencionado". */
const FORCA: Record<StatusProduto, number> = {
  em_uso: 4,
  avaliando: 3,
  oportunidade: 2,
  mencionado: 1,
};

export function consolidar(h: Historico): VisaoCliente {
  const analisadas = h.reunioes.filter((r) => r.analise !== null);

  const linhaTempo: PontoLinhaTempo[] = h.reunioes.map((r) => ({
    meetingId: r.id,
    titulo: r.title,
    tipo: r.meeting_type,
    data: r.meeting_date,
    interesse: r.analise?.interest_score ?? null,
    confianca: r.analise?.trust_score ?? null,
    churn: r.analise?.churn_risk ?? null,
    sentimento: r.analise?.sentiment ?? null,
    analisada: r.analise !== null,
  }));

  // --- Necessidades, por frequência ---
  const mapaNec = new Map<string, NecessidadeAberta>();
  for (const r of analisadas) {
    const necs = parse<Necessidade[]>(r.analise!.customer_needs, []);
    const vistasNestaReuniao = new Set<string>();
    for (const n of necs) {
      const k = chave(n.text);
      if (!k || vistasNestaReuniao.has(k)) continue;
      vistasNestaReuniao.add(k);
      const atual = mapaNec.get(k);
      if (atual) {
        atual.mencoes++;
        atual.ultimaReuniao = r.meeting_date;
      } else {
        mapaNec.set(k, { texto: n.text, mencoes: 1, ultimaReuniao: r.meeting_date });
      }
    }
  }
  const necessidades = [...mapaNec.values()].sort((a, b) => b.mencoes - a.mencoes);

  // --- Objeções, por categoria: é o que revela o padrão recorrente ---
  const mapaObj = new Map<CategoriaObjecao, ObjecaoRecorrente>();
  for (const r of analisadas) {
    const objs = parse<Objecao[]>(r.analise!.objections, []);
    const vistasNestaReuniao = new Set<CategoriaObjecao>();
    for (const o of objs) {
      if (vistasNestaReuniao.has(o.category)) continue;
      vistasNestaReuniao.add(o.category);
      const atual = mapaObj.get(o.category);
      if (atual) {
        atual.mencoes++;
        atual.texto = o.text; // a menção mais recente descreve melhor o estado atual
        atual.resolvida = o.resolved;
      } else {
        mapaObj.set(o.category, {
          texto: o.text,
          categoria: o.category,
          mencoes: 1,
          resolvida: o.resolved,
        });
      }
    }
  }
  const objecoes = [...mapaObj.values()].sort((a, b) => b.mencoes - a.mencoes);

  // --- Decisões ---
  const decisoes: { texto: string; data: string }[] = [];
  for (const r of analisadas) {
    for (const d of parse<Decisao[]>(r.analise!.decisions, [])) {
      decisoes.push({ texto: d.text, data: r.meeting_date });
    }
  }

  // --- Stack TOTVS consolidada ---
  const mapaStack = new Map<string, ItemStack>();
  for (const r of analisadas) {
    for (const p of parse<ProdutoTotvs[]>(r.analise!.totvs_products, [])) {
      const k = chave(p.name);
      const atual = mapaStack.get(k);
      if (!atual || FORCA[p.status] > FORCA[atual.status]) {
        mapaStack.set(k, { produto: p.name, unidade: p.unit, status: p.status });
      }
    }
  }
  const stack = [...mapaStack.values()].sort((a, b) => FORCA[b.status] - FORCA[a.status]);

  // --- Concorrentes ---
  const mapaConc = new Map<string, { nome: string; mencoes: number; ativo: boolean }>();
  for (const r of analisadas) {
    for (const c of parse<Concorrente[]>(r.analise!.competitors, [])) {
      const k = chave(c.name);
      const atual = mapaConc.get(k);
      if (atual) {
        atual.mencoes++;
        atual.ativo = atual.ativo || c.active;
      } else {
        mapaConc.set(k, { nome: c.name, mencoes: 1, ativo: c.active });
      }
    }
  }
  const concorrentes = [...mapaConc.values()].sort((a, b) => b.mencoes - a.mencoes);

  // --- Tarefas ---
  const hoje = HOJE();
  const pendentes = h.tarefas.filter((t) => !t.done);
  const paraItem = (t: ActionItemRow): TarefaPendente => ({
    descricao: t.description,
    responsavel: t.responsible,
    lado: t.side === 'cliente' ? 'cliente' : 'interno',
    prazo: t.due_date,
    diasAtraso: t.due_date ? Math.max(0, diasEntre(t.due_date, hoje)) : 0,
  });
  const tarefasAbertas = pendentes.map(paraItem);
  const tarefasAtrasadas = tarefasAbertas.filter((t) => t.prazo !== null && t.diasAtraso > 0);
  const tarefasConcluidas = h.tarefas.filter((t) => t.done).length;

  // --- Séries e persona ---
  const interesseHistorico = analisadas.map((r) => r.analise!.interest_score);
  const confiancaHistorica = analisadas.map((r) => r.analise!.trust_score);

  const ORDEM_PODER = ['desconhecido', 'usuario', 'influenciador', 'decisor'];
  let personaTopo: Persona | null = null;
  for (const r of analisadas) {
    const p = parse<Persona | null>(r.analise!.persona, null);
    if (!p) continue;
    if (
      personaTopo === null ||
      ORDEM_PODER.indexOf(p.decision_power) > ORDEM_PODER.indexOf(personaTopo.decision_power)
    ) {
      personaTopo = p;
    }
  }

  let budgetMaisRecente: number | null = null;
  for (const r of analisadas) {
    const bs = parse<{ amount: number | null }[]>(r.analise!.budget, []);
    const comValor = bs.filter((b) => b.amount != null);
    if (comValor.length > 0) budgetMaisRecente = comValor[comValor.length - 1]!.amount;
  }

  const bantPorReuniao = analisadas.map((r) => parse<Bant | null>(r.analise!.bant, null));

  const ultimaReuniao = analisadas.length > 0 ? (analisadas[analisadas.length - 1] as ReuniaoHistorico) : null;
  const diasDesdeUltimoContato = ultimaReuniao ? diasEntre(ultimaReuniao.meeting_date, hoje) : null;

  const health = calcularHealth({
    interesseUltima: ultimaReuniao?.analise?.interest_score ?? null,
    interesseHistorico,
    diasDesdeUltimoContato,
    objecoesAbertas: objecoes.filter((o) => !o.resolvida).length,
    objecoesResolvidas: objecoes.filter((o) => o.resolvida).length,
    tarefasConcluidas,
    tarefasAtrasadas: tarefasAtrasadas.length,
    temDecisorNoCiclo: personaTopo?.decision_power === 'decisor',
    temHistorico: analisadas.length > 0,
  });

  return {
    cliente: h.cliente,
    health,
    linhaTempo,
    necessidades,
    objecoes,
    decisoes,
    stack,
    concorrentes,
    tarefasAbertas,
    tarefasAtrasadas,
    tarefasConcluidas,
    ultimaReuniao,
    diasDesdeUltimoContato,
    interesseHistorico,
    confiancaHistorica,
    personaTopo,
    budgetMaisRecente,
    bantPorReuniao,
  };
}

/* ------------------------------------------------------------------ *
 * Memória injetada no motor
 * ------------------------------------------------------------------ */

/** Converte a visão consolidada no contrato que o motor de análise consome. */
export function paraMemoriaDoMotor(v: VisaoCliente): MemoriaCliente {
  return {
    necessidades_abertas: v.necessidades.map((n) => ({ texto: n.texto, mencoes: n.mencoes })),
    objecoes_recorrentes: v.objecoes
      .filter((o) => !o.resolvida)
      .map((o) => ({ texto: o.texto, categoria: o.categoria, mencoes: o.mencoes })),
    decisoes: v.decisoes.map((d) => d.texto),
    promessas_nao_cumpridas: v.tarefasAtrasadas
      .filter((t) => t.lado === 'interno')
      .map((t) => ({ texto: t.descricao, dias_atraso: t.diasAtraso })),
    interesse_historico: v.interesseHistorico,
    confianca_historica: v.confiancaHistorica,
    stack_totvs: v.stack.map((s) => ({ produto: s.produto, unidade: s.unidade, status: s.status })),
    ...(v.cliente.contract_value != null ? { contract_value: v.cliente.contract_value } : {}),
  };
}

/**
 * Memória do cliente pronta para injetar numa nova análise.
 * Devolve undefined quando o cliente ainda não tem passado — a primeira reunião
 * é analisada sem memória, e o briefing diz isso nas premissas.
 */
export async function memoriaDoCliente(customerId: string): Promise<MemoriaCliente | undefined> {
  const h = await carregarHistorico(customerId);
  if (!h) return undefined;
  const v = consolidar(h);
  if (v.interesseHistorico.length === 0) return undefined;
  return paraMemoriaDoMotor(v);
}

/** Visão completa para as telas de cliente. */
export async function visaoDoCliente(customerId: string): Promise<VisaoCliente | null> {
  const h = await carregarHistorico(customerId);
  return h ? consolidar(h) : null;
}
