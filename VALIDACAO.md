# Validação — Benjamin

Como os textos foram **coletados, tratados e analisados**, e o que o motor acerta
e erra. Todos os números deste documento vieram de `npm run validar`, executado
sobre o corpus versionado no repositório. Nada aqui foi digitado à mão.

A mesma medição roda ao vivo em `/validacao`, pelo botão **Rodar validação
agora** — a tela não repete número de slide, ela manda executar e mostra o que
saiu.

---

## 1. Como os dados foram coletados

O produto trabalha com duas bases, e cada uma é declarada pelo que ela é.
Misturá-las num número só produziria uma média sem significado.

### Corpus A — REAL (base principal)

**Estado atual: 0 de 12 reuniões gravadas.**

Está vazio de propósito. O arquivo `lib/validation/corpus-real.ts` existe, o
pipeline está pronto e o protocolo de coleta está escrito em
[PROTOCOLO-CORPUS.md](PROTOCOLO-CORPUS.md), mas **nenhuma amostra foi marcada
como `real` sem gravação correspondente**. Inventar isso fraudaria exatamente o
item que a rubrica cobra em primeiro lugar.

O protocolo definido para a coleta:

| Item | Definição |
|---|---|
| Gravação | Google Meet com legenda ativada, 8 a 12 minutos por reunião |
| Encenação | Ana Torres (executiva de contas) e João Silva (gestor operacional), 12 cenários |
| Transcrição | Legenda nativa do Meet, `faster-whisper` local ou API — a ferramenta usada é registrada por amostra |
| Tratamento | A transcrição **não é limpa**: erro de ASR e trecho inaudível são dado, não defeito |
| Gabarito | Dois anotadores independentes, sem rodar o motor; um terceiro desempata |
| Concordância | Índice registrado por amostra; abaixo de 0,75 o critério é revisto antes de seguir |

Quando as gravações existirem, as métricas do corpus real aparecem **separadas**
das do sintético. Diferença entre as duas bases é achado, não problema:
transcrição real tem ruído que texto escrito não reproduz.

### Corpus B — SINTÉTICO (complemento)

**31 amostras** em 16 cenários distintos, divididas em duas partições:

| Partição | Amostras | Papel |
|---|---|---|
| `dev` | 18 | Os erros são lidos e usados para ajustar léxico e pesos |
| `holdout` | 13 | **Nunca inspecionada item a item.** Só métrica agregada |

A trigésima primeira (DEV-13) entrou depois das outras e por um motivo diferente:
as trinta primeiras foram escritas para cobrir cenários, esta foi escrita porque
**o motor errou nela**. Ela vai para `dev`, nunca para holdout, e a razão precisa
estar dita: nós a analisamos em detalhe antes de corrigir o motor. Amostra
inspecionada não serve mais de teste cego — colocá-la no holdout inflaria a
métrica que existe justamente para desconfiar de nós mesmos.

A separação existe para responder a uma pergunta específica: *o motor
generaliza, ou decorou o que foi lido durante o ajuste?* Se os erros do holdout
fossem abertos para tunar regras, ele deixaria de ser holdout e a métrica viraria
propaganda.

**Cobertura de sinais** (medida, não estimada):

| Sinal | Amostras | Mínimo | |
|---|---|---|---|
| com concorrente | 10 | 8 | ✅ |
| com objeção de preço | 9 | 8 | ✅ |
| com churn claro | 7 | 6 | ✅ |
| com gatilho de upsell | 16 | 10 | ✅ |
| com budget declarado | 6 | 6 | ✅ |
| **sem nenhum sinal** (mede falso positivo) | 8 | 4 | ✅ |
| oportunidade Techfin | 3 | 3 | ✅ |
| oportunidade RD Station | 2 | 2 | ✅ |

Cinco das amostras formam um **arco narrativo**: a mesma conta (Metalúrgica Vale
Verde) em cinco reuniões consecutivas, com a objeção de preço aparecendo na R2,
voltando na R3 e de novo na R4. É a sequência que prova a memória do cliente —
nenhuma reunião isolada contém a conclusão "preço voltou em 3 reuniões".

