/**
 * INVARIANTE DE EVIDÊNCIA.
 *
 * "Toda extração carrega evidência" é a promessa central do produto e o que
 * convence a banca de que o briefing não foi inventado. Aqui ela deixa de ser
 * afirmação de slide e vira asserção que quebra o build.
 *
 * Para todo item de toda análise:
 *     textoSeguro.slice(evidence.start, evidence.end) === evidence.quote
 *
 * O teste varre o resultado inteiro por reflexão, então qualquer campo novo
 * criado no futuro entra na verificação sozinho.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analisar, preparar, EXEMPLO_CANONICO } from '../index';
import type { Evidence } from '../types';

const AMOSTRAS: { nome: string; texto: string }[] = [
  { nome: 'exemplo canônico TOTVS', texto: EXEMPLO_CANONICO },
  {
    nome: 'reunião diarizada com concorrente e budget',
    texto:
      'Ana Torres: Bom dia, João. Como está o projeto da folha?\n' +
      'João Silva: Olha, tá difícil. A gente usava SAP na empresa anterior e aqui o RH sofre com a folha manual.\n' +
      'Ana Torres: Entendi. E vocês já avaliaram o RM?\n' +
      'João Silva: Vimos uma demo da Senior semana passada e o pessoal gostou. Mas prefiro consolidar tudo na TOTVS.\n' +
      'Ana Torres: Posso te mostrar a integração ao vivo. Fico de mandar a proposta até sexta.\n' +
      'João Silva: Fecha. O orçamento é de uns R$ 80 mil, mas não comente com o meu CFO ainda.',
  },
  {
    nome: 'transcrição suja com timestamp e inaudível',
    texto:
      '[00:12:04] Ana: Então, o suporte tem demorado muito?\n' +
      '[00:12:11] João: Demais. Abrimos chamado [inaudível] e ficou três semanas sem resposta.\n' +
      '[00:12:30] João: A gente tá revendo o contrato, sinceramente. Meu telefone é (11) 98765-4321.',
  },
  {
    nome: 'texto sem pontuação nem falante',
    texto:
      'a gente precisa muito resolver o estoque porque o inventário vive errado e o pessoal digita tudo de novo na planilha',
  },
  { nome: 'texto vazio', texto: '' },
];

/** Coleta toda Evidence de qualquer profundidade do objeto. */
function coletarEvidencias(valor: unknown, caminho = '', achadas: { ev: Evidence; caminho: string }[] = []) {
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => coletarEvidencias(v, `${caminho}[${i}]`, achadas));
    return achadas;
  }

  if (valor && typeof valor === 'object') {
    const o = valor as Record<string, unknown>;
    if (typeof o.quote === 'string' && typeof o.start === 'number' && typeof o.end === 'number') {
      achadas.push({ ev: o as unknown as Evidence, caminho });
    }
    for (const [k, v] of Object.entries(o)) {
      coletarEvidencias(v, caminho ? `${caminho}.${k}` : k, achadas);
    }
  }

  return achadas;
}

describe('Invariante de evidência', () => {
  for (const amostra of AMOSTRAS) {
    test(`${amostra.nome}: toda citação bate com o texto na posição informada`, () => {
      const prep = preparar(amostra.texto);
      const r = analisar({ texto: amostra.texto, dataReuniao: '2026-08-14' });
      const evidencias = coletarEvidencias(r);

      for (const { ev, caminho } of evidencias) {
        assert.ok(ev.start >= 0, `${caminho}: start negativo`);
        assert.ok(ev.end <= prep.textoSeguro.length, `${caminho}: end além do fim do texto`);
        assert.ok(ev.start < ev.end, `${caminho}: intervalo vazio ou invertido`);
        assert.equal(
          prep.textoSeguro.slice(ev.start, ev.end),
          ev.quote,
          `${caminho}: a citação não corresponde ao trecho [${ev.start}, ${ev.end}] do texto`,
        );
      }
    });
  }

  test('a anonimização preserva o comprimento do texto', () => {
    const bruto =
      'CPF 123.456.789-00, CNPJ 12.345.678/0001-99, e-mail teste@dominio.com.br e telefone (11) 91234-5678.';
    const prep = preparar(bruto);

    assert.equal(prep.textoSeguro.length, bruto.length, 'mascarar não pode mover nenhum offset');
    assert.equal(prep.textoBusca.length, bruto.length, 'a dobra de acentos também preserva o tamanho');
    assert.equal(prep.redacoes.length, 4);
    assert.ok(!prep.textoSeguro.includes('123.456.789-00'), 'o CPF não pode sobreviver no texto');
    assert.ok(!prep.textoSeguro.includes('teste@dominio.com.br'), 'o e-mail não pode sobreviver');
  });

  /*
   * A invariante ganhou um segundo braço quando os scores passaram a poder se
   * abster. Sem ele, "conta vazia" e "conta que soma zero" ficariam
   * indistinguíveis na tela — que é justamente o que a abstenção existe para
   * evitar.
   */
  test('ou a soma dos fatores é o interest score, ou não há score nem fator', () => {
    for (const amostra of AMOSTRAS) {
      const r = analisar({ texto: amostra.texto, dataReuniao: '2026-08-14' });

      if (r.interest_score === null) {
        assert.deepEqual(
          r.score_factors,
          [],
          `${amostra.nome}: score abstido não pode vir acompanhado de fatores`,
        );
        assert.deepEqual(r.churn_factors, []);
        assert.equal(r.churn_risk, null, `${amostra.nome}: os dois scores se abstêm juntos`);
        continue;
      }

      const soma = r.score_factors.reduce((s, f) => s + f.delta, 0);
      assert.equal(
        soma,
        r.interest_score,
        `${amostra.nome}: a conta mostrada ao vendedor não fecha (${soma} ≠ ${r.interest_score})`,
      );
    }
  });
});
