/**
 * Contrato do motor de análise do InsightIQ.
 *
 * Este arquivo é TypeScript puro: não conhece Next, não conhece Supabase, não
 * faz I/O. É o que torna o motor testável isoladamente e é o que alimenta a
 * tela de validação.
 */

/* ------------------------------------------------------------------ *
 * Evidência — a espinha dorsal do produto
 * ------------------------------------------------------------------ */

/**
 * Toda extração carrega a citação literal que a originou.
 *
 * `start` e `end` são índices de caractere no texto seguro da transcrição
 * (o texto já anonimizado, que é o que fica guardado e o que a UI exibe).
 * Invariante verificado em teste: texto.slice(start, end) === quote.
 */
export type Evidence = {
  quote: string;
  start: number;
  end: number;
  speaker?: string;
};

export type BusinessUnit = 'gestao' | 'rd_station' | 'techfin' | 'indefinido';

export type StatusProduto = 'em_uso' | 'avaliando' | 'mencionado' | 'oportunidade';

export type TipoOportunidade = 'upsell' | 'cross_sell' | 'expansao' | 'novo';

export type Ameaca = 'alta' | 'media' | 'baixa';

export type Severidade = 'alta' | 'media' | 'baixa';

export type CategoriaObjecao =
  | 'preco'
  | 'prazo'
  | 'tecnica'
  | 'processo'
  | 'concorrencia'
  | 'autoridade'
  | 'outro';

export type Polaridade = 'positivo' | 'neutro' | 'negativo';

export type Sentimento = 'positivo' | 'neutro' | 'negativo' | 'misto';

export type PoderDecisao = 'decisor' | 'influenciador' | 'usuario' | 'desconhecido';

export type Lado = 'vendedor' | 'cliente' | 'desconhecido';

export type TipoVoz = 'elogio' | 'reclamacao' | 'legado' | 'duvida_jornada' | 'feedback_produto';

export type TipoBudget = 'declarado' | 'estimado' | 'limite';

/* ------------------------------------------------------------------ *
 * Itens extraídos
 * ------------------------------------------------------------------ */

export type ProdutoTotvs = {
  name: string;
  unit: BusinessUnit;
  status: StatusProduto;
  confidence: number;
  evidence: Evidence;
};

export type Oportunidade = {
  product: string;
  unit: BusinessUnit;
  kind: TipoOportunidade;
  probability: number;
  estimated_value?: number;
  rationale: string;
  evidence: Evidence;
};

export type Concorrente = {
  name: string;
  context: string;
  threat: Ameaca;
  /** "usava na empresa anterior" => false. Concorrente histórico não é ameaça. */
  active: boolean;
  evidence: Evidence;
};

export type SinalPontuado = {
  text: string;
  weight: number;
  evidence: Evidence;
};

export type Necessidade = {
  text: string;
  confidence: number;
  evidence: Evidence;
};

export type Problema = {
  text: string;
  category: string;
  confidence: number;
  evidence: Evidence;
};

export type Decisao = {
  text: string;
  confidence: number;
  evidence: Evidence;
};

export type Objecao = {
  text: string;
  category: CategoriaObjecao;
  resolved: boolean;
  confidence: number;
  evidence: Evidence;
};

export type ProximoPasso = {
  text: string;
  confidence: number;
  evidence: Evidence;
};

export type Risco = {
  text: string;
  severity: Severidade;
  evidence: Evidence;
};

export type Tarefa = {
  description: string;
  responsible: string | null;
  side: 'interno' | 'cliente';
  due_date: string | null;
  evidence: Evidence;
};

export type Budget = {
  amount: number | null;
  currency: 'BRL';
  raw: string;
  kind: TipoBudget;
  /** true quando o cliente pediu sigilo perto do valor. */
  confidential: boolean;
  evidence: Evidence;
};

export type Persona = {
  name?: string;
  role?: string;
  decision_power: PoderDecisao;
  evidence?: Evidence;
};

export type SentimentoAspecto = {
  aspect: string;
  polarity: Polaridade;
  score: number;
  evidence: Evidence;
};

export type VozDoCliente = {
  type: TipoVoz;
  target?: string;
  text: string;
  evidence: Evidence;
};

export type SinalConfianca = {
  label: string;
  delta: number;
  evidence: Evidence;
};

export type FatorScore = {
  label: string;
  delta: number;
  evidence?: Evidence;
};

/* ------------------------------------------------------------------ *
 * Métricas
 * ------------------------------------------------------------------ */

/**
 * Métricas de conversa. Tudo aqui é `null` quando a transcrição não tem
 * marcação de falante — não se inventa turno que não existe.
 */
