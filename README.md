# Benjamin

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

## Importação em lote

`/reunioes/lote` recebe dezenas ou centenas de reuniões de uma vez: arquivos
soltos, uma pasta inteira ou um `.zip` (inclusive zip dentro de zip).

| Entra | Como é lido |
|---|---|
| `.txt` `.docx` `.odt` `.rtf` | texto; layout de documento do Meet e do Teams é reorganizado em `Nome: fala` |
| `.vtt` `.srt` | legendas do Teams, Zoom, Meet e YouTube, com falante quando existe |
| `.json` | Whisper, AssemblyAI, Deepgram, Fireflies, Rev — ou uma lista de reuniões |
| `.csv` `.xlsx` | uma reunião por linha, uma fala por linha, ou manifesto |
| `.mp3` `.m4a` `.wav` `.ogg` `.webm` `.mp4` `.mov`… | transcrito antes, de qualquer duração |

Nada é enviado antes da revisão: título, cliente, data e tipo de cada reunião
são deduzidos (pasta = cliente, data do nome do arquivo, tipo por palavra-chave,
manifesto opcional por cima) e ficam editáveis numa tabela.

O que o lote garante:

- **Clientes diferentes em paralelo, o mesmo cliente em série e em ordem de
  data.** A ingestão carrega a memória da conta antes de analisar; duas
  reuniões da mesma conta em paralelo leriam a mesma memória.
- **Áudio longo funciona na Vercel.** O navegador decodifica, reduz a mono
  16 kHz e corta no silêncio em trechos de até 110 s (~3,5 MB), abaixo do
  limite de 4,5 MB por requisição. Trecho só de silêncio não é enviado.
- **Falha tem tipo.** 429 e 5xx esperam e tentam de novo; sessão expirada pausa
  o lote; chave ausente encerra a etapa de uma vez com a mesma mensagem.
- **Reenviar não duplica.** Reunião com mesmo título, data e texto já analisada
  volta como "já importada".
- **Nada some em silêncio.** Arquivo não lido aparece como ignorado, com motivo,
  e o relatório CSV lista tudo.

---

## Gravação de reunião

A aba **Gravar reunião** grava a call em dois canais separados: o microfone
de quem vende e o som da aba do Meet, Teams ou Zoom web. Como cada canal é de
um lado, a transcrição sai rotulada — `Ana Torres (Vendedor):` e `Cliente:` —
e o motor calcula talk ratio e voz do cliente sem precisar adivinhar quem
falou.

- O áudio é salvo no navegador a cada 5 s. Se a aba fechar ou o computador
  travar, a gravação aparece na próxima visita para ser transcrita.
- Aba compartilhada sem som é recusada no início, com a instrução; canal mudo
  por 45 s gera alerta durante a gravação.
- Eco do alto-falante que vaza para o microfone é removido da fala do vendedor.
- Segmentos que o Whisper produz sem ter ouvido fala (silêncio, laço de
  repetição) são descartados.
- Modo online exige Chrome ou Edge no computador. O modo presencial grava só o
  microfone e não separa falantes.

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
GEMINI_API_KEY=                # opcional — ativa o enriquecimento por LLM
OPENAI_API_KEY=                # opcional — ativa transcrição de áudio
```

**O app funciona só com as duas primeiras.** Faltando as opcionais, cada
funcionalidade degrada com mensagem explícita — nunca com simulação.

Sem nenhuma variável o app ainda sobe: toda tela abre dizendo o que falta e o que
apareceria ali, as rotas de API respondem `503` com o motivo, e `/validacao`
continua rodando o motor sobre o corpus — a medição não depende do banco.

### Popular a base

```bash
curl -X POST http://localhost:3000/api/seed
```

Ingere o arco de 5 reuniões da Metalúrgica Vale Verde e o corpus sintético
completo, usando o mesmo texto que a validação mede. É idempotente.

---

## Validando

```bash
npm test                     # 70 testes
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

Sem LLM por padrão. Custo de **R$ 0,00 por análise**, latência p95 de **9–15 ms**,
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

### O LLM entra contido, não no volume

O enriquecimento por LLM existe e é **opcional, por reunião** — um botão no
briefing. O caminho padrão continua determinístico, então os R$ 0,00 por análise
e o p95 de milissegundos seguem valendo para 100% do volume.

A contenção é estrutural, não uma promessa: cada observação do modelo só aparece
se a citação que a sustenta for encontrada literalmente na transcrição, e o que
não ancora é descartado e **contado na tela**. O resumo gerado é prosa e não tem
como ser ancorado num trecho único, então fica rotulado ao lado do resumo
extrativo, sem substituir nada e sem alimentar campo do briefing.

Medido na camada gratuita, mesma reunião, três execuções: 22,4 s, 4,5 s e 25,8 s.
A fila do provedor é imprevisível e a interface diz isso enquanto gera.

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
