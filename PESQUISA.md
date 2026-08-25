# Pesquisa — fontes do slide de problema

Regra aplicada na elaboração deste documento: **número que não foi aberto na
fonte não é usado.** Cada item abaixo traz link, data de acesso e o que foi
efetivamente confirmado. O que não passou na verificação está na seção 5, com o
motivo — e não deve ir para o slide.

Data de acesso de todas as consultas: **25 de agosto de 2026**.

---

## 1. Talk-to-listen ratio — a métrica que a TOTVS pediu por escrito

**Fonte:** Gong.io — *Mastering the talk-to-listen ratio in sales calls*
🔗 https://www.gong.io/blog/talk-to-listen-conversion-ratio
📅 Acesso: 25/08/2026

**Confirmado na fonte:**

| Estudo | Achado |
|---|---|
| Gong, 2016 ("golden ratio") | 43% falando / 57% ouvindo nas conversas de melhor desempenho |
| Gong, 2025 | **57% de talk time** em deals ganhos, sobre 326 mil chamadas de no mínimo 10 minutos |

**⚠️ Divergência que precisa ser dita no slide.** As duas leituras são da mesma
empresa e praticamente se invertem. Citar só uma delas seria escolher o número
que convém.

**Como usamos isso no produto:** a faixa de referência do InsightIQ é
**35%–55%** de fala do vendedor, e a tela de Coaching declara explicitamente que
é *parâmetro configurável do time, não regra*. A tela também diz que uma
demonstração tem talk ratio naturalmente alto — o número sozinho não julga a
reunião.

Essa postura é defensável justamente porque o benchmark é disputado: o valor do
produto não está em cravar o número certo, mas em **medir** algo que hoje
ninguém mede e devolver isso como conversa de desenvolvimento.

---

## 2. Tempo do vendedor gasto fora da venda

**Fonte primária:** Salesforce — *State of Sales* (6ª edição)
🔗 https://www.salesforce.com/news/stories/sales-research-2023/
📅 Acesso: 25/08/2026

**Confirmado:** o próprio título da matéria no domínio da Salesforce afirma que
os representantes **gastam menos de 30% do tempo efetivamente vendendo**.

