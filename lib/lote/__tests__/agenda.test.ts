import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarAgenda, ErroFatal, ErroSessao, ErroTransitorio, type Estado, type Tarefa } from '../agenda';

const dormir = (ms: number, sinal?: AbortSignal) =>
  new Promise<void>((ok, erro) => {
    const t = setTimeout(ok, ms);
    sinal?.addEventListener('abort', () => {
      clearTimeout(t);
      const e = new Error('abortado');
      e.name = 'AbortError';
      erro(e);
    });
  });

function tarefa(id: string, grupo: string | null, ordem: string, audio = false): Tarefa {
  return { id, grupo, ordem, precisaTranscrever: audio };
}

/** Mede concorrência real: quantas análises estavam em voo ao mesmo tempo. */
function sonda() {
  let emVoo = 0;
  let pico = 0;
  const porGrupo = new Map<string, number>();
  let picoGrupo = 0;
  const ordemDeInicio: string[] = [];
  return {
    ordemDeInicio,
    get pico() {
      return pico;
    },
    get picoGrupo() {
      return picoGrupo;
    },
    async rodar(id: string, grupo: string | null, ms: number, sinal?: AbortSignal) {
      emVoo++;
      pico = Math.max(pico, emVoo);
      ordemDeInicio.push(id);
      if (grupo) {
        porGrupo.set(grupo, (porGrupo.get(grupo) ?? 0) + 1);
        picoGrupo = Math.max(picoGrupo, porGrupo.get(grupo)!);
      }
      try {
        await dormir(ms, sinal);
      } finally {
        emVoo--;
        if (grupo) porGrupo.set(grupo, porGrupo.get(grupo)! - 1);
      }
    },
  };
}

test('100 reuniões de 20 clientes: paralelo entre clientes, uma por vez e em ordem de data dentro de cada um', async () => {
  const tarefas: Tarefa[] = [];
  for (let c = 0; c < 20; c++) {
    // datas embaralhadas de propósito
    for (const d of [4, 1, 5, 2, 3]) tarefas.push(tarefa(`c${c}-d${d}`, `cliente ${c}`, `2026-09-0${d}`));
  }
  const s = sonda();
  const grupoDe = new Map(tarefas.map((t) => [t.id, t.grupo]));
  const t0 = Date.now();

  const resumo = await criarAgenda({
    tarefas,
    concorrencia: { transcrever: 2, analisar: 8 },
    executar: {
      transcrever: async () => {},
      analisar: async (id) => {
        await s.rodar(id, grupoDe.get(id)!, 10);
        return { meetingId: `m-${id}`, jaExistia: false };
      },
    },
    aoMudar: () => {},
  }).iniciar();

  const ms = Date.now() - t0;
  assert.equal(resumo.concluidas, 100);
  assert.equal(s.picoGrupo, 1, 'nunca duas reuniões do mesmo cliente ao mesmo tempo');
  assert.equal(s.pico, 8, 'usa as 8 frentes');
  for (let c = 0; c < 20; c++) {
    const ordem = s.ordemDeInicio.filter((id) => id.startsWith(`c${c}-`));
    assert.deepEqual(ordem, [1, 2, 3, 4, 5].map((d) => `c${c}-d${d}`), `cliente ${c} em ordem de data`);
  }
  assert.ok(ms < 100 * 10 * 0.5, `paralelo de verdade: ${ms} ms contra 1000 ms em série`);
});

test('reuniões sem cliente não se bloqueiam entre si', async () => {
  const s = sonda();
  await criarAgenda({
    tarefas: Array.from({ length: 6 }, (_, i) => tarefa(`t${i}`, null, `${i}`)),
    concorrencia: { transcrever: 1, analisar: 6 },
    executar: { transcrever: async () => {}, analisar: async (id) => (await s.rodar(id, null, 15), { meetingId: id, jaExistia: false }) },
    aoMudar: () => {},
  }).iniciar();
  assert.equal(s.pico, 6);
});

