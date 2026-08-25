/**
 * Valor de negócio — spec 4.2.
 *
 * "O desafio não é sobre texto, mas sobre valor de negócio." Este módulo é a
 * tradução dos sinais extraídos para reais, e é o que sustenta a Torre de
 * Controle.
 *
 * Regra que atravessa o arquivo: todo número carrega a premissa que o produziu.
 * Estimativa declarada é análise; estimativa disfarçada de certeza é chute. Por
 * isso cada cálculo devolve `premissas` junto do valor.
 */

export type Premissa = string;

export type ValorEmRisco = {
  total: number;
  contas: { id: string; nome: string; valor: number; churn: number }[];
  premissas: Premissa[];
};

export type PipelineIdentificado = {
  total: number;
  porUnidade: { unidade: string; valor: number; oportunidades: number }[];
  premissas: Premissa[];
};

export type UpsellNaoTrabalhado = {
  total: number;
  contas: { id: string; nome: string; valor: number; diasParado: number }[];
  premissas: Premissa[];
};

/** Minutos de pós-reunião manual que o briefing automático substitui. */
export const MINUTOS_POS_REUNIAO = 12;

/** Dias sem tarefa associada a partir dos quais a oportunidade conta como parada. */
export const DIAS_SEM_ACAO = 14;

const soma = (ns: number[]) => ns.reduce((s, n) => s + n, 0);

/* ------------------------------------------------------------------ *
 * Receita em risco
 * ------------------------------------------------------------------ */

export type ContaParaRisco = {
  id: string;
  nome: string;
  contrato: number | null;
  churn: number | null;
};

/**
 * Σ do valor de contrato das contas com churn ≥ 67 (banda alta).
 *
 * Conta sem valor de contrato cadastrado não entra na soma — e o fato de ela
 * ter ficado de fora é dito na premissa, em vez de estimar um valor qualquer.
 */
export function receitaEmRisco(contas: ContaParaRisco[]): ValorEmRisco {
  const emRisco = contas.filter((c) => (c.churn ?? 0) >= 67);
  const comValor = emRisco.filter((c) => c.contrato != null);
  const semValor = emRisco.length - comValor.length;

  const premissas: Premissa[] = [
    'Considera apenas contas com risco de churn na banda alta (≥ 67).',
    'Usa o valor de contrato cadastrado na conta, não valor projetado.',
  ];
  if (semValor > 0) {
    premissas.push(
      `${semValor} conta(s) em risco não têm valor de contrato cadastrado e ficaram fora da soma.`,
    );
  }

  return {
    total: soma(comValor.map((c) => c.contrato as number)),
    contas: comValor
      .map((c) => ({ id: c.id, nome: c.nome, valor: c.contrato as number, churn: c.churn ?? 0 }))
      .sort((a, b) => b.valor - a.valor),
    premissas,
  };
}

/* ------------------------------------------------------------------ *
 * Pipeline identificado
 * ------------------------------------------------------------------ */

export type OportunidadeParaValor = {
  unidade: string;
  probabilidade: number;
  valorEstimado: number | null;
};

const NOME_UNIDADE: Record<string, string> = {
  gestao: 'TOTVS Gestão',
  rd_station: 'RD Station',
  techfin: 'TOTVS Techfin',
  indefinido: 'Não classificada',
};

/**
 * Σ (valor estimado × probabilidade), quebrado por unidade de negócio.
 *
 * A quebra por unidade é o que evidencia o Cross-BU: mostra que o sistema
 * enxerga Techfin e RD Station, não só ERP.
 */
export function pipelineIdentificado(oportunidades: OportunidadeParaValor[]): PipelineIdentificado {
  const porUnidade = new Map<string, { valor: number; oportunidades: number }>();
  let semValor = 0;

  for (const o of oportunidades) {
    const chave = NOME_UNIDADE[o.unidade] ?? o.unidade;
    const atual = porUnidade.get(chave) ?? { valor: 0, oportunidades: 0 };
    atual.oportunidades++;
    if (o.valorEstimado == null) semValor++;
    else atual.valor += o.valorEstimado * o.probabilidade;
    porUnidade.set(chave, atual);
  }

  const premissas: Premissa[] = [
    'Cada oportunidade entra ponderada pela probabilidade estimada pelo motor.',
  ];
  if (semValor > 0) {
    premissas.push(
      `${semValor} oportunidade(s) sem valor declarado na conversa contam no volume, mas não no total em R$.`,
    );
  }

  const lista = [...porUnidade.entries()]
    .map(([unidade, v]) => ({ unidade, valor: Math.round(v.valor), oportunidades: v.oportunidades }))
    .sort((a, b) => b.valor - a.valor || b.oportunidades - a.oportunidades);

  return { total: soma(lista.map((l) => l.valor)), porUnidade: lista, premissas };
}

