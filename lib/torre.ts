import { supabaseServer } from './supabase/server';
import type { ActionItemRow, AlertRow, AnalysisRow, CustomerRow, MeetingRow } from './supabase/database.types';
import type { Oportunidade } from './analysis';
import { diasEntre } from './memory';
import {
  custoDaOperacao,
  horasDevolvidas,
  pipelineIdentificado,
  receitaEmRisco,
  upsellNaoTrabalhado,
  type CustoOperacao,
  type PipelineIdentificado,
  type Produtividade,
  type UpsellNaoTrabalhado,
  type ValorEmRisco,
} from './value';

/**
 * Agregação da Torre de Controle e do dashboard.
 *
 * A pergunta que fecha o briefing da TOTVS é "como avisar o Diretor Comercial,
 * em tempo real, que este cliente está prestes a comprar um concorrente". Esta
 * é a camada que responde: cruza todas as contas, todas as análises e todos os
 * alertas, e converte em reais.
 *
 * Uma carga só alimenta a torre inteira — nada de N+1 por conta.
 */

const parse = <T>(v: unknown, padrao: T): T => (v == null ? padrao : (v as T));

export type ContaTorre = {
  id: string;
  nome: string;
  segmento: string | null;
  contrato: number | null;
  upsell: number | null;
  health: number;
  banda: string;
  churn: number | null;
  interesse: number | null;
  diasDesdeContato: number | null;
  reunioes: number;
  tarefasAbertas: number;
  concorrentesAtivos: string[];
};

export type VisaoTorre = {
  contas: ContaTorre[];
  contasEmRisco: ContaTorre[];
  receita: ValorEmRisco;
  pipeline: PipelineIdentificado;
  upsellParado: UpsellNaoTrabalhado;
  produtividade: Produtividade;
  custo: CustoOperacao;
  alertasAltos: AlertRow[];
  totalAlertas: number;
  totalReunioes: number;
  totalAnalises: number;
};

