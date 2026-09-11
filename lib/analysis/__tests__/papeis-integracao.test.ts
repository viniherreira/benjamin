import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { preparar } from '../rules/segment';
import { analisar } from '../index';

/**
 * A inferência de papel ligada ao pipeline.
 *
 * `papeis.test.ts` fixa o módulo isolado. Aqui é o contrato com o resto do
 * motor: o cargo que o rótulo já trazia e era descartado precisa chegar até a
 * inferência, a empresa vendedora precisa atravessar `EntradaAnalise` em vez de
 * ficar cravada no léxico, e a correção humana precisa mudar o briefing — não
 * só o log. Se inverter os papéis não move o talk ratio, a confirmação é teatro.
 */

const DATA = '2026-08-14';

describe('Cargo do rótulo chega até a inferência', () => {
  test('"Ricardo — Diretor Financeiro:" e "Ricardo:" continuam o mesmo falante', () => {
    const prep = preparar(
      'Ricardo — Diretor Financeiro: A gente fecha o trimestre semana que vem.\n' +
        'Paula: Entendi. Deixa eu te mostrar uma coisa.\n' +
        'Ricardo: Pode mandar.',
    );

    const ricardo = prep.falantes.filter((f) => f.nome === 'Ricardo');
    assert.equal(ricardo.length, 1, 'o cargo no rótulo não pode partir o agrupamento de turnos');
    assert.equal(ricardo[0]?.turnos, 2);
  });

  /*
   * O cliente que faz cotação pergunta mais que o vendedor. Aqui a taxa de
   * pergunta aponta para o lado errado de propósito: quem decide é o cargo.
   */
  test('o cargo classifica o lado mesmo contra a taxa de pergunta', () => {
    const prep = preparar(
      'Ricardo — Diretor Financeiro: E quanto custa? Dá pra parcelar? Como funciona o suporte?\n' +
        'Paula: Depende do módulo. Vou verificar e te retorno.',
    );

    assert.equal(prep.falantes.find((f) => f.nome === 'Ricardo')?.lado, 'cliente');
    assert.equal(prep.falantes.find((f) => f.nome === 'Paula')?.lado, 'vendedor');
  });

  test('cargo entre parênteses também conta', () => {
    const prep = preparar(
      'Carla (CSM): Roberto, obrigada por aceitar a call.\n' +
        'Roberto: Difícil é apelido, Carla. Vou ser bem direto.',
    );

    assert.equal(prep.falantes.find((f) => f.nome === 'Carla')?.lado, 'vendedor');
    assert.equal(prep.falantes.find((f) => f.nome === 'Roberto')?.lado, 'cliente');
  });
});

describe('Empresa vendedora é parâmetro da análise', () => {
  test('reunião de outra empresa classifica sem citar TOTVS', () => {
    const texto =
      'Diego: Aqui na Softly a gente faz a implantação em seis semanas.\n' +
      'Marta: Seis semanas é rápido. Como funciona hoje pra vocês?';

    const prep = preparar(texto, { empresaVendedora: 'Softly' });

    assert.equal(prep.falantes.find((f) => f.nome === 'Diego')?.lado, 'vendedor');
    assert.equal(prep.falantes.find((f) => f.nome === 'Marta')?.lado, 'cliente');
  });
});

describe('Os sinais sobrevivem até a camada de cima', () => {
  test('o falante carrega por que o motor decidiu aquilo', () => {
    const prep = preparar(
      'Bruno: Nossa plataforma cobre o fiscal inteiro. Posso te mostrar na prática.\n' +
        'Helena: A gente usa uma coisa caseira hoje e sofre no fechamento.',
    );

    const bruno = prep.falantes.find((f) => f.nome === 'Bruno');
    assert.ok(bruno, 'Bruno precisa existir');
    assert.ok(
      bruno.sinais.length > 0,
      'sem sinais a interface não tem o que mostrar quando o vendedor perguntar "por quê?"',
    );
  });
});

describe('Correção humana muda o briefing, não só o log', () => {
  const texto =
    'Ana: Nossa solução resolve isso. Posso te mostrar como funciona hoje?\n' +
    'João: A gente precisa muito disso aqui. O nosso time perde um tempo enorme no fechamento manual todo mês.';

  test('sem correção, Ana é a vendedora', () => {
    const r = analisar({ texto, dataReuniao: DATA });
    assert.ok(
      (r.conversation_metrics.talk_ratio_seller ?? 1) < 0.5,
      'Ana fala menos que João neste texto, então o ratio do vendedor precisa ser o menor',
    );
  });

  test('papéis fixados invertem o talk ratio, e não só a auditoria', () => {
    const normal = analisar({ texto, dataReuniao: DATA });
    const invertido = analisar({
      texto,
      dataReuniao: DATA,
      papeisFixados: { ana: 'cliente', joão: 'vendedor' },
    });

    assert.notEqual(
      normal.conversation_metrics.talk_ratio_seller,
      invertido.conversation_metrics.talk_ratio_seller,
      'se o humano inverte os papéis e a métrica não muda, a confirmação é teatro',
    );
    assert.equal(
      invertido.conversation_metrics.talk_ratio_seller,
      normal.conversation_metrics.talk_ratio_customer,
    );
  });
});