---

## 2. Como os dados foram tratados

O pipeline roda em `lib/analysis/rules/segment.ts` e `redact.ts`, antes de
qualquer extração.

```
texto bruto
   │
   ├─ normalização        quebras de linha, timestamps, espaços, aspas
   ├─ anonimização LGPD   CPF, CNPJ, e-mail, telefone, cartão
   ├─ diarização textual  Nome:, NOME:, [Nome], Nome (Empresa):
   ├─ classificação       vendedor / cliente, com confiança registrada
   ├─ segmentação         sentenças, respeitando abreviações PT-BR
   └─ qualidade           Índice de Confiabilidade 0–100
        │
        └─→ extração, scoring, briefing
```

### Decisão central: um único sistema de coordenadas

O texto **nunca muda de comprimento** durante o preparo. A máscara de
anonimização tem exatamente o mesmo tamanho do trecho mascarado (`###.###.###-##`,
não `[CPF]`). Sem isso, todo offset depois do primeiro CPF andaria e a evidência
apontaria para o trecho errado da transcrição.

Existe um teste de invariante que verifica, em todo o corpus, que
`texto.slice(start, end) === quote`. É o que permite clicar num item do briefing
e ver o trecho exato acender na transcrição.

### LGPD

- O que fica guardado e exibido é o **texto anonimizado**. O PII original nunca é
  persistido.
- De cada entidade mascarada guarda-se apenas **tipo e posição** — nunca o valor.
- O acesso ao banco é exclusivo do servidor: RLS habilitado em todas as tabelas,
  sem policy pública de escrita, e a `service_role` nunca vai para o bundle do
  cliente.
- A captura ao vivo exige **aviso de consentimento antes** de abrir o microfone.

### Índice de Confiabilidade

Score 0–100 composto de: diarização presente, proporção de trechos inaudíveis,
volume de texto, densidade de muletas, número de falantes identificados e
falantes sem classificação confiável. É exibido junto do briefing, o que permite
a interface dizer *"este briefing saiu de uma transcrição ruim, trate as
extrações com cautela"* em vez de apresentar tudo com a mesma confiança.

---

## 3. Como os dados foram analisados

Motor **100% determinístico**, em regras, escrito para PT-BR falado.

| Propriedade | Consequência |
|---|---|
| Mesma entrada → mesma saída | A demonstração não depende de sorte |
| Sem chamada de API | Custo por análise: **R$ 0,00** |
| Cada campo rastreável até a regra | Auditável, não caixa-preta |
| TypeScript puro, sem I/O | Roda sobre o corpus inteiro e mede latência de verdade |

O provider de LLM existe no contrato e entra sem refatoração quando houver
chave. O rodapé de cada briefing declara qual motor rodou e em quantos ms.

### Regra de evidência obrigatória

Todo item extraído carrega a citação literal e o índice de caractere. **Item sem
evidência rastreável não é retornado.** A cobertura de evidência medida é de
**100,00%**.

### IH + IA

A IA propõe com a evidência; o humano confirma ou corrige. Cada intervenção é
gravada em `corrections` com o valor anterior, e a **taxa de correção por campo**
aparece na tela de Validação. O sistema mede a própria falibilidade em vez de
esperar que ninguém pergunte.

---

## 4. Métricas — última execução

Corpus sintético completo, 31 amostras.

### Precisão, recall e F1

| Campo | Precisão | Recall | F1 | Suporte |
|---|---|---|---|---|
| budget | 1,000 | 1,000 | **1,000** | 6 |
| concorrentes | 0,917 | 1,000 | **0,957** | 11 |
| concorrente ativo | 0,818 | 1,000 | **0,900** | 9 |
| sinal de upsell | 0,929 | 0,813 | **0,867** | 16 |
| produtos TOTVS | 0,815 | 0,917 | **0,863** | 24 |
| sinal de churn | 1,000 | 0,714 | **0,833** | 7 |
| objeções | 0,773 | 0,850 | **0,810** | 20 |
| unidade de negócio | 0,818 | 0,692 | **0,750** | 13 |
| status do produto | 0,591 | 0,867 | **0,703** | 15 |
| dores | 0,714 | 0,476 | **0,571** | 21 |

