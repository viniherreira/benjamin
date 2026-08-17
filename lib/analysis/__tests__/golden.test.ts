/**
 * TESTE DE ACEITAÇÃO Nº 1 — o exemplo canônico do slide 15 da TOTVS.
 *
 * Este é o primeiro teste do sistema e foi escrito antes de qualquer linha do
 * motor. Ele não compara strings da tabela do slide: compara os campos
 * semânticos que a tabela descreve. Comparar string levaria o motor a decorar
 * uma resposta em vez de extraí-la.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analisar } from '../index';
import { EXEMPLO_CANONICO } from '../exemplo-canonico';

const r = analisar({ texto: EXEMPLO_CANONICO, dataReuniao: '2026-08-14' });

const acha = <T>(lista: T[], p: (x: T) => boolean, oque: string): T => {
  const achado = lista.find(p);
  assert.ok(achado, `esperava encontrar ${oque} — recebi: ${JSON.stringify(lista, null, 2)}`);
  return achado;
};

describe('Exemplo canônico TOTVS — slide 15', () => {
  test('Produto: Protheus está EM USO e RM é OPORTUNIDADE', () => {
    const protheus = acha(
      r.totvs_products,
      (p) => /protheus/i.test(p.name),
      'o Protheus entre os produtos',
    );
    assert.equal(protheus.status, 'em_uso', '"o nosso Protheus está atendendo" indica uso corrente');
    assert.equal(protheus.unit, 'gestao');

    const rm = acha(r.totvs_products, (p) => /\bRM\b/i.test(p.name), 'o RM entre os produtos');
    assert.equal(
      rm.status,
      'oportunidade',
      '"se o RM for realmente integrado" é condicional: ainda não está em uso',
    );
  });

  test('Concorrência: Senior aparece como ameaça ATIVA', () => {
    const senior = acha(r.competitors, (c) => /senior/i.test(c.name), 'a Senior entre os concorrentes');
    assert.equal(senior.active, true, 'a demo foi vista agora, não numa empresa anterior');
    assert.notEqual(senior.threat, 'baixa', 'o cliente viu a demo e gostou — não é ameaça baixa');
  });

  test('Upsell: oportunidade de folha/RH com probabilidade alta', () => {
    const op = acha(
      r.opportunities,
      (o) => /rm|folha|rh/i.test(o.product) || /rm|folha|rh/i.test(o.rationale),
      'uma oportunidade ligada a RM/Folha/RH',
    );
    assert.ok(
      op.probability >= 0.6,
      `a dor é explícita e o cliente prefere a TOTVS: probabilidade deveria ser alta, veio ${op.probability}`,
    );
    assert.ok(r.upsell_signals.length > 0, 'deveria haver ao menos um sinal de upsell');
  });

  test('Persona: influenciador, não decisor final', () => {
    assert.equal(
      r.persona.decision_power,
      'influenciador',
      'quem precisa convencer o próprio CFO não é o decisor final',
    );
  });

  test('Budget: R$ 50.000 marcado como confidencial', () => {
    const b = acha(r.budget, (x) => x.amount === 50000, 'o valor de 50 mil normalizado para 50000');
    assert.equal(b.currency, 'BRL');
    assert.equal(
      b.confidential,
      true,
      '"não mencione esse valor ... para o meu CFO" é pedido explícito de sigilo',
    );
  });

  test('Sentimento: MISTO, decomposto por aspecto', () => {
    assert.equal(r.sentiment, 'misto');

    assert.ok(
      r.aspect_sentiment.length >= 2,
      `sentimento por aspecto precisa separar backoffice de RH — vieram ${r.aspect_sentiment.length}`,
    );

    const positivos = r.aspect_sentiment.filter((a) => a.polarity === 'positivo');
    const negativos = r.aspect_sentiment.filter((a) => a.polarity === 'negativo');
    assert.ok(positivos.length >= 1, 'o backoffice atendido é o lado satisfeito');
    assert.ok(negativos.length >= 1, 'o RH sofrendo com folha manual é o lado frustrado');

    assert.ok(
      positivos.some((a) => /backoffice|protheus/i.test(a.aspect)),
      `esperava aspecto positivo de backoffice/Protheus — vieram: ${positivos.map((a) => a.aspect).join(', ')}`,
    );
    assert.ok(
      negativos.some((a) => /rh|folha/i.test(a.aspect)),
      `esperava aspecto negativo de RH/folha — vieram: ${negativos.map((a) => a.aspect).join(', ')}`,
    );
  });

  test('Confiança: o pedido de sigilo é sinal de rapport alto', () => {
    assert.ok(
      r.trust_score >= 60,
      `compartilhar valor e pedir sigilo perante o CFO é confiança alta — veio ${r.trust_score}`,
    );
    assert.ok(r.trust_signals.length > 0, 'o sinal de confiança precisa estar listado e evidenciado');
  });

  test('Dor de RH vira problema mapeado', () => {
    const dor = acha(
      r.problems,
      (p) => /folha|rh/i.test(p.text),
      'o problema da folha manual',
    );
    assert.equal(dor.category, 'rh');
  });

  test('Sem marcação de falante: métricas de conversa em null, sem inventar turno', () => {
    assert.equal(r.conversation_metrics.talk_ratio_seller, null);
    assert.equal(r.conversation_metrics.seller_questions, null);
    assert.equal(r.transcript_quality.has_diarization, false);
    assert.ok(
      r.transcript_quality.reliability_index < 100,
      'transcrição sem diarização não pode ter confiabilidade máxima',
    );
  });

  test('Motor roda em regras e reporta latência', () => {
    assert.equal(r.engine, 'rules');
    assert.ok(typeof r.latency_ms === 'number');
  });
});
