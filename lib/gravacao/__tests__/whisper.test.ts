import { test } from 'node:test';
import assert from 'node:assert/strict';
import { filtrarSegmentos } from '../whisper';

test('segmentos que o Whisper produziu sem ouvir fala são descartados', () => {
  const { mantidos, descartados } = filtrarSegmentos([
    { start: 0, end: 4, text: ' Bom dia, vamos falar do Protheus.', avg_logprob: -0.2, compression_ratio: 1.3, no_speech_prob: 0.01 },
    // silêncio: o modelo acha que não havia fala e inventa assim mesmo
    { start: 4, end: 30, text: ' Legendas pela comunidade Amara.org', avg_logprob: -1.4, compression_ratio: 1.1, no_speech_prob: 0.92 },
    // laço de repetição
    { start: 30, end: 40, text: ' e aí e aí e aí e aí e aí e aí e aí e aí e aí e aí e aí', avg_logprob: -0.5, compression_ratio: 3.8, no_speech_prob: 0.1 },
    // no_speech alto mas o modelo confiante: fala baixa real, fica
    { start: 40, end: 43, text: ' Pode mandar a proposta.', avg_logprob: -0.3, compression_ratio: 1.2, no_speech_prob: 0.7 },
    // alucinação conhecida inteira, sem métricas
    { start: 43, end: 50, text: ' Obrigado por assistir!' },
  ]);
  assert.equal(descartados, 3);
  assert.deepEqual(mantidos, [
    { inicio: 0, fim: 4, texto: 'Bom dia, vamos falar do Protheus.' },
    { inicio: 40, fim: 43, texto: 'Pode mandar a proposta.' },
  ]);
});
