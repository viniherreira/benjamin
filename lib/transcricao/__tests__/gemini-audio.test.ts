import { test } from 'node:test';
import assert from 'node:assert/strict';
import { limparSaida } from '../gemini-audio';
import { preparar } from '../../analysis/rules/segment';

test('rótulo numérico vira letra — o motor não aceita dígito no nome', () => {
  const saida = limparSaida('Falante 1: Bom dia, obrigado pelo tempo.\nFalante 2: Bom dia.\nSpeaker 1: Vamos lá.');
  assert.equal(saida, 'Falante A: Bom dia, obrigado pelo tempo.\nFalante B: Bom dia.\nFalante A: Vamos lá.');
});

test('negrito, marcador de lista e cerca de código saem', () => {
  const saida = limparSaida('```\n**Carla:** Como está o fechamento?\n- **Roberto:** Onze dias.\n```');
  assert.equal(saida, 'Carla: Como está o fechamento?\nRoberto: Onze dias.');
});

test('contexto repetido no começo da resposta é descartado', () => {
  const contexto = 'Carla: Como está o fechamento?\nRoberto: Onze dias.';
  const saida = limparSaida('Roberto: Onze dias.\nCarla: E a conciliação?\nRoberto: Manual.', contexto);
  assert.equal(saida, 'Carla: E a conciliação?\nRoberto: Manual.');
});

test('fala nova igual a uma do contexto, depois de fala inédita, fica', () => {
  const saida = limparSaida('Carla: Entendi.\nRoberto: Sim.', 'Roberto: Sim.');
  assert.equal(saida, 'Carla: Entendi.\nRoberto: Sim.');
});

test('resposta vazia continua vazia', () => {
  assert.equal(limparSaida('  \n\n'), '');
});

test('a saída limpa é lida pelo motor como reunião com dois falantes', () => {
  const saida = limparSaida(
    [
      'Falante 1: Obrigada por receber a gente. Como está o fechamento contábil hoje?',
      'Falante 2: Leva onze dias. A conciliação é manual e usamos uma planilha paralela.',
      'Falante 1: Posso te mostrar como a plataforma resolve isso.',
      'Falante 2: Já estou cotando com a Sankhya, e o diretor pediu alternativas.',
    ].join('\n'),
  );
  const p = preparar(saida);
  assert.equal(p.temDiarizacao, true);
  assert.deepEqual(
    p.falantes.map((f) => f.nome).sort(),
    ['Falante A', 'Falante B'],
  );
});
