# Protocolo do Corpus Real — InsightIQ

Documento operacional para o squad gravar as 10 a 12 reuniões do **Corpus A**.

A rubrica da Entrega 2 pede, literalmente, "demonstração de como os textos gerados a partir das reuniões online foram **coletados**, tratados e analisados". Coletados é a primeira palavra. Corpus só sintético responde mal a ela — por isso este protocolo existe e por isso `lib/validation/corpus-real.ts` está vazio até as gravações acontecerem.

**Nunca** criar amostra marcada como `origin: 'real'` sem gravação correspondente.

---

## 1. O que gravar

Doze reuniões de role-play, 8 a 12 minutos cada, encenando os cenários abaixo. Duas pessoas por reunião: uma faz **Ana Torres** (executiva de contas TOTVS), outra faz o cliente.

| # | Cenário | Cliente encenado | O que precisa aparecer |
|---|---|---|---|
| R01 | Descoberta | João Silva, gestor operacional | Protheus em uso, dor de folha manual, nenhum budget ainda |
| R02 | Demonstração | João Silva | Vendedor fala muito (talk ratio ruim de propósito), primeira objeção de preço |
| R03 | Negociação | João Silva | Preço de novo, primeira menção à Senior, pedido de desconto |
| R04 | Follow-up | João Silva | Preço pela terceira vez, Senior mais forte, budget com pedido de sigilo |
| R05 | Proposta | João Silva | ROI, dependência do CFO, data de decisão |
| R06 | Primeiro contato | Prospect frio | Pouco sinal, encerramento vago ("vou ver e te aviso") |
| R07 | CS saudável | Cliente satisfeito | Nenhum sinal comercial — serve para medir falso positivo |
| R08 | CS insatisfeito | Cliente irritado | Chamado sem resposta, "terceira vez", ameaça de escalar |
| R09 | Risco de cancelamento | Cliente em renovação | "Não vamos renovar", redução de licenças, concorrente cotando |
| R10 | Cross-BU Techfin | Industrial | Fluxo de caixa, antecipação de recebíveis, juros de banco |
| R11 | Cross-BU RD Station | Serviço | Pipeline sem previsibilidade, lead não qualificado |
| R12 | Expansão | Rede em crescimento | Filiais novas, mais licenças, budget declarado |

**Armadilhas obrigatórias** — plantar pelo menos uma em cada bloco de quatro reuniões:

- "a gente usava SAP na empresa anterior" (concorrente histórico, não ameaça)
- "não, preço não é problema pra gente" (negação, não objeção)
- "o Protheus a gente nem chegou a usar" (menção, não uso)
- "se um dia a gente crescer, talvez o Fluig" (condicional fraco)
- "o RM é integrado, né? Né?" (desconfiança, não interesse)

**Ruído é bem-vindo.** Hesitação, sobreposição de fala, "deixa eu compartilhar a tela", "acho que o Pedro caiu", correção de rumo no meio da frase. É exatamente onde extrator quebra, e é o que corpus sintético não reproduz. Não ensaiar demais.

---

## 2. Como gravar

1. Google Meet, com **legenda ativada** durante toda a reunião.
2. Gravar a reunião (o áudio original fica arquivado fora do repositório — ver `.gitignore`).
3. Transcrever por um destes caminhos, sempre registrando qual foi usado:
   - legenda nativa do Meet (mais rápido, qualidade média)
   - `faster-whisper` local, modelo `medium` ou `large-v3` (gratuito, melhor em PT-BR)
   - API de transcrição (mais caro, use só se necessário)
4. **Não limpar a transcrição.** Erro de ASR, palavra trocada e trecho marcado como inaudível são dado, não defeito — é sobre eles que o Índice de Confiabilidade opera.

---

## 3. Registro obrigatório

Cada reunião entra em `lib/validation/corpus-real.ts` com `collection_meta` preenchido:

```ts
{
  data: '2026-08-20',
  participantes: ['Nome 1', 'Nome 2'],
  papeis: ['Ana Torres (vendedora)', 'João Silva (cliente)'],
  duracao_min: 9,
  ferramenta_transcricao: 'whisper_local',
  modelo: 'faster-whisper large-v3',
  anotadores: ['Nome A', 'Nome B'],
  concordancia: 0.87,
}
```

Sem `collection_meta` completo, a amostra não entra na validação.

---

## 4. Protocolo de anotação do gabarito

Esta é a parte que dá credibilidade ao número final. Seguir à risca.

1. **Dois anotadores independentes.** Cada um preenche o gabarito sozinho, sem ver o do outro e **sem rodar o motor**. Anotar olhando a saída do sistema invalida a medição — é corrigir a prova com o gabarito do aluno.
2. **Um terceiro desempata** as divergências e registra a decisão.
3. **Calcular a concordância** entre os dois primeiros: `casos em que concordaram / total de casos`. Registrar em `concordancia`.
4. Concordância abaixo de **0,75** significa que o critério está ambíguo — revisar a definição do campo antes de seguir anotando.

### Regras de anotação que já causaram divergência

Foram descobertas anotando o corpus sintético. Seguir as mesmas para o real, senão as duas bases não são comparáveis:

- **Dor é do cliente.** Se quem descreve o problema é o vendedor (numa demo, por exemplo), não é dor do cliente. Não anotar.
- **Uma dor por sentença, e o domínio ganha do genérico.** "A folha é feita na mão, com planilha" é `rh`, não `processo_manual` — processo manual é a *forma* da dor, não o domínio. O radar precisa disso para não virar uma coluna gigante de "manual".
- **Produto tem estado, não é só menção.** `em_uso` exige posse explícita colada ao nome ("o nosso Protheus", "vocês usam o Protheus"). Condicional ("se o RM for integrado") é `oportunidade`. Citado sem contexto é `mencionado`.
- **Concorrente do passado não é ameaça.** "Usava na empresa anterior" → `ativo: false`.
- **Valor sem unidade herda a escala anterior.** "Sessenta mil… uns cinquenta" → o segundo é R$ 50.000.
- **Interesse é anotado como faixa**, nunca como número exato. Score é estimativa; cobrar valor exato mede ruído.

---

## 5. Ao terminar

Rodar a validação e conferir que as duas bases aparecem separadas:

```bash
npm run validar
```

O relatório precisa mostrar F1 do corpus real e do sintético lado a lado. **Se houver diferença grande, ela é o achado, não o problema** — transcrição real tem ruído que texto escrito não tem, e explicar essa diferença é análise madura. Número redondo e idêntico nas duas bases é que levantaria suspeita.
