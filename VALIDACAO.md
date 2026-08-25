# Validação — InsightIQ

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

**30 amostras** em 15 cenários distintos, divididas em duas partições:

| Partição | Amostras | Papel |
|---|---|---|
| `dev` | 17 | Os erros são lidos e usados para ajustar léxico e pesos |
| `holdout` | 13 | **Nunca inspecionada item a item.** Só métrica agregada |

A separação existe para responder a uma pergunta específica: *o motor
generaliza, ou decorou o que foi lido durante o ajuste?* Se os erros do holdout
fossem abertos para tunar regras, ele deixaria de ser holdout e a métrica viraria
propaganda.

**Cobertura de sinais** (medida, não estimada):

| Sinal | Amostras | Mínimo | |
|---|---|---|---|
| com concorrente | 10 | 8 | ✅ |
| com objeção de preço | 8 | 8 | ✅ |
| com churn claro | 6 | 6 | ✅ |
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

Corpus sintético completo, 30 amostras.

### Precisão, recall e F1

| Campo | Precisão | Recall | F1 | Suporte |
|---|---|---|---|---|
| budget | 1,000 | 1,000 | **1,000** | 6 |
| concorrentes | 0,917 | 1,000 | **0,957** | 11 |
| concorrente ativo | 0,818 | 1,000 | **0,900** | 9 |
| produtos TOTVS | 0,840 | 0,913 | **0,875** | 23 |
| sinal de upsell | 0,929 | 0,813 | **0,867** | 16 |
| sinal de churn | 1,000 | 0,667 | **0,800** | 6 |
| objeções | 0,737 | 0,824 | **0,778** | 17 |
| unidade de negócio | 0,818 | 0,692 | **0,750** | 13 |
| status do produto | 0,571 | 0,857 | **0,686** | 14 |
| dores | 0,692 | 0,529 | **0,600** | 17 |

### Acurácia

| Métrica | Taxa | |
|---|---|---|
| talk ratio dentro da faixa anotada | 0,889 | 8/9 |
| banda de churn | 0,767 | 23/30 |
| poder de decisão da persona | 0,667 | 20/30 |
| sentimento (4 classes) | 0,533 | 16/30 |
| interesse dentro da faixa | 0,500 | 15/30 |

### Erro, evidência e desempenho

| Métrica | Valor |
|---|---|
| MAE do interest score | 18,4 pontos |
| MAE do talk ratio | 0,07 |
| **Cobertura de evidência** | **100,00%** |
| Latência p50 / p95 | 1,75 ms / 3,7 ms |
| Throughput (1 processo) | 31.573 análises/minuto |
| Custo de API por análise | R$ 0,00 |

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
| **alto** | 1 | 3 | 2 |

O motor **nunca superestima** risco — nenhuma conta saudável foi marcada como em
risco. Mas das 6 amostras anotadas como risco alto, só 2 foram classificadas
como alto, e 1 caiu em baixo. Num produto de retenção, **falso negativo é o erro
caro**: é a conta que ninguém foi salvar.

Causa provável: os pesos dos sinais de churn são conservadores e o componente
histórico só entra quando há memória do cliente. Amostras isoladas de CS
insatisfeito perdem os 40% de peso que vêm do histórico.

### 5.2 Sentimento e interesse são os campos mais fracos

Acurácia de sentimento em 0,533 e interesse dentro da faixa em 0,500, com MAE de
18,4 pontos. O sentimento por aspecto (exigido pelo exemplo canônico) funciona,
mas a classificação global em 4 classes confunde `misto` com `neutro` e
`positivo`.

O interest score é explicável por construção — a soma dos fatores bate
exatamente com o número exibido — mas a calibração dos pesos ainda não reproduz
o julgamento dos anotadores.

### 5.3 Um campo com sinal de ajuste excessivo

O teste de overfitting compara F1 dev contra F1 holdout. O delta médio está em
**0,018** ("o motor generaliza"), mas dois campos passam do limiar de suspeita
de 0,15:

| Campo | F1 dev | F1 holdout | Delta |
|---|---|---|---|
| objeções | 0,870 | 0,615 | +0,255 |
| dores | 0,667 | 0,500 | +0,167 |

Ambos ganharam expressões de léxico derivadas de amostras **dev**, e o holdout
não acompanhou. **O holdout não foi aberto para corrigir isso** — fazer isso
destruiria a única medida honesta que resta. O gap fica reportado.

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
