import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { analisar } from '../index';

/**
 * Abstenção dos scores quando não dá para saber quem falou.
 *
 * O motor já se cala no lugar certo em quase tudo: sem marcação de falante,
 * `conversation_metrics` volta tudo `null` e a voz do cliente volta vazia. Os
 * dois números que o vendedor de fato lê — interesse e risco de churn — eram a
 * exceção, e a exceção mais cara.
 *
 * Numa transcrição de áudio sem diarização, "trocar de sistema" e "avaliar
 * outras soluções" aparecem no texto tanto quando o cliente AMEAÇA sair quanto
 * quando ele explica que NÃO quer sair. Sem saber quem disse o quê, e em que
 * direção, somar esses sinais não é estimar: é inventar. E inventar no teto da
 * escala, porque o churn satura em 100 com três sinais.
 *
 * A regra do projeto já estava escrita, só não valia aqui: extrair sem
 * diarização, sim; afirmar de quem é a fala, não.
 */

const DATA = '2026-09-11';

/*
 * Trecho no formato que sai de gravação de áudio: sem rótulo, sem pontuação de
 * turno, pergunta e resposta coladas. As frases de risco estão presentes, mas
 * ditas por quem está argumentando CONTRA a saída.
 */
const CORRIDO =
  'Então a gente tava conversando internamente porque o contrato vai ter aquela renovação ' +
  'daqui alguns meses né? Sim, a renovação está prevista para... Então é justamente isso, ' +
  'a gente quer avaliar algumas coisas antes de renovar. Entendi. Porque trocar tudo também ' +
  'não é uma decisão simples, tem muita coisa nossa já dentro do sistema, histórico, cadastro, ' +
  'integração, não é simplesmente tirar e colocar outro. Claro. Mas a diretoria pediu pra gente ' +
  'olhar alternativas também. E só pra deixar claro, não é que a gente já decidiu sair. Sim. ' +
  'Mas eu prefiro resolver com vocês se der. Trocar sistema agora seria um transtorno enorme. ' +
  'Tem uma integração, mas não está funcionando exatamente como queríamos. E tem o suporte ' +
  'também, às vezes a resposta demora.';

const COM_FALANTE =
  'Ana: Como vocês estão vendo a renovação?\n' +
  'Roberto: Olha, eu já tô revendo o contrato com o jurídico. A gente perdeu a paciência com o suporte.\n' +
  'Ana: Entendo. O que precisa acontecer?\n' +
  'Roberto: Meu diretor já pediu pra eu cotar com a Sankhya. A gente precisa de resposta em vinte e quatro horas.';

describe('Sem saber quem falou, os scores se abstêm', () => {
  test('risco de churn volta null em vez de 100', () => {
    const r = analisar({ texto: CORRIDO, dataReuniao: DATA });

    assert.equal(r.transcript_quality.has_diarization, false, 'pré-condição: o texto não tem rótulo');
    assert.equal(
      r.churn_risk,
      null,
      'três sinais não atribuíveis saturavam o churn em 100 numa conversa em que o cliente diz que prefere ficar',
    );
  });

  test('interesse volta null em vez de um número no chão', () => {
    const r = analisar({ texto: CORRIDO, dataReuniao: DATA });
    assert.equal(r.interest_score, null);
  });

  test('sem score, não sobra fator — a conta vazia não pode parecer conta zerada', () => {
    const r = analisar({ texto: CORRIDO, dataReuniao: DATA });
    assert.deepEqual(r.score_factors, []);
    assert.deepEqual(r.churn_factors, []);
  });

  test('o motor diz por que se absteve, em vez de só omitir', () => {
    const r = analisar({ texto: CORRIDO, dataReuniao: DATA });
    assert.ok(
      r.transcript_quality.warnings.some((w) => /interesse|churn|score/i.test(w)),
      `nenhum aviso explica a abstenção: ${JSON.stringify(r.transcript_quality.warnings)}`,
    );
  });

  test('abster-se não é deixar de extrair — dor e objeção continuam saindo', () => {
    const r = analisar({ texto: CORRIDO, dataReuniao: DATA });
    assert.ok(
      r.problems.length > 0,
      'a regra é não afirmar de quem é a fala, não parar de ler o texto',
    );
  });
});

describe('Com marcação de falante, nada muda', () => {
  test('os dois scores continuam saindo como número', () => {
    const r = analisar({ texto: COM_FALANTE, dataReuniao: DATA });

    assert.equal(typeof r.churn_risk, 'number');
    assert.equal(typeof r.interest_score, 'number');
    assert.ok((r.churn_risk ?? 0) > 0, 'aqui o risco é real e precisa aparecer');
  });

  test('a conta mostrada ao vendedor continua fechando', () => {
    const r = analisar({ texto: COM_FALANTE, dataReuniao: DATA });
    const soma = r.score_factors.reduce((s, f) => s + f.delta, 0);
    assert.equal(soma, r.interest_score);
  });
});