export type MetricasConversa = {
  talk_ratio_seller: number | null;
  talk_ratio_customer: number | null;
  longest_monologue_words: number | null;
  seller_questions: number | null;
  open_questions: number | null;
  closed_questions: number | null;
  words_before_first_question: number | null;
  interruptions: number | null;
  followup_depth: number | null;
  turn_count: number;
};

export type Bant = {
  budget: boolean;
  authority: boolean;
  need: boolean;
  timeline: boolean;
  score: number;
  missing: string[];
};

/** Indicadores sobre a transcrição — a resposta à provocação B da TOTVS. */
export type QualidadeTranscricao = {
  word_count: number;
  turn_count: number;
  speaker_count: number;
  estimated_minutes: number;
  has_diarization: boolean;
  inaudible_ratio: number;
  filler_density: number;
  lexical_diversity: number;
  redacted_entities: number;
  reliability_index: number;
  warnings: string[];
};

export type ValorDeNegocio = {
  revenue_at_risk: number | null;
  pipeline_value: number | null;
  assumptions: string[];
};

/* ------------------------------------------------------------------ *
 * Resultado
 * ------------------------------------------------------------------ */

export type Motor = 'rules' | 'llm' | 'hybrid';

export type AnalysisResult = {
  summary: string;

  // Núcleo pedido pela TOTVS
  totvs_products: ProdutoTotvs[];
  opportunities: Oportunidade[];
  competitors: Concorrente[];
  churn_signals: SinalPontuado[];
  upsell_signals: SinalPontuado[];

  // Extração clássica
  customer_needs: Necessidade[];
  problems: Problema[];
  decisions: Decisao[];
  objections: Objecao[];
  next_steps: ProximoPasso[];
  risks: Risco[];
  action_items: Tarefa[];
  budget: Budget[];
  persona: Persona;

  // Sentimento por aspecto — exigido pelo exemplo canônico
  sentiment: Sentimento;
  sentiment_score: number;
  aspect_sentiment: SentimentoAspecto[];

  // Além do óbvio (provocação A)
  voice_of_customer: VozDoCliente[];
  trust_score: number;
  trust_signals: SinalConfianca[];

  // Qualidade do dado (provocação B)
  conversation_metrics: MetricasConversa;
  transcript_quality: QualidadeTranscricao;
  bant: Bant;

  // Scores explicáveis.
  // Invariante: a soma dos deltas de `score_factors` é EXATAMENTE
  // `interest_score`. Por isso os fatores de churn moram em campo próprio —
  // misturar os dois quebraria a conta que a UI mostra ao vendedor.
  interest_score: number;
  churn_risk: number;
  score_factors: FatorScore[];
  churn_factors: FatorScore[];

  business_value: ValorDeNegocio;

  engine: Motor;
  model?: string;
  latency_ms: number;
};

/* ------------------------------------------------------------------ *
 * Entrada
 * ------------------------------------------------------------------ */

/**
 * Memória do cliente injetada na análise (camada 2 do produto).
 * A análise de uma reunião isolada não sabe que "preço" já apareceu 3 vezes.
 */
export type MemoriaCliente = {
  necessidades_abertas: { texto: string; mencoes: number }[];
  objecoes_recorrentes: { texto: string; categoria: CategoriaObjecao; mencoes: number }[];
  decisoes: string[];
  promessas_nao_cumpridas: { texto: string; dias_atraso: number }[];
  interesse_historico: number[];
  confianca_historica: number[];
  stack_totvs: { produto: string; unidade: BusinessUnit; status: StatusProduto }[];
  contract_value?: number;
};

export type EntradaAnalise = {
  /** Texto bruto da transcrição. Única entrada obrigatória. */
  texto: string;
  /** Âncora para resolver prazos relativos ("até sexta"). ISO yyyy-mm-dd. */
  dataReuniao?: string;
  memoria?: MemoriaCliente;
};

/* ------------------------------------------------------------------ *
 * Estruturas internas do pipeline
 * ------------------------------------------------------------------ */

export type Turno = {
  falante: string;
  lado: Lado;
  ladoConfianca: number;
  /** Offsets do conteúdo do turno no texto seguro. */
  inicio: number;
  fim: number;
  texto: string;
  palavras: number;
};

export type Sentenca = {
  texto: string;
  inicio: number;
  fim: number;
  falante: string | null;
  lado: Lado;
};

export type Redacao = {
  type: 'cpf' | 'cnpj' | 'email' | 'telefone' | 'cartao';
  start: number;
  end: number;
};
