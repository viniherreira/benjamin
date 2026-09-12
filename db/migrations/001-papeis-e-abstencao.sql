-- Benjamin — migration 001
-- Papel de falante persistido + abstenção dos scores.
--
-- COMO RODAR
--   Supabase → SQL Editor → cole este arquivo inteiro → Run.
--   https://supabase.com/dashboard/project/xnesguzipbxbpbfgiyzj/sql/new
--
-- É seguro rodar mais de uma vez: `if not exists` e `drop not null` são
-- idempotentes no Postgres.
--
-- DEPOIS DE RODAR
--   1. Regerar lib/supabase/database.types.ts (MCP Supabase).
--   2. Trocar o `?? 0` de gravarAnalise em lib/supabase/persistencia.ts por
--      null direto, e remover a leitura condicional em linhaParaAnalise — o
--      flag em transcript_quality deixa de ser necessário para reconstruir a
--      abstenção.

begin;

-- ------------------------------------------------------------------
-- 1. speakers — quem é vendedor, quem é cliente, e por quê
-- ------------------------------------------------------------------
--
-- O motor já infere o papel de cada falante com confiança e sinais, mas isso
-- morria na memória: nada disso sobrevivia ao banco. A faixa de confirmação no
-- briefing depende desta coluna existir — sem ela o vendedor confirma o papel e
-- a tela esquece no reload, o que transforma a correção humana em teatro.
--
-- Formato de cada item (FalanteInferido, lib/analysis/types.ts):
--   { "name": "Ana", "side": "vendedor", "confidence": 0.83,
--     "signals": ["cargo_fornecedor", "dexis_fornecedor"],
--     "words": 214, "turns": 7 }
--
-- Default '[]' para as linhas já existentes: análise antiga não tem papel
-- gravado, e lista vazia é a resposta honesta — melhor que inventar lado.

alter table public.analyses
  add column if not exists speakers jsonb not null default '[]'::jsonb;

comment on column public.analyses.speakers is
  'Papel inferido por falante (FalanteInferido[]): lado, confiança e sinais da decisão. '
  '[] quando a transcrição não tem marcação de falante.';

-- ------------------------------------------------------------------
-- 2. interest_score e churn_risk passam a aceitar a abstenção
-- ------------------------------------------------------------------
--
-- Sem separar a fala do cliente da do vendedor, estes dois números não são
-- estimativa ruim: são invenção, e no extremo da escala. Medido numa
-- transcrição de áudio real sem diarização — churn 100 e interesse 12 num
-- cliente que dizia "não é que a gente já decidiu sair" e "prefiro resolver com
-- vocês". O motor passou a devolver null nesse caso.
--
-- Enquanto estas colunas forem NOT NULL, a abstenção não cabe no banco e é
-- gravada como 0. A aplicação reconstrói o null pelo flag `scores_atribuiveis`
-- em transcripts.quality, mas uma consulta SQL direta lê 0 e entende "sem
-- risco" — que é exatamente a leitura errada, e a mais cara num produto de
-- retenção.

alter table public.analyses
  alter column interest_score drop not null,
  alter column churn_risk     drop not null;

comment on column public.analyses.interest_score is
  'null = o motor se absteve: não foi possível atribuir a fala a um lado da mesa. '
  'Não confundir com 0.';

comment on column public.analyses.churn_risk is
  'null = o motor se absteve: não foi possível atribuir a fala a um lado da mesa. '
  'Não confundir com 0 — 0 afirma conta saudável, null não afirma nada.';

commit;

-- ------------------------------------------------------------------
-- Conferência
-- ------------------------------------------------------------------
-- Deve devolver três linhas: speakers NO, interest_score YES, churn_risk YES.
--
--   select column_name, is_nullable, data_type
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name   = 'analyses'
--      and column_name in ('speakers', 'interest_score', 'churn_risk')
--    order by column_name;