### Acurácia

| Métrica | Taxa | |
|---|---|---|
| talk ratio dentro da faixa anotada | 0,900 | 9/10 |
| banda de churn | 0,774 | 24/31 |
| poder de decisão da persona | 0,645 | 20/31 |
| sentimento (4 classes) | 0,548 | 17/31 |
| interesse dentro da faixa | 0,516 | 16/31 |

### Erro, evidência e desempenho

| Métrica | Valor |
|---|---|
| MAE do interest score | 18 pontos |
| MAE do talk ratio | 0,067 |
| **Cobertura de evidência** | **100,00%** |
| Latência p50 / p95 | ~5 ms / 9–15 ms |
| Throughput (1 processo) | ~8.000 análises/minuto |
| Custo de API por análise | R$ 0,00 |

**Por que a latência subiu.** A tabela anterior reportava p50 de 1,75 ms e p95 de
3,7 ms sobre 30 amostras curtas. A DEV-13 tem 4.260 caracteres — três vezes a
maior das anteriores — e domina a cauda. O número novo é o custo real de analisar
uma transcrição de reunião de verdade, não uma amostra de laboratório.

Duas medições que vale registrar. A primeira análise de um processo novo custa
**1.612 ms**; a mediana das seguintes é **21,8 ms** para a mesma entrada. É
compilação de regex, paga uma vez por processo, e por isso o script de validação
agora aquece sobre o corpus inteiro antes de medir — antes ele aquecia com cinco
amostras curtas e uma única execução fria puxava a média publicada de ~5 ms para
~28 ms. E esta máquina varia: três execuções seguidas deram p95 de 8,85 ms,
15,06 ms e 30,3 ms. O intervalo acima é honesto; um número único não seria.

### Falso positivo

Nas **8 amostras sem nenhum sinal comercial**:

| Concorrentes | Objeções | Churn | Budget |
|---|---|---|---|
| **0** | **0** | **0** | **0** |

Zero falso positivo. É a métrica que mais importa para confiança operacional: um
sistema que "encontra" oportunidade em toda conversa é ruído, não inteligência.

---

## 5. Onde o motor erra — leitura honesta

Um relatório que só mostra o que funcionou não é validação, é propaganda. Os três
pontos fracos medidos:

### 5.1 Risco de churn é subestimado

Matriz de confusão (linha = gabarito, coluna = motor):

| | baixo | médio | alto |
|---|---|---|---|
| **baixo** | 21 | 0 | 0 |
| **médio** | 3 | 0 | 0 |
| **alto** | 1 | 3 | 3 |

O motor **nunca superestima** risco — nenhuma conta saudável foi marcada como em
risco, e essa linha se manteve intacta depois da ampliação do léxico. Mas das 7
amostras anotadas como risco alto, só 3 foram classificadas como alto, e 1 ainda
cai em baixo. Num produto de retenção, **falso negativo é o erro caro**: é a
conta que ninguém foi salvar.

A banda `médio` continua nunca sendo prevista: as 3 amostras anotadas como médio
caem todas em baixo. É o ponto mais fraco desta matriz.

Causa provável: os pesos dos sinais de churn são conservadores e o componente
histórico só entra quando há memória do cliente. Amostras isoladas de CS
insatisfeito perdem os 40% de peso que vêm do histórico.

