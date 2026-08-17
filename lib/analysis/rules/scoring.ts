import type {
  Concorrente,
  FatorScore,
  MemoriaCliente,
  Objecao,
  Sentimento,
  SinalPontuado,
  Tarefa,
} from '../types';
import type { Preparado } from './segment';
import { evidenciaEm, existe, limitar } from './util';

/**
 * Scores explicáveis.
 *
 * Invariante que a UI depende: a soma dos deltas em `score_factors` bate
 * EXATAMENTE com o número exibido. Quando o clamp 0–100 morde, ele entra como
 * um fator visível em vez de sumir com a diferença.
 */

export type EntradaInteresse = {
  prep: Preparado;
  upsell: SinalPontuado[];
  objecoes: Objecao[];
  concorrentes: Concorrente[];
  churn: SinalPontuado[];
  tarefas: Tarefa[];
  temBudget: boolean;
  sentimento: Sentimento;
  confianca: number;
  temProximoPasso: boolean;
  ehDecisor: boolean;
};

export type ResultadoInteresse = { interest_score: number; score_factors: FatorScore[] };

export function calcularInteresse(e: EntradaInteresse): ResultadoInteresse {
  const fatores: FatorScore[] = [{ label: 'Base', delta: 50 }];

  const pegar = (rotulo: string) => e.upsell.find((s) => s.text === rotulo);

  const proposta = pegar('Pediu proposta') ?? pegar('Pediu orçamento') ?? pegar('Perguntou investimento');
  if (proposta) {
    fatores.push({ label: 'Pediu proposta ou orçamento', delta: 12, evidence: proposta.evidence });
  }

  const comData = e.tarefas.find((t) => t.due_date !== null);
  if (comData) {
    fatores.push({ label: 'Compromisso com data definida', delta: 10, evidence: comData.evidence });
  }

  if (e.ehDecisor) {
    fatores.push({ label: 'Decisor presente na conversa', delta: 8 });
  }

  const prazo = pegar('Perguntou prazo') ?? pegar('Perguntou implantação');
  if (prazo) {
    fatores.push({ label: 'Perguntou sobre implantação ou prazo', delta: 7, evidence: prazo.evidence });
  }

  const expansao = pegar('Mencionou expansão') ?? pegar('Mencionou filiais') ?? pegar('Mencionou licenças');
  if (expansao) {
    fatores.push({ label: 'Mencionou expansão', delta: 7, evidence: expansao.evidence });
  }

  const preferencia =
    pegar('Quer consolidar na TOTVS') ??
    pegar('Preferência declarada pela TOTVS') ??
    pegar('Quer unificar fornecedor');
  if (preferencia) {
    fatores.push({
      label: 'Declarou preferência por consolidar na TOTVS',
      delta: 8,
      evidence: preferencia.evidence,
    });
  }

  if (e.temBudget) {
    fatores.push({ label: 'Budget declarado', delta: 6 });
  }

  if (e.sentimento === 'positivo') {
    fatores.push({ label: 'Sentimento positivo dominante', delta: 5 });
  }

  if (e.confianca >= 70) {
    fatores.push({ label: 'Confiança alta com o vendedor', delta: 5 });
  }

  const objPreco = e.objecoes.find((o) => o.category === 'preco' && !o.resolved);
  if (objPreco) {
    fatores.push({ label: 'Objeção de preço em aberto', delta: -8, evidence: objPreco.evidence });
  }

  const concAtivo = e.concorrentes.find((c) => c.active);
  if (concAtivo) {
    fatores.push({
      label: `Concorrente ativo na disputa (${concAtivo.name})`,
      delta: -10,
      evidence: concAtivo.evidence,
    });
  }

  if (existe(e.prep, 'remarcar|adiar|adiado|remarcado|fica (?:pra|para) (?:a )?proxima')) {
    fatores.push({ label: 'Reunião adiada ou remarcada', delta: -6 });
  }

  // Sinal de churn: -15 cada, com teto de -30.
  if (e.churn.length > 0) {
    const total = Math.max(-30, e.churn.length * -15);
    const primeiro = e.churn[0] as SinalPontuado;
    fatores.push({
      label: `Sinais de churn na conversa (${e.churn.length})`,
      delta: total,
      evidence: primeiro.evidence,
    });
  }

  if (e.sentimento === 'negativo') {
    fatores.push({ label: 'Sentimento negativo dominante', delta: -8 });
  }

  if (!e.temProximoPasso) {
    fatores.push({ label: 'Reunião terminou sem próximo passo', delta: -7 });
  }

  const soma = fatores.reduce((s, f) => s + f.delta, 0);
  const score = Math.round(limitar(soma, 0, 100));

  if (score !== soma) {
    fatores.push({ label: 'Limite 0–100 aplicado', delta: score - soma });
  }

  return { interest_score: score, score_factors: fatores };
}

/* ------------------------------------------------------------------ *
 * Risco de churn
 * ------------------------------------------------------------------ */

