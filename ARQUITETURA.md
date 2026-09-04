# Arquitetura — InsightIQ

Challenge FIAP × TOTVS 2026 — Inteligência Conversacional.

---

## 1. Fluxo do dado

```
                     ┌─────────────────────────────────────┐
  ADAPTADORES        │  Colar texto   Upload áudio   Web    │
  DE ENTRADA         │   (padrão)      (STT)       Speech   │
                     └──────────────────┬──────────────────┘
                                        │  só produzem TEXTO
                                        ▼
                     ┌─────────────────────────────────────┐
  NÚCLEO             │  lib/analysis/  — TypeScript puro    │
  (sem I/O)          │                                     │
                     │  segment  → normaliza, diariza      │
                     │  redact   → anonimiza (LGPD)        │
                     │  extractors → produtos, concorrentes│
                     │  sentiment / trust / conversation   │
                     │  quality  → Índice de Confiabilidade│
                     │  scoring  → interesse, churn        │
                     └──────────────────┬──────────────────┘
                                        │  AnalysisResult tipado
                                        ▼
                     ┌─────────────────────────────────────┐
  PERSISTÊNCIA       │  lib/supabase/persistencia.ts       │
  (só no servidor)   │                                     │
                     │  meeting → transcript → analysis    │
                     │  + action_items + alerts + pains    │
                     │  + recalcula o retrato do cliente   │
                     └──────────────────┬──────────────────┘
                                        │
        ┌───────────────────────────────┼───────────────────────────────┐
        ▼                               ▼                               ▼
  CAMADA 1                        CAMADA 2                        CAMADA 3
  Briefing da reunião             Memória do cliente              Torre de controle
  /reunioes/[id]                  /clientes/[id]                  /torre  /radar  /coaching
                                  lib/memory.ts                   lib/torre.ts  lib/value.ts
                                        │
                                        └─→ realimenta a próxima análise
```

**O laço da camada 2 é o diferencial de produto.** Cada nova análise recebe o
histórico consolidado da conta como contexto. É o que permite ao sistema
concluir *"preço voltou em 3 reuniões e segue sem resolução"* — informação que
nenhuma reunião isolada contém.

---

## 2. Decisão: por que o motor é determinístico

O desafio pergunta como analisar **10.000 reuniões por dia** e avisar o Diretor
Comercial **em tempo real**. Essa pergunta tem consequência arquitetural.

| Critério | Regras (escolhido) | LLM |
|---|---|---|
| Custo por análise | R$ 0,00 | por token, × 10.000/dia |
| Latência p95 medida | 3,7 ms | centenas de ms a segundos |
| Determinismo | mesma entrada → mesma saída | varia entre execuções |
| Explicabilidade | rastreável até a regra | requer confiar na saída |
| Generalização | limitada ao léxico | alta |
| Fluência do resumo | montado por template | superior |

**Escolha: regras como base, LLM como enriquecimento.** As regras garantem o que
precisa ser previsível e auditável — produtos, valores, prazos, concorrentes,
métricas de conversa. O LLM, quando houver chave, enriquece resumo, nuance e
recomendações.

Isso está implementado em `lib/analysis/llm/` (provedor Gemini, camada gratuita)
e é **sob demanda, por reunião** — botão no briefing, nunca no caminho do volume.
A contenção é estrutural: cada observação do modelo só é exibida se a citação que
ela alega existir for encontrada literalmente na transcrição; o que não ancora é
descartado e contado na tela. O resumo gerado é prosa, não tem como ser ancorado
num trecho único, então aparece rotulado ao lado do resumo extrativo — nunca no
lugar dele, e nunca alimentando campo do briefing.

O provider é plugável (`lib/analysis/llm/gemini.ts` é o único arquivo que sabe
qual provedor responde), o contrato de saída é o mesmo, e o
rodapé de cada briefing declara qual motor rodou. Sem chave, o sistema roda
100% em regras **sem degradar a interface** — nenhuma tela fica vazia por falta
de credencial.

### O que essa decisão custa

Está medido e reportado em [VALIDACAO.md](VALIDACAO.md): sentimento em 4 classes
fica em 0,533 de acurácia e o interest score tem MAE de 18,4 pontos. São
exatamente os campos onde um LLM tende a ir melhor. A escolha foi trocar
precisão nesses dois campos por custo zero, latência de milissegundos e
auditabilidade nos campos que movem dinheiro.

---

## 3. Regras inegociáveis do código

| Regra | Onde é garantida |
|---|---|
| Banco só pelo servidor | `lib/supabase/server.ts` lança se chamado no cliente; `service_role` sem prefixo `NEXT_PUBLIC_` |
| Núcleo isolado | `lib/analysis/` não importa Next nem Supabase |
| Todo item tem evidência | Item sem citação não é retornado; teste de invariante sobre todo o corpus |
| Texto não muda de comprimento | `redact.ts` lança se o comprimento mudar |
| Score explica a si mesmo | Teste garante que a soma dos fatores é o score exibido |
| Nada mockado no frontend | Todo número vem do Postgres ou de execução real |

---

## 4. Modelo de dados

12 tabelas em PostgreSQL (Supabase, região `sa-east-1`), com RLS habilitado em
todas.

