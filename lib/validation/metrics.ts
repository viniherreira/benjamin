import type { AnalysisResult } from '../analysis/types';
import type { Amostra, Gabarito } from './tipos';

/**
 * Métricas de validação.
 *
 * Nada aqui inventa número: tudo sai da comparação entre a saída do motor e o
 * gabarito anotado no texto. Os campos ruins aparecem no relatório do mesmo
 * jeito que os bons — um F1 de 0,78 com análise honesta do erro vale mais numa
 * banca que um 0,99 que ninguém consegue explicar.
 */

export type ContadorPRF = { tp: number; fp: number; fn: number };

const novoContador = (): ContadorPRF => ({ tp: 0, fp: 0, fn: 0 });

const norm = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim();

function acumularConjunto(esperados: string[], obtidos: string[], c: ContadorPRF): void {
  const esp = new Set(esperados.map(norm));
  const obt = new Set(obtidos.map(norm));

  for (const o of obt) (esp.has(o) ? c.tp++ : c.fp++);
  for (const e of esp) if (!obt.has(e)) c.fn++;
}

function acumularBinario(esperado: boolean, obtido: boolean, c: ContadorPRF): void {
  if (esperado && obtido) c.tp++;
  else if (!esperado && obtido) c.fp++;
  else if (esperado && !obtido) c.fn++;
}

export type PRF = { precision: number; recall: number; f1: number; suporte: number };

export function prf(c: ContadorPRF): PRF {
  const precision = c.tp + c.fp === 0 ? 1 : c.tp / (c.tp + c.fp);
  const recall = c.tp + c.fn === 0 ? 1 : c.tp / (c.tp + c.fn);
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return {
    precision: Number(precision.toFixed(3)),
    recall: Number(recall.toFixed(3)),
    f1: Number(f1.toFixed(3)),
    suporte: c.tp + c.fn,
  };
}

export type Acuracia = { acertos: number; total: number; taxa: number };

const acuracia = (acertos: number, total: number): Acuracia => ({
  acertos,
  total,
  taxa: total === 0 ? 1 : Number((acertos / total).toFixed(3)),
});

/* ------------------------------------------------------------------ *
 * Execução
 * ------------------------------------------------------------------ */

export type ResultadoAmostra = {
  codigo: string;
  particao: Amostra['particao'];
  latencia_ms: number;
  palavras: number;
  analise: AnalysisResult;
  gold: Gabarito;
};

export type RelatorioMetricas = {
  amostras: number;
  campos: Record<string, PRF>;
  acuracias: Record<string, Acuracia>;
  mae: Record<string, number>;
  matriz_churn: Record<string, Record<string, number>>;
  cobertura_evidencia: number;
  falso_positivo_sem_sinal: Record<string, number>;
  latencia: { p50: number; p95: number; media: number; total_ms: number };
  throughput_por_min: number;
};

/** Confere se toda extração da amostra tem citação rastreável. */
function coberturaDeEvidencia(a: AnalysisResult): { comEvidencia: number; total: number } {
  const listas: { evidence?: unknown }[][] = [
    a.totvs_products,
    a.opportunities,
    a.competitors,
    a.churn_signals,
    a.upsell_signals,
    a.customer_needs,
    a.problems,
    a.decisions,
    a.objections,
    a.next_steps,
    a.risks,
    a.action_items,
    a.budget,
    a.aspect_sentiment,
    a.voice_of_customer,
    a.trust_signals,
  ];

  let total = 0;
  let comEvidencia = 0;

  for (const lista of listas) {
    for (const item of lista) {
      total++;
      const ev = item.evidence as { quote?: string } | undefined;
      if (ev && typeof ev.quote === 'string' && ev.quote.length > 0) comEvidencia++;
    }
  }

  return { comEvidencia, total };
}

const percentil = (valores: number[], p: number): number => {
  if (valores.length === 0) return 0;
  const ord = [...valores].sort((a, b) => a - b);
  const i = Math.min(ord.length - 1, Math.floor((p / 100) * ord.length));
  return ord[i] as number;
};

