import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { inferirPapeis, type FalaDoTurno } from '../rules/papeis';

/**
 * Inferência de papel — quem vende e quem compra.
 *
 * A transcrição raramente diz "este é o vendedor". O que ela traz é cargo no
 * rótulo, dêixis ("nossa plataforma" vs "a gente usa"), e a assimetria de quem
 * pergunta e quem responde. Estes testes fixam cada sinal isoladamente, porque
 * um léxico que só funciona quando todos os sinais aparecem juntos não serve
 * para transcrição real.
 *
 * Regra que atravessa o arquivo: nenhum teste depende do nome TOTVS. O motor é
 * de um produto TOTVS, mas a inferência de papel não pode estar amarrada a ele
 * — senão qualquer reunião em que a marca não é citada perde a classificação.
 */

const fala = (falante: string, texto: string, cargo?: string): FalaDoTurno => ({
  falante,
  texto,
  palavras: texto.split(/\s+/).filter(Boolean).length,
  cargo: cargo ?? null,
});

const ladoDe = (papeis: ReturnType<typeof inferirPapeis>, nome: string) =>
  papeis.find((p) => p.nome === nome)?.lado;

describe('Sinal: cargo declarado no rótulo', () => {
  test('cargo de fornecedor no rótulo identifica o vendedor', () => {
    const papeis = inferirPapeis([
      fala('Carla', 'Roberto, obrigada por aceitar a call.', 'CSM'),
      fala('Roberto', 'Difícil é apelido, Carla. Vou ser bem direto.'),
    ]);

    assert.equal(ladoDe(papeis, 'Carla'), 'vendedor');
    assert.equal(ladoDe(papeis, 'Roberto'), 'cliente');
  });

  test('cargo de comprador no rótulo identifica o cliente', () => {
    const papeis = inferirPapeis([
      fala('Ricardo', 'A gente fecha o trimestre semana que vem.', 'Diretor Financeiro'),
      fala('Paula', 'Entendi, Ricardo. Deixa eu te mostrar uma coisa.'),
    ]);

    assert.equal(ladoDe(papeis, 'Ricardo'), 'cliente');
    assert.equal(ladoDe(papeis, 'Paula'), 'vendedor');
  });
});

describe('Sinal: dêixis de fornecedor e de comprador', () => {
  test('sem citar marca nenhuma, "nossa plataforma" marca o vendedor', () => {
    const papeis = inferirPapeis([
      fala('Bruno', 'Nossa plataforma cobre o fiscal inteiro. Posso te mostrar na prática.'),
      fala('Helena', 'Legal. A gente usa uma coisa caseira hoje.'),
    ]);

    assert.equal(ladoDe(papeis, 'Bruno'), 'vendedor');
    assert.equal(ladoDe(papeis, 'Helena'), 'cliente');
  });

  test('"vocês cobram" e "meu diretor" marcam o cliente', () => {
    const papeis = inferirPapeis([
      fala('Helena', 'Vocês cobram por usuário? Meu diretor vai perguntar isso.'),
      fala('Bruno', 'Boa pergunta. Depende do módulo.'),
    ]);

    assert.equal(ladoDe(papeis, 'Helena'), 'cliente');
    assert.equal(ladoDe(papeis, 'Bruno'), 'vendedor');
  });

  test('o nome da empresa vendedora é parâmetro, não constante do código', () => {
    const turnos = [
      fala('Diego', 'Aqui na Softly a gente faz a implantação em seis semanas.'),
      fala('Marta', 'Seis semanas é rápido. Como funciona?'),
    ];

    assert.equal(ladoDe(inferirPapeis(turnos, { empresaVendedora: 'Softly' }), 'Diego'), 'vendedor');
  });
});

describe('Sinal: quem pergunta conduz', () => {
  test('sem léxico nenhum, quem faz as perguntas é o vendedor', () => {
    const papeis = inferirPapeis([
      fala('P1', 'Como está o fechamento hoje?'),
      fala('P2', 'Fecha no dia dez, sempre atrasado.'),
      fala('P1', 'E o que trava?'),
      fala('P2', 'Conferência manual, planilha atrás de planilha.'),
      fala('P1', 'Quantas pessoas nisso?'),
      fala('P2', 'Três, às vezes quatro no pico.'),
    ]);

    assert.equal(ladoDe(papeis, 'P1'), 'vendedor');
    assert.equal(ladoDe(papeis, 'P2'), 'cliente');
  });
});

