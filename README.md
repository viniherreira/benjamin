# InsightIQ

**O ouro invisível de cada conversa.**

Analisa transcrições brutas de reuniões de vendas e Customer Success e extrai
automaticamente oportunidades, riscos de churn e o mapeamento do ecossistema
TOTVS do cliente — cada item com a citação literal que o originou.

Challenge FIAP × TOTVS 2026 — Inteligência Conversacional.

🔗 **https://benjamin-rose.vercel.app**

---

## O que é e o que não é

| ✓ É | ✗ Não é |
|---|---|
| Analisador de transcrições com IA | Um CRM completo |
| Ferramenta de apoio ao vendedor | Um gravador de reuniões |
| Extrator de inteligência comercial | Ferramenta de BI genérica |
| Motor de decisão comercial | Substituto do vendedor |

| ✓ Faz | ✗ Não faz |
|---|---|
| Processa texto bruto de reuniões | Substitui o trabalho humano |
| Identifica gatilhos de compra | Toma decisões pelo vendedor |
| Sinaliza frases de insatisfação e risco | Integra a um CRM (v1 exporta o payload) |
| Mapeia produtos TOTVS no diálogo | Analisa áudio no núcleo (é adaptador plugável) |

---

## As três camadas

**1. Análise da reunião.** Transcrição entra, briefing estruturado sai:
oportunidades, retenção, ecossistema, persona, sentimento por aspecto, budget,
tarefas, decisões, próximos passos — cada item clicável, destacando o trecho de
origem na transcrição.

**2. Memória do cliente.** A análise não é isolada: cada nova reunião recebe o
histórico da conta como contexto. É o que permite ao sistema concluir *"preço é
objeção recorrente — 3 das últimas reuniões, ainda não endereçada"*, informação
que nenhuma reunião sozinha contém.

**3. Torre de controle.** Radar de dores agregado, contas em risco com R$ em
risco, pipeline por unidade de negócio (Gestão, RD Station, Techfin), coaching
de talk ratio e alertas por severidade.

---

## Rodando localmente

**Requisitos:** Node 20+ e um projeto Supabase com o schema aplicado.

```bash
git clone https://github.com/viniherreira/benjamin.git
cd benjamin
npm install
cp .env.local.example .env.local   # preencha as duas variáveis obrigatórias
npm run dev
```

Variáveis de ambiente:

```bash
NEXT_PUBLIC_SUPABASE_URL=      # obrigatória
SUPABASE_SERVICE_ROLE_KEY=     # obrigatória — nunca vai para o cliente
ANTHROPIC_API_KEY=             # opcional — ativa o motor híbrido
OPENAI_API_KEY=                # opcional — ativa transcrição de áudio
```

**O app funciona só com as duas primeiras.** Faltando as opcionais, cada
funcionalidade degrada com mensagem explícita — nunca com simulação.

### Popular a base

```bash
curl -X POST http://localhost:3000/api/seed
```

Ingere o arco de 5 reuniões da Metalúrgica Vale Verde e o corpus sintético
completo, usando o mesmo texto que a validação mede. É idempotente.

---

## Validando

```bash
npm test                     # 27 testes
npm run validar              # tabela completa de métricas
npm run validar -- --erros   # erros da partição DEV (o holdout não é aberto)
```

A mesma medição roda na interface em `/validacao`, pelo botão **Rodar validação
agora**. Cada execução fica gravada, o que permite comparar rodadas.

Resultados da última execução, metodologia e **análise honesta dos erros** em
[VALIDACAO.md](VALIDACAO.md).

---

## Decisões técnicas

### O motor é determinístico

Sem LLM por padrão. Custo de **R$ 0,00 por análise**, latência p95 de **3,7 ms**,
saída idêntica para a mesma entrada e cada campo auditável até a regra que o
produziu.

O desafio pergunta como processar 10.000 reuniões/dia em tempo real — isso tem
consequência arquitetural. As regras garantem o que precisa ser previsível
(produtos, valores, prazos, concorrentes, métricas de conversa); o provider de
LLM está no contrato e entra sem refatoração para enriquecer resumo e nuance.

O custo dessa escolha está medido e reportado, não escondido.

### Toda extração carrega evidência

Item sem citação rastreável **não é retornado**. Cobertura medida: **100%**.

Um teste de invariante verifica em todo o corpus que
`texto.slice(start, end) === quote`. É por isso que clicar num item do briefing
destaca o trecho exato — e é a razão de a anonimização preservar o comprimento do
texto (`###.###.###-##`, não `[CPF]`).

### IH + IA

A IA propõe com a evidência; o humano confirma ou corrige. Cada intervenção é
gravada com o valor anterior, e a **taxa de correção por campo** aparece na tela
de validação. O sistema mede a própria falibilidade.

### Nada mockado

Todo número na interface veio do Postgres ou de execução real do motor. Toda tela
tem estado vazio desenhado, explicando o que vai aparecer ali e como fazer
aparecer.

---

## Stack

Next.js 15 (App Router) · TypeScript estrito · Tailwind v4 · Supabase
(PostgreSQL) · zod · lucide-react · recharts · Vercel

Sem UI kit pesado — os componentes são próprios. Gráficos leves são SVG inline
renderizado no servidor.

---

## Estrutura

```
app/            telas e rotas de API
lib/analysis/   NÚCLEO — TypeScript puro, sem I/O, testável isoladamente
lib/validation/ corpus e métricas
lib/supabase/   acesso ao banco (exclusivo do servidor)
components/     primitivas de interface
scripts/        validação por linha de comando
```

---

## Documentação

| Documento | Conteúdo |
|---|---|
| [ARQUITETURA.md](ARQUITETURA.md) | Fluxo do dado, decisão do motor, modelo de dados, plano de escala |
| [VALIDACAO.md](VALIDACAO.md) | Coleta, tratamento, análise e métricas — incluindo onde o motor erra |
| [PROTOCOLO-CORPUS.md](PROTOCOLO-CORPUS.md) | Protocolo de gravação e anotação do corpus real |
| [PESQUISA.md](PESQUISA.md) | Fontes do slide de problema, com link e data de acesso |
| [DEMO.md](DEMO.md) | Roteiro de demonstração de 3 minutos |

---

## Segurança e LGPD

- RLS habilitado em todas as tabelas; acesso ao banco **exclusivo do servidor**
- Anonimização automática de CPF, CNPJ, e-mail, telefone e cartão antes da
  análise — guarda-se tipo e posição, **nunca o valor**
- O que é persistido e exibido é o texto já anonimizado
- Captura ao vivo exige aviso de consentimento **antes** de abrir o microfone
- Nenhuma chave secreta no bundle do cliente
