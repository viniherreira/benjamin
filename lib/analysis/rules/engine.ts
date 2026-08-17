import type { AnalysisResult, EntradaAnalise, ProdutoTotvs } from '../types';
import { preparar } from './segment';
import {
  extrairBudget,
  extrairConcorrentes,
  extrairCrossBu,
  extrairDecisoes,
  extrairNecessidades,
  extrairObjecoes,
  extrairOportunidades,
  extrairPersona,
  extrairProblemas,
  extrairProdutos,
  extrairProximosPassos,
  extrairRiscos,
  extrairSinaisChurn,
  extrairSinaisUpsell,
  extrairTarefas,
  extrairVoz,
} from './extractors';
import { analisarSentimento } from './sentiment';
import { analisarConfianca } from './trust';
import { calcularBant, metricasConversa } from './conversation';
import { avaliarQualidade } from './quality';
import { calcularChurn, calcularInteresse } from './scoring';
import { montarResumo } from './resumo';
import { existe } from './util';

/**
 * Orquestrador do motor determinístico.
 *
 * Recebe (texto, contexto do cliente) e devolve o objeto tipado. Sem I/O, sem
 * rede, sem dependência de framework — é isso que permite rodá-lo sobre o
 * corpus inteiro na tela de validação e medir latência de verdade.
 */
export function analisarComRegras(entrada: EntradaAnalise): AnalysisResult {
  const t0 = performance.now();

  const prep = preparar(entrada.texto);
  const dataReuniao = entrada.dataReuniao ?? new Date().toISOString().slice(0, 10);

  // --- Extração ---
  const diretos = extrairProdutos(prep);
  const cross = extrairCrossBu(prep);
  const nomes = new Set(diretos.map((p) => p.name));
  const totvs_products: ProdutoTotvs[] = [...diretos, ...cross.filter((c) => !nomes.has(c.name))];

  const competitors = extrairConcorrentes(prep);
  const budget = extrairBudget(prep);
  const persona = extrairPersona(prep);
  const problems = extrairProblemas(prep);
  const customer_needs = extrairNecessidades(prep);
  const objections = extrairObjecoes(prep);
  const decisions = extrairDecisoes(prep);
  const next_steps = extrairProximosPassos(prep);
  const action_items = extrairTarefas(prep, dataReuniao);
  const churn_signals = extrairSinaisChurn(prep);
  const upsell_signals = extrairSinaisUpsell(prep);
  const risks = extrairRiscos(churn_signals, competitors);
  const opportunities = extrairOportunidades(prep, totvs_products, budget.length > 0);
  const voice_of_customer = extrairVoz(prep);

  // --- Interpretação ---
  const sent = analisarSentimento(prep);
  const conf = analisarConfianca(prep);
  const conversation_metrics = metricasConversa(prep);
  const transcript_quality = avaliarQualidade(prep);

  const ehDecisor = persona.decision_power === 'decisor';
  const temPrazo = action_items.some((t) => t.due_date !== null);

  const bant = calcularBant({
    temBudget: budget.length > 0,
    temAutoridade: ehDecisor || existe(prep, 'quem decide (?:sou|e) eu|eu (?:que )?(?:decido|aprovo)'),
    temNecessidade: customer_needs.length > 0 || problems.length > 0,
    temPrazo,
  });

  const { interest_score, score_factors } = calcularInteresse({
    prep,
    upsell: upsell_signals,
    objecoes: objections,
    concorrentes: competitors,
    churn: churn_signals,
    tarefas: action_items,
    temBudget: budget.length > 0,
    sentimento: sent.sentiment,
    confianca: conf.trust_score,
    temProximoPasso: next_steps.length > 0,
    ehDecisor,
  });

  const churn = calcularChurn({
    prep,
    churn: churn_signals,
    objecoes: objections,
    concorrentes: competitors,
    memoria: entrada.memoria,
  });

  // --- Valor de negócio ---
  const contrato = entrada.memoria?.contract_value ?? null;
  const pipeline = opportunities.reduce((soma, o) => {
    const base = o.estimated_value ?? budget[0]?.amount ?? 0;
    return soma + base * o.probability;
  }, 0);

  const assumptions: string[] = [];
  if (contrato === null) {
    assumptions.push('Valor de contrato não informado: receita em risco não pôde ser calculada.');
  }
  if (!budget[0]?.amount && opportunities.length > 0) {
    assumptions.push('Nenhum valor declarado na conversa: pipeline estimado em zero até parametrizar o produto.');
  }
  if (!entrada.memoria) {
    assumptions.push('Análise sem histórico do cliente: o risco de churn considera apenas os sinais desta reunião.');
  }

  const summary = montarResumo({
    produtos: totvs_products,
    problemas: problems,
    objecoes: objections,
    concorrentes: competitors,
    oportunidades: opportunities,
    budget,
    persona,
    proximosPassos: next_steps,
    aspectos: sent.aspect_sentiment,
    interesse: interest_score,
  });

  return {
    summary,

    totvs_products,
    opportunities,
    competitors,
    churn_signals,
    upsell_signals,

    customer_needs,
    problems,
    decisions,
    objections,
    next_steps,
    risks,
    action_items,
    budget,
    persona,

    sentiment: sent.sentiment,
    sentiment_score: sent.sentiment_score,
    aspect_sentiment: sent.aspect_sentiment,

    voice_of_customer,
    trust_score: conf.trust_score,
    trust_signals: conf.trust_signals,

    conversation_metrics,
    transcript_quality,
    bant,

    interest_score,
    churn_risk: churn.churn_risk,
    score_factors,
    churn_factors: churn.fatores,

    business_value: {
      revenue_at_risk: contrato !== null && churn.churn_risk >= 67 ? contrato : null,
      pipeline_value: pipeline > 0 ? Math.round(pipeline) : null,
      assumptions,
    },

    engine: 'rules',
    latency_ms: Math.round(performance.now() - t0),
  };
}

/** Exposto para os testes de invariante e para a tela de validação. */
export { preparar };
