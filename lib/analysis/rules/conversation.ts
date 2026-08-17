import type { Bant, MetricasConversa, Turno } from '../types';
import type { Preparado } from './segment';
import { contarPalavras } from './util';

/**
 * Métricas de conversa — a família B1 da provocação B da TOTVS, incluindo o
 * talk-to-listen ratio, que o briefing pede por escrito.
 *
 * Sem marcação de falante não existe turno. Neste caso tudo volta `null` e a
 * confiabilidade da transcrição cai: inventar turno seria fabricar a métrica.
 */

const ABERTURAS_ABERTAS = [
  'como', 'por que', 'porque', 'o que', 'qual', 'quais', 'quando', 'onde', 'quem',
  'me conta', 'me fala', 'me explica', 'de que forma', 'o quanto',
  'quanto', 'quantos', 'quantas', 'quanta',
];

/** Conectivos que só atrasam o início da pergunta de verdade. */
const PREFIXOS_DESCARTAVEIS = /^(?:e|mas|entao|ai|ok|ta|bom|olha|agora|so que|so)\s+/u;

const METRICAS_VAZIAS: Omit<MetricasConversa, 'turn_count'> = {
  talk_ratio_seller: null,
  talk_ratio_customer: null,
  longest_monologue_words: null,
  seller_questions: null,
  open_questions: null,
  closed_questions: null,
  words_before_first_question: null,
  interruptions: null,
  followup_depth: null,
};

/** Frases interrogativas do trecho, com a posição relativa de cada uma. */
function perguntasDe(texto: string): { frase: string; pos: number }[] {
  const saida: { frase: string; pos: number }[] = [];
  let inicio = 0;

  for (let i = 0; i < texto.length; i++) {
    if (texto[i] === '?') {
      const frase = texto.slice(inicio, i + 1).trim();
      if (frase.length > 1) saida.push({ frase, pos: inicio });
      inicio = i + 1;
    } else if (texto[i] === '.' || texto[i] === '!') {
      inicio = i + 1;
    }
  }

  return saida;
}

/**
 * Aberta ou fechada?
 *
 * A pergunta de verdade costuma vir depois de um lead-in: em "Antes de entrar
 * na apresentação, me conta uma coisa: como está o fechamento da folha?" o que
 * importa é o trecho após os dois-pontos. Olhar só o começo da frase inteira
 * classificava toda pergunta contextualizada como fechada.
 */
function ehAberta(frase: string): boolean {
  const normalizada = frase
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

  // A última oração após vírgula ou dois-pontos é onde a pergunta mora.
  const partes = normalizada.split(/[:,;]/u);
  const candidatas = [partes[partes.length - 1] ?? '', normalizada];

  for (const bruta of candidatas) {
    const limpa = bruta.replace(/^[^\p{L}]+/u, '').replace(PREFIXOS_DESCARTAVEIS, '');
    if (ABERTURAS_ABERTAS.some((a) => limpa.startsWith(a))) return true;
  }

  return false;
}

export function metricasConversa(prep: Preparado): MetricasConversa {
  if (!prep.temDiarizacao) {
    return { ...METRICAS_VAZIAS, turn_count: 0 };
  }

  const turnos = prep.turnos;
  const vendedor = turnos.filter((t) => t.lado === 'vendedor');
  const cliente = turnos.filter((t) => t.lado === 'cliente');

  const palavrasVendedor = vendedor.reduce((s, t) => s + t.palavras, 0);
  const palavrasCliente = cliente.reduce((s, t) => s + t.palavras, 0);
  const totalLados = palavrasVendedor + palavrasCliente;

  // Sem conseguir separar os lados, o ratio não significa nada.
  const temLados = vendedor.length > 0 && cliente.length > 0 && totalLados > 0;

  // Monólogo: turnos seguidos do mesmo falante contam como um bloco só.
  let maiorMonologo = 0;
  let blocoAtual = 0;
  let anterior: string | null = null;
  for (const t of turnos) {
    if (t.lado !== 'vendedor') {
      blocoAtual = 0;
      anterior = null;
      continue;
    }
    blocoAtual = anterior === t.falante ? blocoAtual + t.palavras : t.palavras;
    anterior = t.falante;
    if (blocoAtual > maiorMonologo) maiorMonologo = blocoAtual;
  }

  let perguntas = 0;
  let abertas = 0;
  let fechadas = 0;
  let palavrasAtePrimeira: number | null = null;
  let acumulado = 0;

  for (const t of vendedor) {
    const ps = perguntasDe(t.texto);
    for (const p of ps) {
      perguntas++;
      if (ehAberta(p.frase)) abertas++;
      else fechadas++;
    }
    if (palavrasAtePrimeira === null && ps.length > 0) {
      const primeira = ps[0] as { frase: string; pos: number };
      palavrasAtePrimeira = acumulado + contarPalavras(t.texto.slice(0, primeira.pos));
    }
    acumulado += t.palavras;
  }

  // Interrupção: o turno anterior terminou sem pontuação final e o falante mudou.
  let interrupcoes = 0;
  for (let i = 1; i < turnos.length; i++) {
    const ant = turnos[i - 1] as Turno;
    const atu = turnos[i] as Turno;
    if (ant.falante === atu.falante) continue;
    if (ant.palavras < 3) continue;
    if (!/[.!?…]["')\]]?$/u.test(ant.texto.trim())) interrupcoes++;
  }

  // Profundidade de escuta: perguntas do vendedor encadeadas, com resposta do
  // cliente entre elas — sinal de que ele aprofundou em vez de trocar de assunto.
  let profundidade = 0;
  let cadeia = 0;
  let esperandoResposta = false;
  for (const t of turnos) {
    const temPergunta = t.texto.includes('?');
    if (t.lado === 'vendedor' && temPergunta) {
      cadeia = esperandoResposta ? cadeia + 1 : 1;
      esperandoResposta = false;
      if (cadeia > profundidade) profundidade = cadeia;
    } else if (t.lado === 'cliente') {
      esperandoResposta = cadeia > 0;
    } else if (t.lado === 'vendedor' && !temPergunta) {
      esperandoResposta = false;
    }
  }

  return {
    talk_ratio_seller: temLados ? Number((palavrasVendedor / totalLados).toFixed(3)) : null,
    talk_ratio_customer: temLados ? Number((palavrasCliente / totalLados).toFixed(3)) : null,
    longest_monologue_words: maiorMonologo,
    seller_questions: perguntas,
    open_questions: abertas,
    closed_questions: fechadas,
    words_before_first_question: palavrasAtePrimeira,
    interruptions: interrupcoes,
    followup_depth: profundidade,
    turn_count: turnos.length,
  };
}

/* ------------------------------------------------------------------ *
 * Cobertura BANT
 * ------------------------------------------------------------------ */

export function calcularBant(entrada: {
  temBudget: boolean;
  temAutoridade: boolean;
  temNecessidade: boolean;
  temPrazo: boolean;
}): Bant {
  const { temBudget, temAutoridade, temNecessidade, temPrazo } = entrada;

  const missing: string[] = [];
  if (!temBudget) missing.push('Budget');
  if (!temAutoridade) missing.push('Authority');
  if (!temNecessidade) missing.push('Need');
  if (!temPrazo) missing.push('Timeline');

  return {
    budget: temBudget,
    authority: temAutoridade,
    need: temNecessidade,
    timeline: temPrazo,
    score: 4 - missing.length,
    missing,
  };
}
