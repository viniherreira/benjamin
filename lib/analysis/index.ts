import type { AnalysisResult, EntradaAnalise } from './types';
import { analisarComRegras } from './rules/engine';

/**
 * API pública do motor de análise.
 *
 * Hoje o InsightIQ roda 100% determinístico: sem chave de LLM, sem custo por
 * análise, saída idêntica para a mesma entrada e cada campo auditável até a
 * regra que o produziu. O provider de LLM existe no contrato e entra sem
 * refatoração quando houver chave — ver lib/analysis/llm/.
 */
export function analisar(entrada: EntradaAnalise): AnalysisResult {
  return analisarComRegras(entrada);
}

export type { AnalysisResult, EntradaAnalise };
export * from './types';
export { EXEMPLO_CANONICO, SAIDA_ESPERADA_TOTVS } from './exemplo-canonico';

/** Exposto para os testes de invariante e para o pipeline de ingestão. */
export { preparar } from './rules/segment';
