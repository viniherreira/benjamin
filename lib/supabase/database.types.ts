/**
 * Tipos do schema do InsightIQ.
 *
 * Escritos a partir do schema real do projeto (gerado pelo Supabase e compactado
 * à mão). Sempre que a migration mudar, este arquivo muda junto — é ele que dá
 * segurança de tipo em toda leitura e escrita no banco.
 */

export type Json = string | number | boolean | null | { [k: string]: Json | undefined } | Json[];

/** Campos obrigatórios no insert (NOT NULL sem default); o resto é opcional. */
type Insercao<R, Obrigatorios extends keyof R> = Pick<R, Obrigatorios> &
  Partial<Omit<R, Obrigatorios>>;

type Tabela<R, Obrigatorios extends keyof R> = {
  Row: R;
  Insert: Insercao<R, Obrigatorios>;
  Update: Partial<R>;
  Relationships: [];
};

export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

export type AppUserRow = {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  role: string;
  created_at: string;
};

export type CustomerRow = {
  id: string;
  org_id: string;
  name: string;
  segment: string | null;
  size: string | null;
  owner_id: string | null;
  stage: string;
  health_score: number;
  health_band: string;
  health_factors: Json;
  totvs_stack: Json;
  open_needs: Json;
  open_objections: Json;
  contract_value: number | null;
  upsell_potential: number | null;
  trust_level: number;
  created_at: string;
  updated_at: string;
};

export type MeetingRow = {
  id: string;
  org_id: string;
  customer_id: string | null;
  owner_id: string | null;
  title: string;
  meeting_type: string;
  meeting_date: string;
  duration_min: number | null;
  source: string;
  audio_path: string | null;
  status: string;
  error_message: string | null;
  created_at: string;
};

export type TranscriptRow = {
  id: string;
  meeting_id: string;
  raw_text: string;
  clean_text: string;
  language: string;
  word_count: number;
  turn_count: number;
  speakers: Json;
  redactions: Json;
  quality: Json;
  stt_provider: string | null;
  created_at: string;
};

export type AnalysisRow = {
  id: string;
  meeting_id: string;
  engine: string;
  model: string | null;
  summary: string;
  customer_needs: Json;
  problems: Json;
  decisions: Json;
  objections: Json;
  next_steps: Json;
  opportunities: Json;
  risks: Json;
  totvs_products: Json;
  competitors: Json;
  budget: Json;
  persona: Json;
  sentiment: string;
  sentiment_score: number;
  aspect_sentiment: Json;
  interest_score: number;
  churn_risk: number;
  churn_signals: Json;
  upsell_signals: Json;
  trust_score: number;
  trust_signals: Json;
  conversation_metrics: Json;
  bant: Json;
  voice_of_customer: Json;
  business_value: Json;
  score_factors: Json;
  evidence: Json;
  latency_ms: number | null;
  token_cost: number | null;
  created_at: string;
};

export type ActionItemRow = {
  id: string;
  org_id: string;
  meeting_id: string | null;
  customer_id: string | null;
  description: string;
  responsible: string | null;
  side: string;
  due_date: string | null;
  done: boolean;
  evidence: string | null;
  created_at: string;
};

export type AlertRow = {
  id: string;
  org_id: string;
  customer_id: string | null;
  meeting_id: string | null;
  kind: string;
  severity: string;
  audience: string;
  title: string;
  message: string;
  evidence: string | null;
  value_at_stake: number | null;
  read: boolean;
  created_at: string;
};

export type PainSignalRow = {
  id: string;
  org_id: string;
  meeting_id: string | null;
  customer_id: string | null;
  raw_text: string;
  canonical_topic: string;
  category: string | null;
  business_unit: string | null;
  severity: string;
  evidence: string | null;
  created_at: string;
};

export type CorrectionRow = {
  id: string;
  analysis_id: string;
  user_id: string | null;
  field: string;
  action: string;
  before_value: Json | null;
  after_value: Json | null;
  created_at: string;
};

export type CorpusSampleRow = {
  id: string;
  code: string;
  origin: string;
  scenario: string;
  persona: string | null;
  raw_text: string;
  gold: Json;
  collection_meta: Json;
  created_at: string;
};

export type ValidationRunRow = {
  id: string;
  engine: string;
  model: string | null;
  corpus: string;
  sample_count: number;
  metrics: Json;
  per_field: Json;
  avg_latency_ms: number | null;
  p95_latency_ms: number | null;
  throughput_per_min: number | null;
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      organizations: Tabela<OrganizationRow, 'name' | 'slug'>;
      app_users: Tabela<AppUserRow, 'org_id' | 'name'>;
      customers: Tabela<CustomerRow, 'org_id' | 'name'>;
      meetings: Tabela<MeetingRow, 'org_id' | 'title'>;
      transcripts: Tabela<TranscriptRow, 'meeting_id' | 'raw_text'>;
      analyses: Tabela<AnalysisRow, 'meeting_id'>;
      action_items: Tabela<ActionItemRow, 'org_id' | 'description'>;
      alerts: Tabela<AlertRow, 'org_id' | 'kind' | 'title' | 'message'>;
      pain_signals: Tabela<PainSignalRow, 'org_id' | 'raw_text' | 'canonical_topic'>;
      corrections: Tabela<CorrectionRow, 'analysis_id' | 'field' | 'action'>;
      corpus_samples: Tabela<CorpusSampleRow, 'code' | 'scenario' | 'raw_text'>;
      validation_runs: Tabela<ValidationRunRow, 'engine' | 'sample_count'>;
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