/* ------------------------------------------------------------------ *
 * Upsell não trabalhado
 * ------------------------------------------------------------------ */

export type ContaParaUpsell = {
  id: string;
  nome: string;
  upsell: number | null;
  /** Dias desde a última reunião da conta. */
  diasDesdeContato: number | null;
  /** Existe alguma tarefa em aberto ligada à conta? */
  temTarefaAberta: boolean;
};

/**
 * Oportunidade detectada há mais de N dias sem nenhuma tarefa associada.
 *
 * É o número mais incômodo da torre — dinheiro que o sistema já viu e que
 * ninguém foi atrás.
 */
export function upsellNaoTrabalhado(contas: ContaParaUpsell[]): UpsellNaoTrabalhado {
  const paradas = contas.filter(
    (c) =>
      (c.upsell ?? 0) > 0 &&
      !c.temTarefaAberta &&
      (c.diasDesdeContato ?? 0) >= DIAS_SEM_ACAO,
  );

  return {
    total: soma(paradas.map((c) => c.upsell as number)),
    contas: paradas
      .map((c) => ({
        id: c.id,
        nome: c.nome,
        valor: c.upsell as number,
        diasParado: c.diasDesdeContato ?? 0,
      }))
      .sort((a, b) => b.valor - a.valor),
    premissas: [
      `Conta como parada a oportunidade sem tarefa em aberto e sem contato há ${DIAS_SEM_ACAO} dias ou mais.`,
      'O valor é o pipeline identificado da conta, já ponderado pela probabilidade.',
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Produtividade e custo
 * ------------------------------------------------------------------ */

export type Produtividade = {
  reunioes: number;
  minutosEconomizados: number;
  horasEconomizadas: number;
  premissas: Premissa[];
};

export function horasDevolvidas(reunioes: number, minutosPorReuniao = MINUTOS_POS_REUNIAO): Produtividade {
  const minutos = reunioes * minutosPorReuniao;
  return {
    reunioes,
    minutosEconomizados: minutos,
    horasEconomizadas: Number((minutos / 60).toFixed(1)),
    premissas: [
      `Parâmetro configurável: ${minutosPorReuniao} minutos de pós-reunião manual evitados por reunião analisada.`,
      'Não mede qualidade da anotação humana, apenas o tempo de registro que deixa de existir.',
    ],
  };
}

export type CustoOperacao = {
  latenciaMediaMs: number;
  custoPorAnalise: number;
  analisesPorMinuto: number;
  projecao10k: { horasProcesso: number; custoDiario: number };
  premissas: Premissa[];
};

/**
 * Responde à pergunta das 10.000 reuniões/dia com o número medido, não estimado.
 * O motor é determinístico: não há chamada de API, logo não há custo por análise.
 */
export function custoDaOperacao(latencias: number[]): CustoOperacao {
  const validas = latencias.filter((l) => l > 0);
  const media = validas.length > 0 ? soma(validas) / validas.length : 0;
  const porMinuto = media > 0 ? Math.round(60_000 / media) : 0;
  const horas = porMinuto > 0 ? 10_000 / porMinuto / 60 : 0;

  return {
    latenciaMediaMs: Number(media.toFixed(1)),
    custoPorAnalise: 0,
    analisesPorMinuto: porMinuto,
    projecao10k: { horasProcesso: Number(horas.toFixed(2)), custoDiario: 0 },
    premissas: [
      'Latência medida nas análises já gravadas nesta base, em um processo.',
      'Custo de API igual a zero porque o motor roda 100% em regras determinísticas.',
      'A projeção considera processamento sequencial; a arquitetura escala horizontalmente por workers.',
    ],
  };
}
