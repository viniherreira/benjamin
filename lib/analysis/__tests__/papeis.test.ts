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

/*
 * Um marcador de lado só vale se um lado diz e o outro não. Expressão que os
 * dois usam não é dêixis, é ruído com sinal trocado — e custa caro, porque
 * anula os sinais corretos do mesmo falante e derruba o placar abaixo do
 * limiar, entregando a decisão ao último recurso.
 *
 * Os dois casos abaixo saíram da partição dev: em ambos a VENDEDORA estava
 * acumulando sinal de comprador.
 */
describe('Expressão que os dois lados dizem não marca lado', () => {
  test('"a gente tem" é o vendedor falando do próprio portfólio', () => {
    const papeis = inferirPapeis([
      fala('Ana', 'Sobre licenças, a gente tem pacote de expansão que já prevê crescimento.'),
      fala('Fernanda', 'Qual o investimento?'),
    ]);

    const ana = papeis.find((p) => p.nome === 'Ana');
    assert.ok(
      !ana?.sinais.includes('dexis_comprador'),
      `"a gente tem" não é marca de comprador — sinais vieram: ${JSON.stringify(ana?.sinais)}`,
    );
  });

  test('"o pessoal da produção" é o vendedor falando do time do cliente', () => {
    const papeis = inferirPapeis([
      fala('Ana', 'Consigo te propor uma conversa com o pessoal da produção pra entender o cenário deles?'),
      fala('Ricardo', 'Deixa eu ver como está a agenda deles.'),
    ]);

    const ana = papeis.find((p) => p.nome === 'Ana');
    assert.ok(
      !ana?.sinais.includes('dexis_comprador'),
      `quem fala "o pessoal da produção" costuma ser quem está de fora — sinais: ${JSON.stringify(ana?.sinais)}`,
    );
  });

  test('"vocês têm" é pergunta de descoberta, não marca de comprador', () => {
    const papeis = inferirPapeis([
      fala('Ana', 'E vocês têm quantas pessoas no fechamento hoje?'),
      fala('Marcos', 'Três, às vezes quatro.'),
    ]);

    const ana = papeis.find((p) => p.nome === 'Ana');
    assert.ok(
      !ana?.sinais.includes('trata_o_outro_como_fornecedor'),
      `numa call de descoberta quem pergunta "vocês têm" é o vendedor — sinais: ${JSON.stringify(ana?.sinais)}`,
    );
  });

  test('mas "vocês cobram" continua valendo: só o comprador pergunta preço', () => {
    const papeis = inferirPapeis([
      fala('Helena', 'Vocês cobram por usuário?'),
      fala('Bruno', 'Depende do módulo.'),
    ]);

    assert.equal(ladoDe(papeis, 'Helena'), 'cliente');
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

  /*
   * O último recurso é o palpite mais burro que o motor tem, e por muito tempo
   * ele foi também o mais arrogante: sobrescrevia o placar já acumulado só
   * porque o falante tinha aberto a reunião. Nas amostras em que o CLIENTE abre
   * — inbound, escalada, cotação que o comprador conduz — isso não produzia um
   * erro, produzia a inversão dos dois lados.
   *
   * Ordem de fala é desempate, não veredito.
   */
  test('quem abre com sinal de comprador não vira vendedor por ter falado primeiro', () => {
    const papeis = inferirPapeis([
      fala('Gilberto', 'Vocês cobram por usuário nomeado?'),
      fala('Ana', 'Por usuário nomeado.'),
      fala('Gilberto', 'Tem mínimo de contratação?'),
      fala('Ana', 'Tem, dez usuários.'),
    ]);

    assert.equal(ladoDe(papeis, 'Gilberto'), 'cliente');
    assert.equal(ladoDe(papeis, 'Ana'), 'vendedor');
  });

  test('turno longo de quem abre pesa mais que a ordem em que abriu', () => {
    const papeis = inferirPapeis([
      fala(
        'Otávio',
        'O faturamento parou na quinta-feira e ficamos dois dias sem emitir nota fiscal nenhuma, com caminhão carregado parado na doca esperando liberação.',
      ),
      fala('Carla', 'Eu vi o chamado.'),
      fala(
        'Otávio',
        'Esse é o terceiro incidente no semestre e sempre a mesma história, abre chamado, espera, e alguém liga depois que o estrago já aconteceu.',
      ),
      fala('Carla', 'Vou escalar hoje.'),
    ]);

    assert.equal(ladoDe(papeis, 'Otávio'), 'cliente');
    assert.equal(ladoDe(papeis, 'Carla'), 'vendedor');
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
