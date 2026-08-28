# Roteiro de demonstração — 3 minutos

**URL:** https://benjamin-rose.vercel.app

O arco é: *a TOTVS pediu isso → nós entregamos → e aqui está a prova de que
funciona.* Cada tela responde a um item do briefing, e a última responde à
pergunta que a banca sempre faz: "e se a IA errar?".

Antes de começar: tema escuro, janela maximizada, e **as abas já abertas** na
ordem abaixo — trocar de aba é mais rápido e menos arriscado que navegar.

---

## 0:00 — 0:35 · O exemplo que a própria TOTVS deu

**Tela:** `/reunioes/nova`

> "O slide 15 do briefing traz um par input/output exato. É o nosso caso de
> teste número 1. Vamos rodar ao vivo."

1. Clicar em **usar exemplo TOTVS** — o texto do slide aparece no campo.
2. Clicar em **Analisar reunião**.
3. Enquanto processa, apontar as etapas: *Normalizando → Diarizando →
   Anonimizando → Analisando → Consolidando memória.*

> "Não é spinner genérico: são os estágios reais do pipeline."

**O briefing abre.** Percorrer rápido, sem ler tudo:

- **Protheus — Em uso** e **RM — Oportunidade**. *"Produto tem estado, não é só
  menção."*
- **Senior Sistemas — ameaça alta, ativa.**
- **R$ 50.000 — declarado, com selo `sigiloso`.**
- **Sentimento Misto**, decomposto: *positivo em Backoffice/Protheus, negativo em
  RH/Folha*.
- **Persona: Influenciador** — não decisor.

---

## 0:35 — 1:05 · A prova de que não é invenção

**Tela:** mesma, briefing aberto.

> "Todo item carrega a citação que o originou. Clicar prova isso."

1. Clicar no sinal de confiança **"Pediu sigilo sobre informação sensível +18"**.
2. A transcrição, à direita, **rola e acende exatamente**:
   *"Ah, e por favor, não mencione esse valor de R$ 50 mil que conversamos para o
   meu CFO ainda…"*

> "Esse trecho é a resposta à provocação do slide 16: *o cliente considera o
> vendedor uma pessoa de confiança?* Ele está compartilhando informação
> sensível e pedindo cumplicidade. O sistema detecta e pontua."

3. Apontar o selo **confiab. 60** e o aviso amarelo de qualidade do dado.

> "O sistema diz quando a matéria-prima é ruim, em vez de apresentar tudo com a
> mesma confiança."

---

## 1:05 — 1:45 · O que nenhuma reunião isolada revela

**Tela:** `/clientes` → **Metalúrgica Vale Verde**

> "Até aqui, uma reunião. O diferencial começa quando são cinco."

1. Apontar o **health score com os fatores que o compõem** — a soma bate com o
   número.
2. Apontar a **evolução do interesse** ao longo das 5 reuniões.
3. Parar em **Objeções recorrentes**:

> "**Preço — 2 reuniões, em aberto.** **Técnica — 2 reuniões, em aberto.**
> A plataforma cruzou o histórico e concluiu sozinha. Nenhuma reunião contém
> essa frase."

4. Clicar em **Preparar próxima reunião**.

**Tela:** `/clientes/[id]/preparar` — **este é o momento uau.**

> "É o que o vendedor lê cinco minutos antes da call."

- Pendência nossa: **atrasada há 103 dias**.
- Ameaça ativa: **Senior, mencionada 2×**.
- **Cobertura BANT do ciclo: 4/4.**
- E as **recomendações priorizadas** — cada uma com o *porquê*:
  1. *"Abra pela aprovação de quem decide — é o bloqueio real, não o preço."*
  4. *"Preço voltou em 3 reuniões e segue em aberto."*

> "A IA não manda fazer. Ela mostra o dado que sustenta cada recomendação e
> deixa a decisão com quem está na conta."

---

## 1:45 — 2:15 · Onde está o dinheiro

**Tela:** `/torre`

> "Essa é a tela do Diretor Comercial. O briefing da TOTVS diz que o desafio não
> é sobre texto, é sobre valor de negócio."

1. Os três números: **receita em risco**, **pipeline identificado**, **upsell
   não trabalhado** — cada um com as **premissas do cálculo visíveis embaixo**.

> "Estimativa declarada é análise. Estimativa disfarçada de certeza é chute."