export async function carregarTorre(): Promise<VisaoTorre> {
  const sb = supabaseServer();

  const [clientesRes, reunioesRes, analisesRes, alertasRes, tarefasRes] = await Promise.all([
    sb.from('customers').select('*'),
    sb.from('meetings').select('id, customer_id, meeting_date').limit(2000),
    sb.from('analyses').select('*').order('created_at', { ascending: true }).limit(2000),
    sb.from('alerts').select('*').order('created_at', { ascending: false }).limit(200),
    sb.from('action_items').select('customer_id, done').limit(2000),
  ]);

  for (const [nome, r] of [
    ['clientes', clientesRes],
    ['reuniões', reunioesRes],
    ['análises', analisesRes],
    ['alertas', alertasRes],
    ['tarefas', tarefasRes],
  ] as const) {
    if (r.error) throw new Error(`Falha ao carregar ${nome}: ${r.error.message}`);
  }

  const clientes = (clientesRes.data ?? []) as CustomerRow[];
  const reunioes = (reunioesRes.data ?? []) as Pick<MeetingRow, 'id' | 'customer_id' | 'meeting_date'>[];
  const analises = (analisesRes.data ?? []) as AnalysisRow[];
  const alertas = (alertasRes.data ?? []) as AlertRow[];
  const tarefas = (tarefasRes.data ?? []) as Pick<ActionItemRow, 'customer_id' | 'done'>[];

  // reunião → cliente, para ligar análise a conta.
  const clienteDaReuniao = new Map<string, string | null>();
  const agregadoReuniao = new Map<string, { total: number; ultima: string }>();
  for (const m of reunioes) {
    clienteDaReuniao.set(m.id, m.customer_id);
    if (!m.customer_id) continue;
    const atual = agregadoReuniao.get(m.customer_id);
    if (atual) {
      atual.total++;
      if (m.meeting_date > atual.ultima) atual.ultima = m.meeting_date;
    } else {
      agregadoReuniao.set(m.customer_id, { total: 1, ultima: m.meeting_date });
    }
  }

  // Última análise por conta (as análises vêm em ordem cronológica de criação).
  const ultimaAnalisePorConta = new Map<string, AnalysisRow>();
  // E todas as análises da conta: ameaça e budget são propriedades do CICLO.
  // Ler só a última faria a Senior "sumir" na reunião em que não é citada.
  const analisesPorConta = new Map<string, AnalysisRow[]>();
  for (const a of analises) {
    const cid = clienteDaReuniao.get(a.meeting_id);
    if (!cid) continue;
    ultimaAnalisePorConta.set(cid, a);
    const lista = analisesPorConta.get(cid) ?? [];
    lista.push(a);
    analisesPorConta.set(cid, lista);
  }

  /** Concorrentes ativos em qualquer reunião do ciclo, sem repetir nome. */
  const concorrentesDoCiclo = (cid: string): string[] => {
    const nomes = new Set<string>();
    for (const a of analisesPorConta.get(cid) ?? []) {
      for (const k of parse<{ name: string; active: boolean }[]>(a.competitors, [])) {
        if (k.active) nomes.add(k.name);
      }
    }
    return [...nomes];
  };

  /** Último valor declarado pelo cliente — base de estimativa quando a
   *  oportunidade não traz valor próprio. Mesma regra usada em recalcularCliente,
   *  para a torre e a página da conta não exibirem números divergentes. */
  const budgetDoCiclo = (cid: string): number | null => {
    let valor: number | null = null;
    for (const a of analisesPorConta.get(cid) ?? []) {
      const bs = parse<{ amount: number | null }[]>(a.budget, []);
      for (const b of bs) if (b.amount != null) valor = b.amount;
    }
    return valor;
  };

  const tarefasAbertasPorConta = new Map<string, number>();
  for (const t of tarefas) {
    if (!t.customer_id || t.done) continue;
    tarefasAbertasPorConta.set(t.customer_id, (tarefasAbertasPorConta.get(t.customer_id) ?? 0) + 1);
  }

  const contas: ContaTorre[] = clientes.map((c) => {
    const ag = agregadoReuniao.get(c.id);
    const ultima = ultimaAnalisePorConta.get(c.id);
    const concorrentes = concorrentesDoCiclo(c.id);

    return {
      id: c.id,
      nome: c.name,
      segmento: c.segment,
      contrato: c.contract_value,
      upsell: c.upsell_potential,
      health: c.health_score,
      banda: c.health_band,
      churn: ultima?.churn_risk ?? null,
      interesse: ultima?.interest_score ?? null,
      diasDesdeContato: ag ? diasEntre(ag.ultima) : null,
      reunioes: ag?.total ?? 0,
      tarefasAbertas: tarefasAbertasPorConta.get(c.id) ?? 0,
      concorrentesAtivos: concorrentes,
    };
  });

  // Pipeline: oportunidades da análise mais recente de cada conta. Somar todas
  // as análises contaria a mesma oportunidade uma vez por reunião.
  // O valor, porém, vem do ciclo: quando a oportunidade não traz valor próprio,
  // usa-se o último budget que o cliente declarou em qualquer conversa.
  const oportunidades = [...ultimaAnalisePorConta.entries()].flatMap(([cid, a]) => {
    const base = budgetDoCiclo(cid);
    return parse<Oportunidade[]>(a.opportunities, []).map((o) => ({
      unidade: o.unit,
      probabilidade: o.probability,
      valorEstimado: o.estimated_value ?? base,
    }));
  });

  const receita = receitaEmRisco(
    contas.map((c) => ({ id: c.id, nome: c.nome, contrato: c.contrato, churn: c.churn })),
  );

  const upsellParado = upsellNaoTrabalhado(
    contas.map((c) => ({
      id: c.id,
      nome: c.nome,
      upsell: c.upsell,
      diasDesdeContato: c.diasDesdeContato,
      temTarefaAberta: c.tarefasAbertas > 0,
    })),
  );

  const pipeline = pipelineIdentificado(oportunidades);
  pipeline.premissas.push(
    'Oportunidade sem valor próprio herda o último budget que o cliente declarou no ciclo.',
  );

  return {
    contas,
    contasEmRisco: [...contas]
      .filter((c) => (c.churn ?? 0) >= 34 || c.banda === 'baixo' || c.concorrentesAtivos.length > 0)
      .sort((a, b) => (b.contrato ?? 0) - (a.contrato ?? 0) || (b.churn ?? 0) - (a.churn ?? 0)),
    receita,
    pipeline,
    upsellParado,
    produtividade: horasDevolvidas(analises.length),
    custo: custoDaOperacao(analises.map((a) => a.latency_ms ?? 0)),
    alertasAltos: alertas.filter((a) => a.severity === 'alta'),
    totalAlertas: alertas.length,
    totalReunioes: reunioes.length,
    totalAnalises: analises.length,
  };
}
