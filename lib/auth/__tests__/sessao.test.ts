import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { assinarSessao, verificarSessao, senhaConfere } from '../sessao';

/**
 * Sessão assinada.
 *
 * O produto guarda transcrição de conversa comercial com cliente identificado.
 * Até existir login por usuário, o mínimo é não deixar a aplicação aberta para
 * quem souber a URL — e um cookie de sessão só vale se for impossível forjar.
 *
 * A chave de assinatura deriva da própria senha: trocar a senha invalida toda
 * sessão emitida antes, que é o comportamento que se espera ao girar uma
 * credencial vazada.
 */

const SENHA = 'uma-senha-de-teste-bem-comprida';

describe('Token de sessão', () => {
  test('um token recém-assinado é aceito', async () => {
    const t = await assinarSessao(SENHA, 3600);
    assert.equal(await verificarSessao(t, SENHA), true);
  });

  test('token assinado com outra senha é recusado', async () => {
    const t = await assinarSessao(SENHA, 3600);
    assert.equal(await verificarSessao(t, 'outra-senha-qualquer-comprida'), false);
  });

  test('assinatura adulterada é recusada', async () => {
    const t = await assinarSessao(SENHA, 3600);
    const [exp, sig] = t.split('.');
    const trocado = `${exp}.${(sig ?? '').replace(/.$/, (c) => (c === 'a' ? 'b' : 'a'))}`;
    assert.equal(await verificarSessao(trocado, SENHA), false);
  });

  test('prazo adulterado é recusado — a validade está dentro da assinatura', async () => {
    const t = await assinarSessao(SENHA, 3600);
    const sig = t.split('.')[1];
    const futuro = `${Math.floor(Date.now() / 1000) + 999999}.${sig}`;
    assert.equal(await verificarSessao(futuro, SENHA), false);
  });

  test('token expirado é recusado', async () => {
    const t = await assinarSessao(SENHA, -10);
    assert.equal(await verificarSessao(t, SENHA), false);
  });

  test('lixo não derruba a verificação', async () => {
    for (const t of ['', '.', 'abc', 'a.b.c', '12345', '...']) {
      assert.equal(await verificarSessao(t, SENHA), false, `recusar ${JSON.stringify(t)}`);
    }
  });
});

describe('Conferência de senha', () => {
  test('aceita a senha certa e recusa a errada', () => {
    assert.equal(senhaConfere(SENHA, SENHA), true);
    assert.equal(senhaConfere('errada', SENHA), false);
  });

  test('comprimento diferente não confere, e não estoura', () => {
    assert.equal(senhaConfere('curta', SENHA), false);
    assert.equal(senhaConfere(`${SENHA}x`, SENHA), false);
    assert.equal(senhaConfere('', SENHA), false);
  });

  /*
   * Segredo ausente não pode virar "qualquer senha serve". O caso de uso é o
   * deploy que sobe sem a variável configurada: ali a resposta certa é negar
   * tudo, não abrir tudo.
   */
  test('sem segredo configurado, nada confere', () => {
    assert.equal(senhaConfere('', ''), false);
    assert.equal(senhaConfere('qualquer', ''), false);
    assert.equal(senhaConfere('qualquer', undefined), false);
  });
});