test('áudio de agosto segura a reunião colada de setembro do mesmo cliente', async () => {
  const eventos: string[] = [];
  await criarAgenda({
    tarefas: [tarefa('set-texto', 'acme', '2026-09-01'), tarefa('ago-audio', 'acme', '2026-08-01', true)],
    executar: {
      transcrever: async (id) => {
        eventos.push(`transcreve ${id}`);
        await dormir(20);
      },
      analisar: async (id) => {
        eventos.push(`analisa ${id}`);
        return { meetingId: id, jaExistia: false };
      },
    },
    aoMudar: () => {},
  }).iniciar();
  assert.deepEqual(eventos, ['transcreve ago-audio', 'analisa ago-audio', 'analisa set-texto']);
});

test('erro transitório espera e tenta de novo; erro definitivo não', async () => {
  let chamadas = 0;
  const estados: Estado[] = [];
  const r = await criarAgenda({
    tarefas: [tarefa('instavel', null, '1'), tarefa('quebrada', null, '2')],
    esperaBaseMs: 5,
    executar: {
      transcrever: async () => {},
      analisar: async (id) => {
        if (id === 'quebrada') throw new Error('Transcrição precisa ter ao menos 20 caracteres.');
        if (++chamadas < 3) throw new ErroTransitorio('HTTP 503', 10);
        return { meetingId: 'ok', jaExistia: false };
      },
    },
    aoMudar: (_, e) => estados.push(e),
  }).iniciar();
  assert.equal(chamadas, 3);
  assert.deepEqual([r.concluidas, r.erros], [1, 1]);
  assert.ok(estados.some((e) => e.fase === 'aguardando' && /nova tentativa/.test(e.motivo)));
});

test('banco não configurado: falha tudo de uma vez, sem cem chamadas iguais', async () => {
  let chamadas = 0;
  const r = await criarAgenda({
    tarefas: Array.from({ length: 40 }, (_, i) => tarefa(`t${i}`, `c${i}`, `${i}`)),
    concorrencia: { transcrever: 1, analisar: 1 },
    executar: {
      transcrever: async () => {},
      analisar: async () => {
        chamadas++;
        throw new ErroFatal('Banco não configurado.', 'analisar');
      },
    },
    aoMudar: () => {},
  }).iniciar();
  assert.equal(chamadas, 1);
  assert.equal(r.erros, 40);
});

test('transcrição indisponível derruba só os áudios; o texto segue', async () => {
  const r = await criarAgenda({
    tarefas: [tarefa('a1', null, '1', true), tarefa('a2', null, '2', true), tarefa('txt', null, '3')],
    concorrencia: { transcrever: 1, analisar: 2 },
    executar: {
      transcrever: async () => {
        throw new ErroFatal('OPENAI_API_KEY não está configurada.', 'transcrever');
      },
      analisar: async (id) => ({ meetingId: id, jaExistia: false }),
    },
    aoMudar: () => {},
  }).iniciar();
  assert.deepEqual([r.concluidas, r.erros], [1, 2]);
});

test('sessão expirada pausa o lote; retomar continua de onde parou', async () => {
  let expirou = false;
  let pausas = 0;
  const agenda = criarAgenda({
    tarefas: [tarefa('a', null, '1'), tarefa('b', null, '2')],
    concorrencia: { transcrever: 1, analisar: 1 },
    executar: {
      transcrever: async () => {},
      analisar: async (id) => {
        if (id === 'a' && !expirou) {
          expirou = true;
          throw new ErroSessao();
        }
        return { meetingId: id, jaExistia: false };
      },
    },
    aoMudar: () => {},
    aoPausar: () => {
      pausas++;
      setTimeout(() => agenda.retomar(), 10);
    },
  });
  const r = await agenda.iniciar();
  assert.equal(pausas, 1);
  assert.equal(r.concluidas, 2);
});

test('cancelar interrompe o que está em voo e descarta a fila', async () => {
  const agenda = criarAgenda({
    tarefas: Array.from({ length: 10 }, (_, i) => tarefa(`t${i}`, null, `${i}`)),
    concorrencia: { transcrever: 1, analisar: 2 },
    executar: {
      transcrever: async () => {},
      analisar: async (id, sinal) => (await dormir(1000, sinal), { meetingId: id, jaExistia: false }),
    },
    aoMudar: () => {},
  });
  setTimeout(() => agenda.cancelar(), 20);
  const r = await agenda.iniciar();
  assert.equal(r.canceladas, 10);
  assert.ok(r.ms < 500);
});
