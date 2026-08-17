import type { Polaridade, Sentenca, SentimentoAspecto, Sentimento } from '../types';
import type { Preparado } from './segment';
import {
  ASPECTOS,
  ATENUADORES,
  INTENSIFICADORES,
  NEGADORES,
  PALAVRAS_NEGATIVAS,
  PALAVRAS_POSITIVAS,
} from './lexicons';
import { algumPadrao, evidenciaEm, limitar } from './util';

/**
 * Sentimento PT-BR, global e por aspecto.
 *
 * O exemplo canônico da TOTVS exige decomposição: "Misto (satisfeito com
 * Backoffice / frustrado com RH)". Uma nota global de uma palavra só não
 * atende — e, pior, some justamente com a informação acionável.
 *
 * Por isso a unidade de análise aqui é a ORAÇÃO, não a sentença: em
 * "o Protheus está atendendo o backoffice, mas o RH está sofrendo", os dois
 * aspectos vivem na mesma sentença com polaridades opostas.
 */

const CONECTORES_CONTRASTE = /\b(?:mas|porem|entretanto|contudo|todavia|so que|apesar|embora|ja o|enquanto)\b/gu;

/** Cortesia não carrega sentimento — "bom dia" não é elogio ao produto. */
const SAUDACOES =
  /\b(?:bom dia|boa tarde|boa noite|tudo bem|tudo bom|como vai|muito obrigad\w*|por favor|imagina|de nada|ate mais)\b/gu;

export type Clausula = { inicio: number; fim: number; busca: string; lado: Sentenca['lado'] };

/** Fatia cada sentença em orações nos conectores de contraste. */
export function fatiarClausulas(prep: Preparado): Clausula[] {
  const saida: Clausula[] = [];

  for (const s of prep.sentencas) {
    const trecho = prep.textoBusca.slice(s.inicio, s.fim);
    const cortes: number[] = [0];

    CONECTORES_CONTRASTE.lastIndex = 0;
    for (const m of trecho.matchAll(CONECTORES_CONTRASTE)) cortes.push(m.index);
    cortes.push(trecho.length);

    for (let i = 0; i < cortes.length - 1; i++) {
      const a = cortes[i] as number;
      const b = cortes[i + 1] as number;
      if (b - a < 3) continue;
      saida.push({
        inicio: s.inicio + a,
        fim: s.inicio + b,
        busca: trecho.slice(a, b),
        lado: s.lado,
      });
    }
  }

  return saida;
}

/**
 * Nota de -1 a 1 de um trecho, com intensificadores, atenuadores e negadores
 * agindo numa janela de 3 tokens para trás.
 */
export function pontuarTrecho(busca: string): { score: number; termos: number } {
  const limpo = busca.replace(SAUDACOES, ' ');
  const tokens = limpo.match(/[\p{L}\p{N}]+/gu) ?? [];

  let total = 0;
  let termos = 0;

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i] as string;
    const base = PALAVRAS_POSITIVAS[t] ?? PALAVRAS_NEGATIVAS[t];
    if (base === undefined) continue;

    let mult = 1;
    for (let j = Math.max(0, i - 3); j < i; j++) {
      const anterior = tokens[j] as string;
      if (NEGADORES.includes(anterior)) mult *= -1;
      const inten = INTENSIFICADORES[anterior];
      if (inten !== undefined) mult *= inten;
      const aten = ATENUADORES[anterior];
      if (aten !== undefined) mult *= aten;
    }

    total += base * mult;
    termos++;
  }

  if (termos === 0) return { score: 0, termos: 0 };
  return { score: limitar(total / termos, -1, 1), termos };
}

/**
 * Limiar de neutralidade deliberadamente largo. Transcrição de reunião é cheia
 * de carga fraca; com limiar apertado quase tudo virava "positivo" e o campo
 * perdia utilidade. Só chama de positivo ou negativo quem se compromete.
 */
const LIMIAR = 0.22;

const polaridadeDe = (score: number): Polaridade =>
  score >= LIMIAR ? 'positivo' : score <= -LIMIAR ? 'negativo' : 'neutro';

export type ResultadoSentimento = {
  sentiment: Sentimento;
  sentiment_score: number;
  aspect_sentiment: SentimentoAspecto[];
};

export function analisarSentimento(prep: Preparado): ResultadoSentimento {
  /*
   * O sentimento medido é o DO CLIENTE. Sem este filtro, o discurso do vendedor
   * ("nossa integração é nativa, não tem redigitação") entrava como aspecto
   * positivo e a tela dizia que o cliente estava satisfeito com integração —
   * justamente o ponto onde ele havia manifestado desconfiança.
   */
  const todas = fatiarClausulas(prep);
  const clausulas = prep.podeFiltrarCliente ? todas.filter((c) => c.lado === 'cliente') : todas;

  // Sentimento por aspecto: a oração é a unidade.
  type Acumulador = { soma: number; peso: number; inicio: number; fim: number };
  const porAspecto = new Map<string, Acumulador>();

  let somaGlobal = 0;
  let pesoGlobal = 0;

  // Contraste no nível da oração: o cliente elogiou alguma coisa E reclamou de
  // outra? Isso é "misto" mesmo quando nenhum dos dois lados está ancorado num
  // aspecto conhecido do léxico.
  let clausulasPositivas = 0;
  let clausulasNegativas = 0;

  for (const c of clausulas) {
    const { score, termos } = pontuarTrecho(c.busca);
    if (termos === 0) continue;

    if (score >= LIMIAR) clausulasPositivas++;
    else if (score <= -LIMIAR) clausulasNegativas++;

    somaGlobal += score * termos;
    pesoGlobal += termos;

    for (const aspecto of ASPECTOS) {
      if (!algumPadrao(c.busca, aspecto.padroes)) continue;

      const atual = porAspecto.get(aspecto.rotulo);
      if (atual) {
        atual.soma += score * termos;
        atual.peso += termos;
        // Guarda a evidência do trecho de maior intensidade.
        if (Math.abs(score) > 0) {
          atual.inicio = Math.min(atual.inicio, c.inicio);
          atual.fim = Math.max(atual.fim, c.fim);
        }
      } else {
        porAspecto.set(aspecto.rotulo, {
          soma: score * termos,
          peso: termos,
          inicio: c.inicio,
          fim: c.fim,
        });
      }
    }
  }

  const aspect_sentiment: SentimentoAspecto[] = [];
  for (const [rotulo, acc] of porAspecto) {
    const score = acc.peso > 0 ? limitar(acc.soma / acc.peso, -1, 1) : 0;
    const polarity = polaridadeDe(score);
    if (polarity === 'neutro') continue; // aspecto sem carga não informa nada
    aspect_sentiment.push({
      aspect: rotulo,
      polarity,
      score: Number(score.toFixed(2)),
      evidence: evidenciaEm(prep, acc.inicio, acc.fim),
    });
  }

  aspect_sentiment.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  const global = pesoGlobal > 0 ? limitar(somaGlobal / pesoGlobal, -1, 1) : 0;

  const temPositivo = aspect_sentiment.some((a) => a.polarity === 'positivo') || clausulasPositivas > 0;
  const temNegativo = aspect_sentiment.some((a) => a.polarity === 'negativo') || clausulasNegativas > 0;

  let sentiment: Sentimento;
  if (temPositivo && temNegativo) sentiment = 'misto';
  else if (global >= LIMIAR) sentiment = 'positivo';
  else if (global <= -LIMIAR) sentiment = 'negativo';
  else sentiment = 'neutro';

  return {
    sentiment,
    sentiment_score: Number(global.toFixed(2)),
    aspect_sentiment,
  };
}