2. **Oportunidades por unidade de negócio** — Gestão, **Techfin**, **RD Station**.

> "Quase todo time mapeia só ERP. Fluxo de caixa é Techfin. Previsibilidade de
> pipeline é RD Station."

3. **Escala do motor:** p95 em 3,7 ms, throughput de 31 mil análises/minuto,
   custo de API **R$ 0,00**.

> "As 10.000 reuniões por dia levam cerca de 19 segundos num processo."

**Tela rápida:** `/radar`

> "E esta responde ao primeiro item da oportunidade do briefing: quais dores
> estão surgindo com mais frequência. Não se responde numa reunião — exige
> cruzar todas e agrupar."

---

## 2:15 — 3:00 · A tela que decide

**Tela:** `/validacao`

> "Toda demo funciona. A pergunta é: como vocês sabem que está certo?"

1. **Seção (a)** — as duas bases, declaradas pelo que são.

> "O corpus real está em **0 de 12**. As gravações ainda não aconteceram, e a
> tela diz isso. Marcar amostra como real sem gravação fraudaria exatamente o
> item que a rubrica cobra."

2. **Seção (b)** — pipeline com números da base: turnos diarizados, entidades
   mascaradas, distribuição do Índice de Confiabilidade.

3. Clicar em **Rodar validação agora**.

> "Não é número de slide. É o motor rodando sobre o corpus, agora."

Quando aparecer, apontar três coisas — **nesta ordem**:

- **Cobertura de evidência: 100%.** *"Nenhum item sem citação rastreável."*
- **Falso positivo nas amostras sem sinal: zero.** *"Um sistema que acha
  oportunidade em toda conversa é ruído."*
- **A matriz de churn**, que mostra o erro: *"Das 6 amostras de risco alto, o
  motor pegou 2. Falso negativo é o erro caro num produto de retenção, e está
  aqui na tela, não escondido."*

4. Fechar apontando o **teste de overfitting** e a tabela **IH + IA**:

> "Dev e holdout medidos separadamente — dois campos passam do limiar de
> suspeita e o relatório marca. Não abrimos o holdout para corrigir, porque isso
> destruiria a única medida honesta que resta.
>
> E aqui embaixo: **taxa de correção por campo**. Quando o vendedor corrige a
> IA, isso vira número. O sistema mede a própria falibilidade.
>
> Um F1 de 0,60 com análise honesta do erro vale mais do que 0,99 sem
> procedência."

---

## Perguntas prováveis e respostas curtas

| Pergunta | Resposta |
|---|---|
| "Vocês usam qual LLM?" | Nenhum, por decisão. Motor determinístico: R$ 0,00 por análise, p95 de 3,7 ms e cada campo auditável. O provider de LLM está no contrato e entra sem refatorar — o trade-off está medido em VALIDACAO.md. |
| "E se a IA errar?" | O sistema assume que erra. Toda extração mostra a evidência, todo campo é confirmável ou corrigível pelo vendedor, e a taxa de correção é exibida na tela de validação. |
| "Por que o corpus real está vazio?" | Porque as gravações ainda não foram feitas. O protocolo está escrito e o pipeline pronto. Inventar amostra "real" seria fraudar o item que a rubrica pede primeiro. |
| "Isso escala para 10.000/dia?" | 31 mil análises por minuto medidas num processo. 10.000/dia levam ~19 segundos. O gargalo é I/O, não o motor. |
| "Analisa áudio?" | O núcleo consome texto. A captação é adaptador plugável: hoje colagem, Web Speech ao vivo e upload com STT. Sem credencial, mostramos o erro real em vez de simular. |

---

## Plano B

- **Sem internet:** rodar local com `npm run dev`. O banco é remoto, então tenha
  capturas de tela das quatro telas-chave.
- **Deploy fora do ar:** `npm run validar` no terminal produz a tabela de
  métricas completa — a seção (d) da demo funciona sem navegador.
- **Base vazia:** `POST /api/seed` repopula o arco e o corpus. É idempotente.
- **Banco fora do ar:** o app sobe do mesmo jeito. Cada tela diz que falta a
  configuração e o que apareceria ali, sem número inventado, e a seção (d) —
  **Rodar validação agora** em `/validacao` — continua executando o motor sobre o
  corpus, porque a medição não depende do Postgres.
