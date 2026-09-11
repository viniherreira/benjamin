import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { metricaDePapel } from '../metrics';
import { gold } from '../tipos';
import type { FalanteInferido } from '../../analysis/types';

/**
 * Métrica de papel.
 *
 * Acurácia por falante sozinha esconde o erro que mais dói. Trocar os dois
 * lados de lugar não é "um erro a mais": inverte o talk ratio, troca a voz do
 * cliente pela do vendedor e faz o briefing inteiro mentir com confiança. Por
 * isso a inversão tem número próprio.
 *
 * E acurácia sem baseline não diz nada. O corpus foi escrito pela própria
 * equipe, e nele o vendedor quase sempre fala primeiro — um chute burro acerta
 * muito. Se a inferência não bate "quem fala primeiro é o vendedor" com folga,
 * ela decorou o formato do corpus em vez de aprender a conversa.
 */

const falante = (name: string, side: FalanteInferido['side'], signals: string[] = []): FalanteInferido => ({
  name,
  side,
  confidence: 0.5,
  signals,
  words: 10,
  turns: 2,
});

describe('Acurácia por falante', () => {
  test('conta acerto e erro falante a falante, não amostra a amostra', () => {
    const m = metricaDePapel([
      {
        speakers: [falante('Ana', 'vendedor'), falante('João', 'cliente')],
        gold: gold({ papeis: { ana: 'vendedor', joão: 'cliente' } }),
      },
      {
        speakers: [falante('Carla', 'vendedor'), falante('Roberto', 'vendedor')],
        gold: gold({ papeis: { carla: 'vendedor', roberto: 'cliente' } }),
      },
    ]);

    assert.equal(m.por_falante.total, 4);
    assert.equal(m.por_falante.acertos, 3);
  });

  test('amostra sem papel anotado fica fora da conta', () => {
    const m = metricaDePapel([
      { speakers: [falante('Ana', 'vendedor')], gold: gold({}) },
      {
        speakers: [falante('Bruno', 'vendedor'), falante('Helena', 'cliente')],
        gold: gold({ papeis: { bruno: 'vendedor', helena: 'cliente' } }),
      },
    ]);

    assert.equal(m.por_falante.total, 2);
    assert.equal(m.por_falante.acertos, 2);
  });

  test('falante anotado que o motor não produziu conta como erro, não some da conta', () => {
    const m = metricaDePapel([
      {
        speakers: [falante('Ana', 'vendedor')],
        gold: gold({ papeis: { ana: 'vendedor', joão: 'cliente' } }),
      },
    ]);

    assert.equal(m.por_falante.total, 2, 'o denominador é o gabarito, não o que o motor conseguiu ver');
    assert.equal(m.por_falante.acertos, 1);
  });
});

describe('Taxa de inversão', () => {
  test('os dois lados trocados conta como inversão', () => {
    const m = metricaDePapel([
      {
        speakers: [falante('Ana', 'cliente'), falante('João', 'vendedor')],
        gold: gold({ papeis: { ana: 'vendedor', joão: 'cliente' } }),
      },
    ]);

    assert.equal(m.inversoes.amostras, 1);
    assert.equal(m.inversoes.total, 1);
  });

  test('errar um lado só não é inversão — é erro simples', () => {
    const m = metricaDePapel([
      {
        speakers: [falante('Ana', 'vendedor'), falante('João', 'vendedor')],
        gold: gold({ papeis: { ana: 'vendedor', joão: 'cliente' } }),
      },
    ]);

    assert.equal(m.inversoes.amostras, 0, 'um lado certo e um errado não inverteu o briefing');
  });

  test('"desconhecido" não é inversão — o motor não decidiu, não decidiu errado', () => {
    const m = metricaDePapel([
      {
        speakers: [falante('Ana', 'desconhecido'), falante('João', 'desconhecido')],
        gold: gold({ papeis: { ana: 'vendedor', joão: 'cliente' } }),
      },
    ]);

    assert.equal(m.inversoes.amostras, 0);
  });
});

describe('Baseline "quem fala primeiro é o vendedor"', () => {
  test('mede o chute burro no mesmo denominador da inferência', () => {
    const m = metricaDePapel([
      {
        // O motor erra os dois; o baseline acerta os dois, porque Ana abre.
        speakers: [falante('Ana', 'cliente'), falante('João', 'vendedor')],
        gold: gold({ papeis: { ana: 'vendedor', joão: 'cliente' } }),
      },
    ]);

    assert.equal(m.baseline_primeiro_a_falar.total, m.por_falante.total);
    assert.equal(m.baseline_primeiro_a_falar.acertos, 2);
    assert.equal(m.por_falante.acertos, 0);
  });

  test('quando o cliente abre a reunião, o baseline erra', () => {
    const m = metricaDePapel([
      {
        speakers: [falante('João', 'cliente'), falante('Ana', 'vendedor')],
        gold: gold({ papeis: { joão: 'cliente', ana: 'vendedor' } }),
      },
    ]);

    assert.equal(m.por_falante.acertos, 2, 'a inferência acertou');
    assert.equal(m.baseline_primeiro_a_falar.acertos, 0, 'o chute burro errou os dois');
  });
});

describe('Quanto do acerto veio de chute', () => {
  test('decisão por ordem de fala é contada separadamente', () => {
    const m = metricaDePapel([
      {
        speakers: [falante('Ana', 'vendedor', ['ordem_de_fala']), falante('João', 'cliente', ['propagado'])],
        gold: gold({ papeis: { ana: 'vendedor', joão: 'cliente' } }),
      },
      {
        speakers: [falante('Bruno', 'vendedor', ['dexis_fornecedor']), falante('Helena', 'cliente', ['propagado'])],
        gold: gold({ papeis: { bruno: 'vendedor', helena: 'cliente' } }),
      },
    ]);

    assert.equal(m.por_falante.acertos, 4, 'os dois acertaram tudo');
    assert.equal(
      m.amostras_por_ordem_de_fala,
      1,
      'mas só uma amostra sabia por quê — a outra chutou e teve sorte',
    );
  });
});