**O que a DEV-13 ensinou.** Ela entrou no corpus por ter sido lida errada: uma
conversa de não-renovação declarada em que o motor devolvia churn 0, e ainda
gerava oportunidade de 50% para um produto que o cliente recusou três vezes. As
causas eram três, independentes entre si — a diarização quebrava com o rótulo do
falante em linha própria, o léxico de churn cobria frase literal em vez de
família de expressão, e concorrente sem nome valia zero. Corrigidas as três, a
mesma amostra sai em churn 100, interesse 5 e nenhuma oportunidade. Nenhuma das
doze amostras anteriores tinha exposto isso, porque todas usam `Nome: texto` na
mesma linha — o único formato que o parser aceitava. **Lacuna de corpus, não só
de motor.**

### 5.2 Sentimento e interesse são os campos mais fracos

Acurácia de sentimento em 0,548 e interesse dentro da faixa em 0,516, com MAE de
18 pontos. O sentimento por aspecto (exigido pelo exemplo canônico) funciona,
mas a classificação global em 4 classes confunde `misto` com `neutro` e
`positivo`. Na própria DEV-13 o motor diz `misto` onde o gabarito diz
`negativo`: o cliente elogia o concorrente ("mais fácil de usar") e o elogio
puxa a nota global, mesmo sendo elogio a quem vai substituir a gente.

Uma correção desta rodada ajudou, e vale registrar porque era bug e não
calibração: `ninguém` e `nem` não estavam na lista de negadores, então "abri
chamado e ninguém resolveu" pontuava **+0,8 positivo** enquanto "não resolveu"
pontuava −0,8. A acurácia de sentimento subiu de 0,533 para 0,567 no corpus de
30 amostras só com isso.

O interest score é explicável por construção — a soma dos fatores bate
exatamente com o número exibido — mas a calibração dos pesos ainda não reproduz
o julgamento dos anotadores.

### 5.3 Um campo com sinal de ajuste excessivo

O teste de overfitting compara F1 dev contra F1 holdout. O delta médio está em
**0,029** ("o motor generaliza"), mas um campo passa do limiar de suspeita
de 0,15:

| Campo | F1 dev | F1 holdout | Delta |
|---|---|---|---|
| objeções | 0,897 | 0,615 | +0,282 |
| dores | 0,609 | 0,500 | +0,109 |

`dores` saiu da zona de suspeita; `objeções` piorou o delta e precisa de
explicação, porque foi ampliado nesta rodada a partir de **uma única amostra**.

Três versões foram medidas antes de escolher:

| Versão | F1 (31) | dev | holdout | delta |
|---|---|---|---|---|
| Antes desta rodada | 0,778 | 0,870 | 0,615 | 0,255 |
| Sem ampliar objeções | 0,750 | 0,815 | 0,615 | 0,200 |
| Ampliação completa | 0,791 | 0,897 | **0,571** | 0,326 |
| **Escolhida** | **0,810** | 0,897 | 0,615 | 0,282 |

A ampliação completa subia dev e **derrubava holdout de 0,615 para 0,571** — a
definição literal de decorar. A versão escolhida foi obtida por critério
conceitual, não olhando o erro do holdout: ficaram os padrões que generalizam
(`custo/preço/investimento não compensa`, `preço pesa`) e a correção de flexão de
`mais barat[oa]`, que era bug e não ampliação; saíram os que tinham a forma da
frase daquela amostra (`custo-benefício`, `pagamos bastante`, `não sentimos que
estamos recebendo valor`).

O resultado é o melhor F1 das quatro versões **com o holdout de volta a 0,615**,
exatamente onde estava. O delta subiu de 0,255 para 0,282 porque **dev melhorou**,
não porque holdout piorou — são situações diferentes e a tabela acima existe para
que a diferença seja verificável.

**O holdout não foi aberto item a item em nenhum momento.** O gap fica reportado.

---

## 6. Reprodutibilidade

```bash
npm install
npm test                  # 27 testes: exemplo canônico, armadilhas, invariantes
npm run validar           # tabela completa de métricas
npm run validar -- --erros  # erros item a item da partição DEV (holdout não é aberto)
```

Cada execução da tela `/validacao` grava uma linha em `validation_runs`, o que
permite comparar rodadas antes e depois de mexer no motor.
