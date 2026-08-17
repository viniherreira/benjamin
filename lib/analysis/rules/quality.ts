import type { QualidadeTranscricao } from '../types';
import type { Preparado } from './segment';
import { MULETAS } from './lexicons';
import { limitar } from './util';

/**
 * Indicadores SOBRE a transcrição — família B2 da provocação B.
 *
 * A TOTVS perguntou o que dá para medir a respeito da matéria-prima, não o que
 * dá para extrair dela. O Índice de Confiabilidade sintetiza tudo num número
 * que a UI exibe junto do briefing: permite dizer "este briefing saiu de uma
 * transcrição ruim, trate as extrações com cautela".
 */

/** Palavras por minuto numa conversa em português falado. */
const PPM = 140;

export function avaliarQualidade(prep: Preparado): QualidadeTranscricao {
  const tokens = prep.textoSeguro.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? [];
  const word_count = tokens.length;

  const minusculos = tokens.map((t) => t.toLowerCase());
  const unicos = new Set(minusculos).size;
  const lexical_diversity = word_count > 0 ? unicos / word_count : 0;

  let muletas = 0;
  for (const t of minusculos) if (MULETAS.includes(t)) muletas++;
  const filler_density = word_count > 0 ? muletas / word_count : 0;

  const inaudible_ratio =
    prep.sentencas.length > 0 ? prep.trechosInaudiveis / prep.sentencas.length : 0;

  const speaker_count = prep.falantes.length;
  const estimated_minutes = Number((word_count / PPM).toFixed(1));

  const warnings: string[] = [];
  let indice = 100;

  if (!prep.temDiarizacao) {
    indice -= 25;
    warnings.push('Transcrição sem marcação de falante: métricas de conversa indisponíveis.');
  }

  if (inaudible_ratio > 0) {
    const perda = Math.min(30, Math.round(inaudible_ratio * 200));
    indice -= perda;
    warnings.push(
      `${(inaudible_ratio * 100).toFixed(0)}% das sentenças contêm trecho inaudível ou incerto.`,
    );
  }

  if (word_count < 150) {
    indice -= 15;
    warnings.push('Transcrição curta: menos de 150 palavras reduzem a base de evidência.');
  }

  if (filler_density > 0.08) {
    indice -= 10;
    warnings.push('Alta densidade de muletas de linguagem — sinal de transcrição ruidosa.');
  }

  if (prep.temDiarizacao && speaker_count < 2) {
    indice -= 10;
    warnings.push('Apenas um falante identificado numa reunião.');
  }

  if (prep.temDiarizacao) {
    const semLado = prep.falantes.filter((f) => f.lado === 'desconhecido').length;
    if (semLado > 0) {
      indice -= 8;
      warnings.push(`${semLado} falante(s) sem classificação confiável de vendedor/cliente.`);
    }
  }

  return {
    word_count,
    turn_count: prep.turnos.length,
    speaker_count,
    estimated_minutes,
    has_diarization: prep.temDiarizacao,
    inaudible_ratio: Number(inaudible_ratio.toFixed(3)),
    filler_density: Number(filler_density.toFixed(3)),
    lexical_diversity: Number(lexical_diversity.toFixed(3)),
    redacted_entities: prep.redacoes.length,
    reliability_index: Math.round(limitar(indice, 0, 100)),
    warnings,
  };
}