describe('Propagação e múltiplos falantes', () => {
  test('achado o vendedor, os demais ficam do outro lado da mesa', () => {
    const papeis = inferirPapeis([
      fala('Ana', 'Nossa solução integra com o que vocês já têm. Posso te mostrar.'),
      fala('João', 'A gente sofre com isso no dia a dia.'),
      fala('Beatriz', 'Pois é. O nosso time perde muito tempo aí.'),
    ]);

    assert.equal(ladoDe(papeis, 'Ana'), 'vendedor');
    assert.equal(ladoDe(papeis, 'João'), 'cliente');
    assert.equal(ladoDe(papeis, 'Beatriz'), 'cliente');
  });

  test('dois vendedores na call não transformam o cliente em vendedor', () => {
    const papeis = inferirPapeis([
      fala('Ana', 'Nossa solução cobre isso. Vou te mostrar.', 'Executiva de Contas'),
      fala('Tiago', 'Complementando: na implantação a gente entrega em fases.', 'Consultor'),
      fala('João', 'Entendi. A gente precisa resolver o fiscal primeiro.'),
    ]);

    assert.equal(ladoDe(papeis, 'Ana'), 'vendedor');
    assert.equal(ladoDe(papeis, 'Tiago'), 'vendedor');
    assert.equal(ladoDe(papeis, 'João'), 'cliente');
  });
});

describe('Confirmação humana', () => {
  test('papel fixado pelo humano vence qualquer sinal do motor', () => {
    const turnos = [
      fala('Ana', 'Nossa solução resolve isso. Posso te mostrar.'),
      fala('João', 'A gente precisa muito disso aqui.'),
    ];

    const semFixar = inferirPapeis(turnos);
    assert.equal(ladoDe(semFixar, 'Ana'), 'vendedor');

    const fixado = inferirPapeis(turnos, { papeisFixados: { ana: 'cliente', joão: 'vendedor' } });
    assert.equal(ladoDe(fixado, 'Ana'), 'cliente');
    assert.equal(ladoDe(fixado, 'João'), 'vendedor');
    assert.equal(fixado.find((p) => p.nome === 'Ana')?.confianca, 1);
  });
});

describe('Confiança e último recurso', () => {
  test('sinais concordantes dão mais confiança que um sinal sozinho', () => {
    const umSinal = inferirPapeis([
      fala('Ana', 'Nossa plataforma faz isso.'),
      fala('João', 'Certo.'),
    ]);

    const varios = inferirPapeis([
      fala('Ana', 'Nossa plataforma faz isso. Posso te mostrar? Como é hoje?', 'Executiva de Contas'),
      fala('João', 'A gente usa planilha. Vocês cobram por usuário?'),
    ]);

    const a = umSinal.find((p) => p.nome === 'Ana')?.confianca ?? 0;
    const b = varios.find((p) => p.nome === 'Ana')?.confianca ?? 0;
    assert.ok(b > a, `esperava confiança maior com mais sinais: ${b} > ${a}`);
  });

  test('sem nenhum sinal, decide por ordem de fala e diz que foi por isso', () => {
    const papeis = inferirPapeis([
      fala('P1', 'Bom dia.'),
      fala('P2', 'Bom dia.'),
      fala('P1', 'Vamos começar então.'),
      fala('P2', 'Vamos.'),
    ]);

    const p1 = papeis.find((p) => p.nome === 'P1');
    assert.equal(p1?.lado, 'vendedor');
    assert.ok(
      p1?.sinais.includes('ordem_de_fala'),
      'o último recurso precisa aparecer nos sinais, para a métrica saber contá-lo',
    );
    assert.ok((p1?.confianca ?? 1) <= 0.25, 'palpite de último recurso não pode parecer certeza');
  });
});
