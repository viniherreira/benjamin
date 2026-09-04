import type { AnalysisResult } from '../types';

/**
 * O prompt do enriquecimento.
 *
 * Duas decisões que valem explicação:
 *
 * 1. O modelo recebe o resultado das REGRAS junto com a transcrição. Ele não é
 *    convidado a extrair de novo o que já foi extraído de forma auditável — é
 *    convidado a fazer o que as regras fazem mal: escrever com fluência e ler
 *    nuance. Pedir extração de novo criaria duas verdades para o mesmo campo.
 *
 * 2. Toda observação estruturada tem que vir com a citação copiada literalmente.
 *    Não é cortesia: é o que permite descartar mecanicamente o que não existe no
 *    texto. Um modelo que inventa uma frase não consegue inventar uma frase que
 *    esteja na transcrição.
 */

export const SISTEMA = `Você analisa transcrições de reuniões comerciais em português do Brasil para a TOTVS.

Um motor determinístico já extraiu os fatos auditáveis da conversa (produtos, valores, prazos, concorrentes, objeções, scores). Esses fatos NÃO são sua responsabilidade e você não deve recalculá-los nem contradizê-los.

Seu trabalho é o que as regras fazem mal:

1. RESUMO — reescreva o panorama da reunião em 3 ou 4 frases, com leitura corrida e natural. Use apenas fatos presentes na análise que você recebeu ou ditos na transcrição. Não introduza número, nome, valor ou data que não esteja lá.

2. NUANCE — até 3 observações sobre tom, hesitação, subtexto ou contradição que uma regra baseada em léxico perderia. Exemplos do que interessa: entusiasmo verbal desmentido por adiamento, concordância protocolar sem compromisso, preocupação dita de forma indireta.

3. PRÓXIMA AÇÃO — uma recomendação concreta para o vendedor, derivada da conversa.

REGRA INEGOCIÁVEL: cada item de NUANCE e a PRÓXIMA AÇÃO devem vir acompanhados do campo "citacao", contendo um trecho COPIADO LITERALMENTE da transcrição, caractere por caractere, sem reescrever, resumir, corrigir ou traduzir. Se você não conseguir localizar um trecho literal que sustente a observação, não faça a observação.

Escreva em português do Brasil. Seja direto e não use elogios ao cliente nem linguagem de marketing.`;

const RESUMO_ANALISE = (a: AnalysisResult): string => {
  const linhas: string[] = [];

  const produtos = a.totvs_products.map((p) => `${p.name} (${p.status})`);
  if (produtos.length > 0) linhas.push(`Produtos TOTVS: ${produtos.join(', ')}`);

  const conc = a.competitors.map((c) => `${c.name} (ameaça ${c.threat}${c.active ? ', ativa' : ''})`);
  if (conc.length > 0) linhas.push(`Concorrentes: ${conc.join(', ')}`);

  if (a.problems.length > 0) linhas.push(`Dores: ${a.problems.map((p) => p.text).join(' | ')}`);
  if (a.objections.length > 0) {
    linhas.push(`Objeções: ${a.objections.map((o) => `${o.text} [${o.category}]`).join(' | ')}`);
  }
  if (a.budget.length > 0) {
    linhas.push(`Budget: ${a.budget.map((b) => b.raw).join(' | ')}`);
  }
  if (a.next_steps.length > 0) {
    linhas.push(`Próximos passos: ${a.next_steps.map((n) => n.text).join(' | ')}`);
  }

  linhas.push(
    `Persona: ${a.persona.role ?? 'não identificado'}, poder de decisão ${a.persona.decision_power}`,
  );
  linhas.push(`Sentimento: ${a.sentiment} (${a.sentiment_score})`);
  if (a.aspect_sentiment.length > 0) {
    linhas.push(
      `Sentimento por aspecto: ${a.aspect_sentiment.map((s) => `${s.aspect}=${s.polarity}`).join(', ')}`,
    );
  }
  linhas.push(`Interesse: ${a.interest_score}/100 · Risco de churn: ${a.churn_risk}/100`);

  const cm = a.conversation_metrics;
  if (cm.talk_ratio_seller !== null) {
    linhas.push(
      `Talk ratio do vendedor: ${(cm.talk_ratio_seller * 100).toFixed(0)}% · perguntas: ${cm.seller_questions ?? 0}`,
    );
  }

  return linhas.join('\n');
};

export function montarPromptUsuario(texto: string, analise: AnalysisResult): string {
  return [
    '## Análise determinística já produzida',
    '',
    RESUMO_ANALISE(analise),
    '',
    '## Resumo extrativo atual (montado por template, é ele que você vai reescrever)',
    '',
    analise.summary || '(vazio)',
    '',
    '## Transcrição',
    '',
    texto,
  ].join('\n');
}

/** Schema da resposta — o Gemini devolve JSON validado contra ele. */
export const SCHEMA_RESPOSTA = {
  type: 'OBJECT',
  properties: {
    resumo: { type: 'STRING' },
    nuance: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          observacao: { type: 'STRING' },
          citacao: { type: 'STRING' },
        },
        required: ['observacao', 'citacao'],
      },
    },
    proxima_acao: {
      type: 'OBJECT',
      properties: {
        acao: { type: 'STRING' },
        citacao: { type: 'STRING' },
      },
      required: ['acao', 'citacao'],
    },
  },
  required: ['resumo', 'nuance', 'proxima_acao'],
} as const;
