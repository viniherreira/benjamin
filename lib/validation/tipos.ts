import type {
  BusinessUnit,
  CategoriaObjecao,
  PoderDecisao,
  Sentimento,
  StatusProduto,
} from '../analysis/types';

/**
 * Contrato do corpus de validação.
 *
 * O gabarito é anotado a partir do TEXTO, nunca a partir da saída do motor.
 * Anotar olhando o resultado é como corrigir a prova com o gabarito do aluno —
 * produz F1 alto e informação zero.
 */

export type Gabarito = {
  produtos: { nome: string; status: StatusProduto }[];
  concorrentes: { nome: string; ativo: boolean }[];
  objecoes: CategoriaObjecao[];
  dores: string[];
  unidades_oportunidade: BusinessUnit[];
  churn_claro: boolean;
  upsell_claro: boolean;
  budget: number | null;
  sentimento: Sentimento;
  poder_decisao: PoderDecisao;
  /** Faixa aceitável, não valor exato: score é estimativa, não verdade absoluta. */
  interesse: [number, number];
  churn_risco: 'baixo' | 'medio' | 'alto';
  talk_ratio_vendedor?: [number, number];
};

export type Particao = 'dev' | 'holdout';

export type Amostra = {
  codigo: string;
  cenario: string;
  /**
   * dev: posso ler os erros e ajustar os léxicos.
   * holdout: só rodo a métrica. Nunca olho o erro individual para tunar.
   * Se dev >> holdout, o motor está decorado e o relatório precisa dizer isso.
   */
  particao: Particao;
  persona?: string;
  cliente?: string;
  data?: string;
  texto: string;
  gold: Gabarito;
};

/** Gabarito neutro — o que não é citado no texto não é esperado na saída. */
export const GOLD_VAZIO: Gabarito = {
  produtos: [],
  concorrentes: [],
  objecoes: [],
  dores: [],
  unidades_oportunidade: [],
  churn_claro: false,
  upsell_claro: false,
  budget: null,
  sentimento: 'neutro',
  poder_decisao: 'desconhecido',
  interesse: [30, 60],
  churn_risco: 'baixo',
};

export const gold = (p: Partial<Gabarito>): Gabarito => ({ ...GOLD_VAZIO, ...p });
