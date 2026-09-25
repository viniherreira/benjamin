import { limparTranscricaoDeTrecho } from '../lote/audio';
import type { Segmento } from './mesclar';

/**
 * O que o Whisper devolve em verbose_json, só com os campos que usamos.
 */
export type SegmentoWhisper = {
  start: number;
  end: number;
  text: string;
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
};

/**
 * Descarta o que o Whisper produziu sem ter ouvido fala.
 *
 * Os limiares são os que o próprio Whisper usa para decidir que um trecho é
 * silêncio ou alucinação (no_speech_threshold 0,6 com logprob_threshold -1,0;
 * compression_ratio_threshold 2,4). Pela API eles não são aplicados — o texto
 * volta mesmo quando o modelo "acha" que não havia fala. Aplicar aqui é o que
 * impede "Legendas pela comunidade Amara.org" ou "e aí e aí e aí e aí" de
 * entrarem na transcrição e o motor analisar uma frase que ninguém disse.
 */
export function filtrarSegmentos(segmentos: SegmentoWhisper[]): { mantidos: Segmento[]; descartados: number } {
  const mantidos: Segmento[] = [];
  let descartados = 0;
  for (const s of segmentos) {
    const silencio = (s.no_speech_prob ?? 0) > 0.6 && (s.avg_logprob ?? 0) < -1;
    const repeticao = (s.compression_ratio ?? 0) > 2.4;
    const texto = limparTranscricaoDeTrecho(s.text ?? '');
    if (silencio || repeticao || !texto) {
      descartados++;
      continue;
    }
    mantidos.push({ inicio: s.start, fim: s.end, texto });
  }
  return { mantidos, descartados };
}