```
organizations ─┬─ app_users
               ├─ customers ──┬─ meetings ──┬─ transcripts
               │              │             ├─ analyses ── corrections
               │              │             ├─ action_items
               │              │             ├─ alerts
               │              │             └─ pain_signals
               │              └─ (health, stack, objeções — materializados)
               └─ corpus_samples, validation_runs
```

**Decisões de schema tomadas durante a construção:**

- `analyses.churn_factors` — adicionada porque o produto proíbe score sem os
  fatores que o explicam.
- Índice único em `meetings(org_id, title) WHERE source = 'corpus'` — duas
  chamadas concorrentes ao seed conseguiam criar a mesma reunião duas vezes,
  porque a checagem de existência morava na aplicação. A garantia foi movida
  para o banco, onde a corrida não existe.
- Índice único em `customers(org_id, lower(name))` — impede que o histórico de
  uma conta se divida entre dois cadastros.

O que é **materializado** em `customers` (health, stack, objeções em aberto,
rapport) é recalculado após cada análise. Isso permite que a lista de clientes e
a torre de controle leiam sem recomputar todo o histórico a cada request.

---

## 5. Escala — resposta às 10.000 reuniões/dia

### Medido, não estimado

`POST /api/batch/analyze` processa o corpus em lotes e devolve números reais.
Última execução nesta máquina:

| Métrica | Valor |
|---|---|
| Latência p50 | 1,75 ms |
| Latência p95 | 3,7 ms |
| Throughput, 1 processo | 31.573 análises/min |
| Throughput, 4 workers | ~126.000 análises/min |
| Custo de API | R$ 0,00 |

**10.000 reuniões/dia = cerca de 19 segundos de processamento** em um único
processo. O gargalo do sistema não é o motor: é I/O de banco e ingestão.

### Onde escala horizontalmente

```
  ingestão ──→ fila (SQS/PGMQ) ──→ workers (N) ──→ Postgres
                     │                  │
                     │                  └─ idempotência por (meeting_id)
                     └─ retry com backoff; DLQ após 3 tentativas
```

- **Ponto de corte horizontal:** o worker. O motor não tem estado compartilhado,
  então N workers escalam linearmente até saturar o banco.
- **Idempotência:** o reprocessamento (`POST /api/meetings/[id]/analyze`) apaga
  os artefatos derivados antes de regravar, então reprocessar duas vezes produz
  o mesmo estado.
- **Alerta em tempo real:** os alertas nascem como efeito colateral da análise,
  na mesma transação lógica. Publicá-los num tópico (ou usar Supabase Realtime)
  entrega ao Diretor Comercial sem polling.
- **Quando o LLM entrar:** a latência passa de milissegundos para centenas de
  ms e o custo deixa de ser zero. É por isso que a arquitetura híbrida mantém as
  extrações determinísticas fora do caminho do LLM — o volume roda em regras, e
  o LLM é chamado só onde agrega.

---

## 6. Stack

| Camada | Escolha | Por quê |
|---|---|---|
| Framework | Next.js 15 (App Router) | Server Components mantêm as chaves no servidor |
| Linguagem | TypeScript estrito | `noUncheckedIndexedAccess` e `noUnusedLocals` ligados; build falha com erro de tipo |
| Estilo | Tailwind v4 com CSS custom properties | Toda cor tem significado; tema claro troca só as variáveis |
| Banco | Supabase (PostgreSQL) | RLS, região brasileira, sem servidor para manter |
| Gráficos | SVG inline | Um sparkline não justifica mandar runtime de gráficos ao navegador |
| Validação | zod | Nas fronteiras de API, onde o dado é externo |
| Ícones | lucide-react | — |
| Deploy | Vercel | Deploy automático a cada push na `main` |

Sem UI kit pesado: os componentes são próprios, em `components/ui.tsx`.

---

## 7. Estrutura

```
app/
  page.tsx                    Dashboard do vendedor
  torre/                      Torre de controle (R$)
  reunioes/[id]/              Briefing com evidência clicável
  reunioes/nova/              Ingestão: texto, áudio, ao vivo
  clientes/[id]/              Memória do cliente
  clientes/[id]/preparar/     Briefing pré-reunião
  radar/                      Radar de dores agregado
  coaching/                   Talk ratio e performance
  alertas/                    Painel consolidado
  validacao/                  Metodologia e métricas ao vivo
  api/
    meetings/                 ingestão, reprocessamento, exportação CRM
    batch/analyze/            throughput medido
    validation/run/           execução da validação
    corrections/              IH + IA
    transcribe/               adaptador STT
    seed/                     popula corpus + arco

lib/
  analysis/                   NÚCLEO — TypeScript puro, sem I/O
    rules/                    segment, redact, extractors, scoring, quality…
    __tests__/                golden, armadilhas, invariantes de evidência
  validation/                 corpus e métricas
  supabase/                   servidor e persistência
  memory.ts  health.ts  value.ts  torre.ts  pains.ts  preparacao.ts
```

---

## 8. Variáveis de ambiente

```bash
NEXT_PUBLIC_SUPABASE_URL=      # obrigatória
SUPABASE_SERVICE_ROLE_KEY=     # obrigatória — nunca vai para o cliente
ANTHROPIC_API_KEY=             # opcional — ativa o motor híbrido
OPENAI_API_KEY=                # opcional — ativa transcrição de áudio
```

O app funciona com as duas primeiras. Faltando as opcionais, cada funcionalidade
degrada com uma mensagem explícita — nunca com simulação.
