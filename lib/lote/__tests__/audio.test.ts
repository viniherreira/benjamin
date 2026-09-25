import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificarWav, ehSilencio, limparTranscricaoDeTrecho, planejarCortes, TAXA } from '../audio';

/** "Fala" (ruído) com uma pausa de 1 s a cada 7 s, a partir do segundo 5. */
function reuniaoSintetica(segundos: number, pausas: number[]): Float32Array {
  const s = new Float32Array(segundos * TAXA);
  let semente = 42;
  const aleatorio = () => ((semente = (semente * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) * 2 - 1;
  for (let i = 0; i < s.length; i++) s[i] = aleatorio() * 0.3;
  for (const p of pausas) s.fill(0, p * TAXA, (p + 1) * TAXA);
  return s;
}

test('cortes caem nas pausas e nenhum trecho passa de 110 s', () => {
  const pausas = Array.from({ length: 42 }, (_, i) => 5 + i * 7);
  const sinal = reuniaoSintetica(300, pausas);
  const cortes = planejarCortes(sinal);

  assert.equal(cortes[0]![0], 0);
  assert.equal(cortes.at(-1)![1], sinal.length, 'cobre o áudio inteiro');
  for (let i = 1; i < cortes.length; i++) assert.equal(cortes[i]![0], cortes[i - 1]![1], 'sem buraco nem sobreposição');

  for (const [de, ate] of cortes.slice(0, -1)) {
    assert.ok((ate - de) / TAXA <= 110, 'no máximo 110 s');
    const segundo = ate / TAXA;
    const dentroDePausa = pausas.some((p) => segundo >= p && segundo <= p + 1);
    assert.ok(dentroDePausa, `corte em ${segundo.toFixed(2)} s deveria cair numa pausa`);
  }
});

test('WAV de 110 s cabe no limite de 4,5 MB da Vercel', () => {
  const sinal = reuniaoSintetica(110, []);
  const wav = codificarWav(sinal, 0, sinal.length);
  assert.ok(wav.size < 4.5 * 1024 * 1024, `${(wav.size / 1024 / 1024).toFixed(2)} MB`);
});

test('cabeçalho WAV é PCM 16 bits mono 16 kHz', async () => {
  const wav = codificarWav(new Float32Array(TAXA), 0, TAXA);
  const v = new DataView(await wav.arrayBuffer());
  const texto = (o: number) => String.fromCharCode(...new Uint8Array(v.buffer, o, 4));
  assert.deepEqual([texto(0), texto(8), texto(12), texto(36)], ['RIFF', 'WAVE', 'fmt ', 'data']);
  assert.deepEqual([v.getUint16(20, true), v.getUint16(22, true), v.getUint32(24, true), v.getUint16(34, true)], [1, 1, 16000, 16]);
});

test('silêncio não é enviado; fala curta no meio do silêncio é', () => {
  const quieto = new Float32Array(60 * TAXA);
  assert.equal(ehSilencio(quieto, 0, quieto.length), true);
  const comUmaFrase = new Float32Array(60 * TAXA);
  for (let i = 30 * TAXA; i < 32 * TAXA; i++) comUmaFrase[i] = Math.sin(i / 5) * 0.2;
  assert.equal(ehSilencio(comUmaFrase, 0, comUmaFrase.length), false);
});

test('alucinação do Whisper sobre silêncio é descartada só quando é o trecho inteiro', () => {
  assert.equal(limparTranscricaoDeTrecho('Legendas pela comunidade Amara.org'), '');
  assert.equal(limparTranscricaoDeTrecho('Obrigado por assistir!'), '');
  const real = 'Obrigado por assistir à demonstração, agora vamos falar do preço.';
  assert.equal(limparTranscricaoDeTrecho(real), real);
});