⚠️ *Limitação de verificação:* o corpo da página retornou **HTTP 403** ao acesso
automatizado. O número foi corroborado por agregador independente que cita a
mesma edição do relatório (Everstage,
🔗 https://www.everstage.com/sales-productivity/sales-productivity-statistics),
com a formulação *"reps spend 70% of their time on non-selling tasks and 30%
selling"*.

**Recomendação para o slide:** citar como **"menos de 30% do tempo vendendo —
Salesforce, State of Sales, 6ª edição"**, sem detalhar percentuais de subcategorias
(anotação, entrada de dados), que variam entre edições e não foram verificados na
fonte primária.

**Ligação com o produto:** o InsightIQ elimina a etapa de registro pós-reunião. A
Torre de Controle exibe **horas devolvidas ao time** com o parâmetro declarado na
própria tela (12 minutos por reunião), e não como fato absoluto.

---

## 3. TOTVS — números institucionais

**Fonte:** TOTVS Relações com Investidores — *History and Profile*
🔗 https://ri.totvs.com/en/the-company/history-and-profile/
📅 Acesso: 25/08/2026

**Confirmado, com a redação exata da fonte:**

| Indicador | Valor |
|---|---|
| Clientes | mais de **70 mil** |
| Investimento em P&D | aproximadamente **R$ 1,9 bilhão** nos últimos cinco anos |
| Setores da economia atendidos | **12** |
| Participação de mercado no Brasil | mais de **50%** |
| Presença internacional | clientes em mais de **40 países** |
| Posição na América Latina | entre os **3 principais** players |
| Colaboradores | aproximadamente **10.000** TOTVERS |

### ⚠️ Conflito com o material do briefing

O deck do desafio menciona **~R$ 3,5 bilhões em P&D em 5 anos**. A página de RI
— fonte com responsabilidade legal perante investidores — diz **R$ 1,9 bilhão**.

**Encaminhamento:** usar **R$ 1,9 bilhão com a citação do RI**, ou confirmar com
a TOTVS a data-base do número do deck antes de apresentá-lo. Não usar os dois.
Divergência entre o material fornecido e a fonte oficial é exatamente o tipo de
coisa que uma banca verifica.

*(A página de RI consultada cita receita líquida de 2020, o que sugere que parte
do conteúdo institucional não é atualizada na mesma cadência dos resultados
trimestrais. Para o número mais recente, consultar o release trimestral em
https://ri.totvs.com/en/financial-information/results-center/.)*

---

## 4. Custo de retenção versus aquisição

**Fonte primária localizada:** Reichheld, Frederick F.; Sasser, W. Earl Jr.
*Zero Defections: Quality Comes to Services.* Harvard Business Review,
setembro–outubro de 1990.
🔗 https://hbr.org/1990/09/zero-defections-quality-comes-to-services
📅 Acesso: 25/08/2026

**Confirmado:** o artigo existe, com esses autores e essa data, e sua tese
central é que empresas de serviço deveriam medir defecção de clientes como a
indústria mede defeitos.

**❌ NÃO confirmado:** a afirmação popular de que *"adquirir um cliente custa 5x
mais do que reter"* **não foi localizada no conteúdo acessível do artigo**. A
citação circula amplamente atribuída a esta fonte, mas o texto disponível não a
sustenta.

**Decisão: não usar o "5x" no slide.** É um número repetido por toda a internet
sem procedência verificável. Se a retenção precisar ser argumentada, usar o
achado que o artigo de fato sustenta — a relação entre redução de defecção e
lucro — e citá-lo com a devida atribuição.

---

## 5. O que foi descartado e por quê

| Afirmação | Por que não entra |
|---|---|
| "70% dos dados de CRM estão desatualizados, incompletos ou incorretos" | Só localizada em blogs de fornecedores de dados (Landbase, ZoomInfo, SalesIntel), que vendem a solução para o problema que descrevem. Nenhuma pesquisa primária acessível. |
| "91% dos dados de CRM estão incompletos" | Atribuída à Salesforce por terceiros, sem link para o estudo original. |
| "Dados ruins custam US$ 12,9 milhões por ano às empresas" | Circula sem metodologia nem amostra; a atribuição varia conforme quem cita. |
| "Adquirir custa 5x mais que reter" | Ver seção 4 — atribuição não confirmada na fonte primária. |
| "~R$ 3,5 bilhões em P&D (TOTVS)" | Conflita com o RI da própria TOTVS. Ver seção 3. |

**Nota metodológica.** A pesquisa sobre qualidade de dados em CRM é dominada por
marketing de conteúdo de empresas que vendem enriquecimento de dados. Isso não
significa que o problema não exista — a persona Ana Torres, da Entrega 1, o
descreve em primeira pessoa ("registra no CRM horas depois, de memória"). Mas
**argumento de persona é argumento de persona, e estatística é estatística.**
Apresentar marketing de fornecedor como pesquisa é o tipo de coisa que derruba a
credibilidade do resto do trabalho.

---

## 6. O argumento que não depende de fonte externa

A parte mais forte do slide de problema é a que **não precisa de citação**,
porque é demonstrável ao vivo no produto:

> Uma reunião de vendas de dez minutos contém dor de RH, produto concorrente em
> avaliação, budget declarado sob sigilo e um sinal de rapport. Hoje, isso vira
> três linhas de anotação no CRM, escritas de memória horas depois — quando
> vira alguma coisa.

Isso se prova rodando o exemplo canônico do próprio slide 15 da TOTVS na tela e
mostrando o briefing nascer dele, com cada item apontando para o trecho que o
originou. Não depende de estatística de terceiro: **a evidência é a própria
demonstração.**

---

## Fontes consultadas

- [Gong — Mastering the talk-to-listen ratio in sales calls](https://www.gong.io/blog/talk-to-listen-conversion-ratio)
- [Salesforce — New Research Reveals Sales Reps Spend Less than 30% of Their Time Actually Selling](https://www.salesforce.com/news/stories/sales-research-2023/)
- [Everstage — Sales Productivity Statistics (corroboração da 6ª edição do State of Sales)](https://www.everstage.com/sales-productivity/sales-productivity-statistics)
- [TOTVS RI — History and Profile](https://ri.totvs.com/en/the-company/history-and-profile/)
- [TOTVS RI — Results Center](https://ri.totvs.com/en/financial-information/results-center/)
- [Harvard Business Review — Zero Defections: Quality Comes to Services (Reichheld & Sasser, 1990)](https://hbr.org/1990/09/zero-defections-quality-comes-to-services)
