import type { Evidence } from '../types';

/**
 * Contrato do enriquecimento por LLM.
 *
 * O motor determinístico continua sendo a fonte de todo campo que carrega
 * evidência — produtos, valores, prazos, concorrentes, scores e alertas. O que
 * está aqui é ADICIONAL e claramente separado, porque um modelo generativo pode
 * inventar e o produto inteiro se apoia em não inventar.
 *
 * A contenção é estrutural, não uma promessa:
 *  - `nuance` e `proxima_acao` só existem com citação encontrada LITERALMENTE na
 *    transcrição; o que não for localizado entra em `descartados` e não é exibido.
 *  - `resumo` é prosa e não tem como ser ancorado num trecho só. Por isso ele
 *    aparece na interface rotulado como gerado, ao lado do resumo extrativo, e
 *    nunca substitui nenhum campo do briefing.
 */

export type ItemAncorado = {
  texto: string;
  evidence: Evidence;
};

export type Descartado = {
  campo: 'nuance' | 'proxima_acao';
  texto: string;
  /** A citação que o modelo alegou e que não foi encontrada na transcrição. */
  citacao: string;
};

export type Enriquecimento = {
  resumo: string | null;
  nuance: ItemAncorado[];
  proxima_acao: ItemAncorado | null;
  /** O que o modelo produziu e foi recusado por não ter âncora no texto. */
  descartados: Descartado[];
  provider: 'gemini';
  model: string;
  latency_ms: number;
  tokens: { entrada: number; saida: number };
};

export type MotivoFalha =
  | 'sem_chave'
  | 'sem_texto'
  | 'limite_excedido'
  | 'provedor'
  | 'resposta_invalida';

export type ResultadoEnriquecimento =
  | { ok: true; dados: Enriquecimento }
  | { ok: false; motivo: MotivoFalha; detalhe: string };