export type EntradaChurn = {
  prep: Preparado;
  churn: SinalPontuado[];
  objecoes: Objecao[];
  concorrentes: Concorrente[];
  memoria?: MemoriaCliente | undefined;
};

export type ResultadoChurn = { churn_risk: number; fatores: FatorScore[] };

/**
 * Composição do spec 7.7: sinais na reunião (60%), queda de interesse nas
 * últimas 3 reuniões (20%), objeções repetidas sem resolver (10%) e tarefas
 * nossas atrasadas (10%).
 *
 * Numa primeira reunião não existe histórico. Em vez de zerar os 40% restantes
 * — o que faria toda primeira conversa parecer segura —, o peso é renormalizado
 * entre os componentes disponíveis. A UI diz quais entraram na conta.
 */
export function calcularChurn(e: EntradaChurn): ResultadoChurn {
  const fatores: FatorScore[] = [];
  const partes: { peso: number; valor: number }[] = [];

  /*
   * Calibração: com a soma crua dos pesos, reuniões em que o cliente diz
   * "não vou renovar" e "vou reduzir licenças" ficavam em risco médio. Sinais
   * de churn se reforçam — quem diz três coisas ruins não está 50% pior que
   * quem diz duas. O fator 1.5 reflete esse acúmulo e foi calibrado contra a
   * banda anotada no corpus dev.
   */
  const somaChurn = Math.min(100, e.churn.reduce((s, x) => s + x.weight, 0) * 1.5);

  /*
   * Concorrente sendo avaliado agora é risco de perder a conta, mesmo sem o
   * cliente falar em cancelar. Sem isto, uma reunião com "viram a demo do
   * concorrente e gostaram" exibia churn 0 ao lado de "ameaça alta" — dois
   * números da mesma tela se contradizendo.
   */
  const ativos = e.concorrentes.filter((c) => c.active);
  const pesoConcorrencia = ativos.reduce(
    (s, c) => s + (c.threat === 'alta' ? 20 : c.threat === 'media' ? 12 : 0),
    0,
  );

  const pesoSinais = Math.min(100, somaChurn + pesoConcorrencia);
  partes.push({ peso: 0.6, valor: pesoSinais });

  if (somaChurn > 0) {
    const primeiro = e.churn[0] as SinalPontuado;
    fatores.push({
      label: `Sinais de risco ditos na reunião (${e.churn.length})`,
      delta: Math.round(Math.min(100, somaChurn) * 0.6),
      evidence: primeiro.evidence,
    });
  }

  if (pesoConcorrencia > 0) {
    const primeiro = ativos[0] as Concorrente;
    fatores.push({
      label: `Concorrente em avaliação ativa (${ativos.map((c) => c.name).join(', ')})`,
      delta: Math.round(pesoConcorrencia * 0.6),
      evidence: primeiro.evidence,
    });
  }

  const hist = e.memoria?.interesse_historico ?? [];
  if (hist.length >= 2) {
    const ultimos = hist.slice(-3);
    const primeiro = ultimos[0] as number;
    const ultimo = ultimos[ultimos.length - 1] as number;
    const queda = limitar(primeiro - ultimo, 0, 100);
    partes.push({ peso: 0.2, valor: queda });
    if (queda > 0) {
      fatores.push({ label: `Interesse caiu ${queda} pontos nas últimas reuniões`, delta: Math.round(queda * 0.2) });
    }
  }

  const recorrentes = e.memoria?.objecoes_recorrentes ?? [];
  const naoResolvidas = recorrentes.filter((o) => o.mencoes >= 2).length;
  if (recorrentes.length > 0) {
    const valor = limitar(naoResolvidas * 35, 0, 100);
    partes.push({ peso: 0.1, valor });
    if (valor > 0) {
      fatores.push({ label: `Objeções recorrentes sem endereçar (${naoResolvidas})`, delta: Math.round(valor * 0.1) });
    }
  }

  const atrasadas = e.memoria?.promessas_nao_cumpridas ?? [];
  if (atrasadas.length > 0) {
    const valor = limitar(atrasadas.length * 30, 0, 100);
    partes.push({ peso: 0.1, valor });
    fatores.push({ label: `Compromissos nossos atrasados (${atrasadas.length})`, delta: Math.round(valor * 0.1) });
  }

  const pesoTotal = partes.reduce((s, p) => s + p.peso, 0);
  const bruto = pesoTotal > 0 ? partes.reduce((s, p) => s + p.valor * p.peso, 0) / pesoTotal : 0;

  return { churn_risk: Math.round(limitar(bruto, 0, 100)), fatores };
}

export function bandaChurn(risco: number): 'baixo' | 'medio' | 'alto' {
  if (risco >= 67) return 'alto';
  if (risco >= 34) return 'medio';
  return 'baixo';
}

/** Marca a reunião como "sem compromisso" para o resumo e o score. */
export function evidenciaDeAusencia(prep: Preparado) {
  const ultima = prep.sentencas[prep.sentencas.length - 1];
  return ultima ? evidenciaEm(prep, ultima.inicio, ultima.fim) : undefined;
}
