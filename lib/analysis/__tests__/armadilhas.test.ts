/**
 * OS SETE CASOS-ARMADILHA (spec 7.5).
 *
 * Cada um destes é uma frase que um extrator ingênuo erra com confiança. São o
 * antídoto mais barato contra overfitting: passar no exemplo canônico e falhar
 * aqui significa que o motor decorou, não aprendeu.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analisar } from '../index';

const DATA = '2026-08-14';
const roda = (texto: string) => analisar({ texto, dataReuniao: DATA });

describe('Casos-armadilha', () => {
  test('1. Concorrente do passado não é ameaça ativa', () => {
    const r = roda(
      'Ana: E hoje vocês usam algum outro sistema?\n' +
        'João: Olha, a gente usava SAP na empresa anterior, mas aqui é tudo TOTVS.',
    );

    const sap = r.competitors.find((c) => c.name === 'SAP');
    assert.ok(sap, 'o SAP precisa ser detectado, só que como histórico');
    assert.equal(sap.active, false, '"usava na empresa anterior" é passado');
    assert.equal(sap.threat, 'baixa');

    const penalidade = r.score_factors.find((f) => f.label.includes('Concorrente ativo'));
    assert.equal(penalidade, undefined, 'concorrente histórico não pode penalizar o interesse');
  });

  test('2. Preço negado não vira objeção de preço', () => {
    const r = roda(
      'João: Não, preço não é problema pra gente. Não achamos caro, viu. O que pega é o prazo.',
    );

    const preco = r.objections.filter((o) => o.category === 'preco');
    assert.equal(
      preco.length,
      0,
      `nenhuma objeção de preço deveria sair daqui — vieram ${JSON.stringify(preco.map((o) => o.text))}`,
    );
  });

  test('3. Produto citado sem uso não é produto em uso', () => {
    const r = roda('João: Olha, o Protheus a gente nem chegou a usar direito, ficou parado.');

    const protheus = r.totvs_products.find((p) => /protheus/i.test(p.name));
    assert.ok(protheus, 'o Protheus precisa aparecer');
    assert.notEqual(protheus.status, 'em_uso', '"nem chegou a usar" é o oposto de estar em uso');
    assert.equal(protheus.status, 'mencionado');
  });

  test('4. Menção condicional gera oportunidade de probabilidade BAIXA', () => {
    const r = roda('João: Se um dia a gente crescer, talvez o Fluig faça sentido. Hoje não.');

    const fluig = r.opportunities.find((o) => /fluig/i.test(o.product));
    assert.ok(fluig, 'a oportunidade existe, só que fraca');
    assert.ok(
      fluig.probability <= 0.4,
      `"se um dia ... talvez" não é probabilidade alta — veio ${fluig.probability}`,
    );
  });

  test('5. Encerramento vago não conta como próximo passo', () => {
    const r = roda(
      'Ana: Consigo te mandar a proposta ainda essa semana, o que acha?\n' +
        'João: Vou ver e te aviso.',
    );

    assert.equal(r.next_steps.length, 0, '"vou ver e te aviso" não é compromisso');

    const penalidade = r.score_factors.find((f) => f.label.includes('sem próximo passo'));
    assert.ok(penalidade, 'a ausência de próximo passo precisa penalizar o interesse');
    assert.equal(penalidade.delta, -7);
  });

  test('6. Sem marcação de falante, não se inventa turno', () => {
    const r = roda(
      'a gente tem sofrido bastante com o fechamento da folha e o financeiro reclama todo mês ' +
        'do retrabalho que isso gera para o time inteiro aqui da operação',
    );

    assert.equal(r.conversation_metrics.turn_count, 0);
    assert.equal(r.conversation_metrics.talk_ratio_seller, null);
    assert.equal(r.conversation_metrics.longest_monologue_words, null);
    assert.equal(r.transcript_quality.has_diarization, false);
    assert.ok(
      r.transcript_quality.warnings.some((w) => /sem marcação de falante/i.test(w)),
      'a UI precisa ser avisada de que a métrica não existe',
    );
  });

  test('7. Pergunta repetida sobre integração é desconfiança, não interesse', () => {
    const r = roda('João: Mas o RM é integrado, né? Né? Porque já me prometeram isso antes.');

    const negativos = r.trust_signals.filter((s) => s.delta < 0);
    assert.ok(
      negativos.length > 0,
      `esperava sinal de desconfiança — vieram ${JSON.stringify(r.trust_signals.map((s) => s.label))}`,
    );
    assert.ok(r.trust_score < 50, `confiança deveria cair abaixo da base — veio ${r.trust_score}`);
  });
});

describe('Higiene geral do motor', () => {
  test('Transcrição vazia não quebra e não inventa nada', () => {
    const r = roda('');
    assert.equal(r.totvs_products.length, 0);
    assert.equal(r.competitors.length, 0);
    assert.equal(r.budget.length, 0);
    assert.equal(r.conversation_metrics.turn_count, 0);
  });

  test('Texto sem sinal comercial não produz falso positivo', () => {
    const r = roda(
      'Ana: Bom dia, tudo bem? Consegui abrir o link agora.\n' +
        'João: Bom dia. Tudo certo por aqui, o café ainda tá quente.\n' +
        'Ana: Ótimo, então vamos começar quando o Pedro entrar.',
    );

    assert.equal(r.competitors.length, 0, 'nenhum concorrente foi citado');
    assert.equal(r.budget.length, 0, 'nenhum valor foi citado');
    assert.equal(r.churn_signals.length, 0, 'nenhum sinal de risco foi dito');
    assert.equal(r.objections.length, 0, 'nenhuma objeção foi levantada');
  });

  test('LGPD: CPF e e-mail são mascarados e contabilizados', () => {
    const r = roda('João: Meu CPF é 123.456.789-00 e meu e-mail é joao.silva@empresa.com.br.');
    assert.equal(r.transcript_quality.redacted_entities, 2);
  });
});
