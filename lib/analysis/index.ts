import type { AnalysisResult, EntradaAnalise } from './types';
import { analisarComRegras } from './rules/engine';

/**
 * API pública do motor de análise.
 *
 * Esta função é 100% determinística e continua sendo a única fonte de todo
 * campo que carrega evidência: sem rede, sem custo, saída idêntica para a mesma
 * entrada e cada campo auditável até a regra que o produziu. É por ela ser
 * síncrona e pura que dá para rodá-la sobre o corpus inteiro e medir latência
 * de verdade.
 *
 * O enriquecimento por LLM vive em lib/analysis/llm/, é assíncrono, opcional e
 * roda sob demanda por reunião — nunca no caminho do volume, e nunca
 * substituindo um campo daqui.
 */
export function analisar(entrada: EntradaAnalise): AnalysisResult {
  return analisarComRegras(entrada);
}

export type { AnalysisResult, EntradaAnalise };
export * from './types';
export { EXEMPLO_CANONICO, SAIDA_ESPERADA_TOTVS } from './exemplo-canonico';

/** Exposto para os testes de invariante e para o pipeline de ingestão. */
export { preparar } from './rules/segment';
