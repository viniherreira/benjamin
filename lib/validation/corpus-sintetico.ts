import { ARCO_JOAO } from './corpus/arco-joao';
import { CORPUS_DEV } from './corpus/dev';
import { CORPUS_HOLDOUT } from './corpus/holdout';
import type { Amostra } from './tipos';

/**
 * Corpus B — sintético.
 *
 * Complementa o corpus real: cobre cenários raros, casos-armadilha e volume
 * para estatística. As amostras foram escritas a partir dos cenários e das
 * personas ANTES dos extratores existirem na forma final, e o gabarito foi
 * anotado lendo o texto.
 *
 * Divisão: 17 em dev (que eu leio para ajustar) e 13 em holdout (lacradas).
 */
export const CORPUS_SINTETICO: Amostra[] = [...ARCO_JOAO, ...CORPUS_DEV, ...CORPUS_HOLDOUT];

export { ARCO_JOAO, CORPUS_DEV, CORPUS_HOLDOUT };

/** Conferência de cobertura — roda junto com a validação. */
export function coberturaCorpus() {
  const c = CORPUS_SINTETICO;
  return {
    total: c.length,
    dev: c.filter((a) => a.particao === 'dev').length,
    holdout: c.filter((a) => a.particao === 'holdout').length,
    com_concorrente: c.filter((a) => a.gold.concorrentes.length > 0).length,
    com_objecao_preco: c.filter((a) => a.gold.objecoes.includes('preco')).length,
    com_churn_claro: c.filter((a) => a.gold.churn_claro).length,
    com_upsell: c.filter((a) => a.gold.upsell_claro).length,
    com_budget: c.filter((a) => a.gold.budget !== null).length,
    sem_sinal: c.filter(
      (a) =>
        a.gold.concorrentes.length === 0 &&
        a.gold.objecoes.length === 0 &&
        !a.gold.churn_claro &&
        !a.gold.upsell_claro &&
        a.gold.budget === null,
    ).length,
    techfin: c.filter((a) => a.gold.unidades_oportunidade.includes('techfin')).length,
    rd_station: c.filter((a) => a.gold.unidades_oportunidade.includes('rd_station')).length,
    cenarios: [...new Set(c.map((a) => a.cenario))].length,
  };
}