export function calcularMetricas(resultados: ResultadoAmostra[]): RelatorioMetricas {
  const c = {
    produtos: novoContador(),
    produtos_status: novoContador(),
    concorrentes: novoContador(),
    concorrentes_ativos: novoContador(),
    objecoes: novoContador(),
    dores: novoContador(),
    unidades: novoContador(),
    churn_sinal: novoContador(),
    upsell_sinal: novoContador(),
    budget: novoContador(),
  };

  let sentimentoOk = 0;
  let poderOk = 0;
  let interesseNaFaixa = 0;
  let churnBandaOk = 0;
  let talkOk = 0;
  let talkTotal = 0;

  let erroInteresse = 0;
  let erroTalk = 0;

  const matriz: Record<string, Record<string, number>> = {
    baixo: { baixo: 0, medio: 0, alto: 0 },
    medio: { baixo: 0, medio: 0, alto: 0 },
    alto: { baixo: 0, medio: 0, alto: 0 },
  };

  let evidComp = 0;
  let evidTotal = 0;

  const fpSemSinal = { concorrentes: 0, objecoes: 0, churn: 0, budget: 0, amostras: 0 };

  const latencias: number[] = [];

  for (const r of resultados) {
    const { analise: a, gold: g } = r;
    latencias.push(r.latencia_ms);

    acumularConjunto(
      g.produtos.map((p) => p.nome),
      a.totvs_products.map((p) => p.name),
      c.produtos,
    );

    // Status só é cobrado nos produtos que o gabarito espera.
    for (const esperado of g.produtos) {
      const obtido = a.totvs_products.find((p) => norm(p.name) === norm(esperado.nome));
      if (obtido && obtido.status === esperado.status) c.produtos_status.tp++;
      else if (obtido) c.produtos_status.fp++;
      else c.produtos_status.fn++;
    }

    acumularConjunto(
      g.concorrentes.map((x) => x.nome),
      a.competitors.map((x) => x.name),
      c.concorrentes,
    );

    acumularConjunto(
      g.concorrentes.filter((x) => x.ativo).map((x) => x.nome),
      a.competitors.filter((x) => x.active).map((x) => x.name),
      c.concorrentes_ativos,
    );

    acumularConjunto(g.objecoes, a.objections.map((o) => o.category), c.objecoes);
    acumularConjunto(g.dores, a.problems.map((p) => p.category), c.dores);
    acumularConjunto(
      g.unidades_oportunidade,
      [...new Set(a.opportunities.map((o) => o.unit))],
      c.unidades,
    );

    acumularBinario(g.churn_claro, a.churn_signals.length > 0, c.churn_sinal);
    acumularBinario(g.upsell_claro, a.upsell_signals.length > 0 || a.opportunities.length > 0, c.upsell_sinal);
    acumularBinario(
      g.budget !== null,
      a.budget.some((b) => b.amount === g.budget),
      c.budget,
    );

    if (a.sentiment === g.sentimento) sentimentoOk++;
    if (a.persona.decision_power === g.poder_decisao) poderOk++;

    const [minI, maxI] = g.interesse;
    if (a.interest_score >= minI && a.interest_score <= maxI) interesseNaFaixa++;
    const meio = (minI + maxI) / 2;
    erroInteresse += Math.abs(a.interest_score - meio);

    const banda = a.churn_risk >= 67 ? 'alto' : a.churn_risk >= 34 ? 'medio' : 'baixo';
    const linha = matriz[g.churn_risco];
    if (linha) linha[banda] = (linha[banda] ?? 0) + 1;
    if (banda === g.churn_risco) churnBandaOk++;

    if (g.talk_ratio_vendedor && a.conversation_metrics.talk_ratio_seller !== null) {
      talkTotal++;
      const [minT, maxT] = g.talk_ratio_vendedor;
      const v = a.conversation_metrics.talk_ratio_seller;
      if (v >= minT && v <= maxT) talkOk++;
      erroTalk += Math.abs(v - (minT + maxT) / 2);
    }

    const ev = coberturaDeEvidencia(a);
    evidComp += ev.comEvidencia;
    evidTotal += ev.total;

    // Falso positivo medido nas amostras sem nenhum sinal comercial.
    const semSinal =
      g.concorrentes.length === 0 &&
      g.objecoes.length === 0 &&
      !g.churn_claro &&
      !g.upsell_claro &&
      g.budget === null;

    if (semSinal) {
      fpSemSinal.amostras++;
      fpSemSinal.concorrentes += a.competitors.length;
      fpSemSinal.objecoes += a.objections.length;
      fpSemSinal.churn += a.churn_signals.length;
      fpSemSinal.budget += a.budget.length;
    }
  }

  const n = resultados.length;
  const totalMs = latencias.reduce((s, x) => s + x, 0);

  return {
    amostras: n,
    campos: {
      'produtos TOTVS': prf(c.produtos),
      'status do produto': prf(c.produtos_status),
      concorrentes: prf(c.concorrentes),
      'concorrente ativo': prf(c.concorrentes_ativos),
      objeções: prf(c.objecoes),
      dores: prf(c.dores),
      'unidade de negócio': prf(c.unidades),
      'sinal de churn': prf(c.churn_sinal),
      'sinal de upsell': prf(c.upsell_sinal),
      budget: prf(c.budget),
    },
    acuracias: {
      'sentimento (4 classes)': acuracia(sentimentoOk, n),
      'poder de decisão': acuracia(poderOk, n),
      'interesse na faixa': acuracia(interesseNaFaixa, n),
      'banda de churn': acuracia(churnBandaOk, n),
      'talk ratio na faixa': acuracia(talkOk, talkTotal),
    },
    mae: {
      interesse: n === 0 ? 0 : Number((erroInteresse / n).toFixed(1)),
      talk_ratio: talkTotal === 0 ? 0 : Number((erroTalk / talkTotal).toFixed(3)),
    },
    matriz_churn: matriz,
    cobertura_evidencia: evidTotal === 0 ? 1 : Number((evidComp / evidTotal).toFixed(4)),
    falso_positivo_sem_sinal: {
      amostras: fpSemSinal.amostras,
      concorrentes: fpSemSinal.concorrentes,
      objecoes: fpSemSinal.objecoes,
      churn: fpSemSinal.churn,
      budget: fpSemSinal.budget,
    },
    latencia: {
      p50: percentil(latencias, 50),
      p95: percentil(latencias, 95),
      media: n === 0 ? 0 : Number((totalMs / n).toFixed(1)),
      total_ms: totalMs,
    },
    throughput_por_min: totalMs === 0 ? 0 : Number(((n / totalMs) * 60_000).toFixed(0)),
  };
}
