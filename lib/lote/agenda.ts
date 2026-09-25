/**
 * Agenda do lote: quem roda, quando, e em quantas frentes.
 *
 * Três regras decidem tudo, e cada uma existe por um defeito concreto:
 *
 * 1. DOIS POOLS. Transcrever é caro, lento, limitado por cota do provedor e
 *    pesado de memória (o áudio é decodificado no navegador). Analisar é grátis
 *    e leva milissegundos. Numa fila única, a análise de uma reunião colada
 *    esperaria atrás de um áudio de uma hora.
 *
 * 2. UM CLIENTE DE CADA VEZ, EM ORDEM DE DATA. A ingestão carrega a memória da
 *    conta ANTES de analisar e recalcula o retrato dela DEPOIS. Duas reuniões
 *    do mesmo cliente em paralelo leriam a mesma memória — a de setembro não
 *    enxergaria a de agosto — e o cadastro do cliente novo seria criado duas
 *    vezes ao mesmo tempo. Clientes diferentes não compartilham nada e rodam em
 *    paralelo à vontade: é daí que vem a escala.
 *
 * 3. ERRO TEM TIPO. 429 e 5xx são transitórios: esperam (respeitando
 *    Retry-After) e tentam de novo, e a espera vale para a etapa inteira, para
 *    não martelar um provedor que já disse "devagar". Sessão expirada pausa o
 *    lote em vez de queimar cem falhas. Falta de configuração ("banco não
 *    configurado", "transcrição indisponível") encerra a etapa de uma vez, com
 *    a mesma mensagem em todas, em vez de repetir o mesmo erro cem vezes.
 */

export type Etapa = 'transcrever' | 'analisar';

export class ErroTransitorio extends Error {
  constructor(
    mensagem: string,
    readonly esperarMs?: number,
  ) {
    super(mensagem);
    this.name = 'ErroTransitorio';
  }
}

export class ErroSessao extends Error {
  constructor(mensagem = 'Sua sessão expirou.') {
    super(mensagem);
    this.name = 'ErroSessao';
  }
}

export class ErroFatal extends Error {
  constructor(
    mensagem: string,
    readonly etapa: Etapa,
  ) {
    super(mensagem);
    this.name = 'ErroFatal';
  }
}

export type Tarefa = {
  id: string;
  /** Chave do cliente. Tarefas do mesmo grupo nunca rodam juntas. Null = sem cliente. */
  grupo: string | null;
  /** Ordena dentro do grupo — data ISO seguida do título. */
  ordem: string;
  precisaTranscrever: boolean;
};

export type Estado =
  | { fase: 'fila' }
  | { fase: 'transcrevendo'; feitos: number; total: number }
  | { fase: 'aguardando'; motivo: string }
  | { fase: 'analisando' }
  | { fase: 'concluida'; meetingId: string; jaExistia: boolean }
  | { fase: 'erro'; mensagem: string; etapa: Etapa }
  | { fase: 'cancelada' };

export type Executores = {
  transcrever: (id: string, sinal: AbortSignal, progresso: (feitos: number, total: number) => void) => Promise<void>;
  analisar: (id: string, sinal: AbortSignal) => Promise<{ meetingId: string; jaExistia: boolean }>;
};

export type OpcoesAgenda = {
  tarefas: Tarefa[];
  executar: Executores;
  concorrencia?: { transcrever: number; analisar: number };
  tentativas?: number;
  /** Base do backoff exponencial, em ms. */
  esperaBaseMs?: number;
  aoMudar: (id: string, estado: Estado) => void;
  aoPausar?: (motivo: string) => void;
};

export type Resumo = { concluidas: number; jaExistiam: number; erros: number; canceladas: number; ms: number };

type Interno = Tarefa & {
  status: 'pendente' | 'transcrevendo' | 'pronta' | 'analisando' | 'fim';
  tentativas: number;
  naoAntesDe: number;
  controle: AbortController | null;
  fim?: Estado;
};

const terminal = (t: Interno) => t.status === 'fim';

export function criarAgenda(o: OpcoesAgenda) {
  const conc = o.concorrencia ?? { transcrever: 2, analisar: 6 };
  const maxTentativas = o.tentativas ?? 4;
  const base = o.esperaBaseMs ?? 1500;

  const tarefas: Interno[] = [...o.tarefas]
    .sort((a, b) => a.ordem.localeCompare(b.ordem))
    .map((t) => ({
      ...t,
      status: t.precisaTranscrever ? 'pendente' : 'pronta',
      tentativas: 0,
      naoAntesDe: 0,
      controle: null,
    }));

  const pausaAte: Record<Etapa, number> = { transcrever: 0, analisar: 0 };
  const fatal: Partial<Record<Etapa, string>> = {};
  let pausada = false;
  let cancelada = false;
  let despertador: ReturnType<typeof setTimeout> | null = null;
  let terminar: (() => void) | null = null;
  const inicio = Date.now();

  const mudar = (t: Interno, e: Estado) => o.aoMudar(t.id, e);

  function finalizar(t: Interno, e: Estado) {
    t.status = 'fim';
    t.fim = e;
    t.controle = null;
    mudar(t, e);
  }

  /** Há alguma tarefa anterior do mesmo cliente que ainda não terminou? */
  function bloqueadaPorAnterior(t: Interno): boolean {
    if (t.grupo === null) return false;
    for (const x of tarefas) {
      if (x === t) return false; // lista ordenada: daqui em diante são posteriores
      if (x.grupo === t.grupo && !terminal(x)) return true;
    }
    return false;
  }

  function agendarDespertar(ms: number) {
    if (despertador) clearTimeout(despertador);
    despertador = setTimeout(() => {
      despertador = null;
      bombear();
    }, Math.max(0, ms));
  }

  function falhar(t: Interno, etapa: Etapa, erro: unknown) {
    const statusDeRetorno = etapa === 'transcrever' ? 'pendente' : 'pronta';

    if (cancelada || (erro instanceof Error && erro.name === 'AbortError')) {
      return finalizar(t, { fase: 'cancelada' });
    }

    if (erro instanceof ErroSessao) {
      t.status = statusDeRetorno;
      mudar(t, { fase: 'aguardando', motivo: erro.message });
      if (!pausada) {
        pausada = true;
        o.aoPausar?.(erro.message);
      }
      return;
    }

    if (erro instanceof ErroFatal) {
      fatal[erro.etapa] = erro.message;
      finalizar(t, { fase: 'erro', mensagem: erro.message, etapa: erro.etapa });
      // Todo o resto que ainda depende da etapa quebrada falha com a mesma causa.
      for (const x of tarefas) {
        if (x.status === 'fim' || x.controle) continue;
        const dependeDaEtapa = erro.etapa === 'analisar' || x.status === 'pendente';
        if (dependeDaEtapa) finalizar(x, { fase: 'erro', mensagem: erro.message, etapa: erro.etapa });
      }
      return;
    }

    const mensagem = erro instanceof Error ? erro.message : String(erro);
    if (erro instanceof ErroTransitorio && t.tentativas + 1 < maxTentativas) {
      t.tentativas++;
      const exponencial = base * 2 ** (t.tentativas - 1);
      const espera = Math.max(erro.esperarMs ?? 0, exponencial * (0.75 + Math.random() * 0.5));
      t.naoAntesDe = Date.now() + espera;
      // Um 429 diz respeito ao provedor, não a esta reunião: a etapa inteira espera.
      if (erro.esperarMs) pausaAte[etapa] = Math.max(pausaAte[etapa], t.naoAntesDe);
      t.status = statusDeRetorno;
      mudar(t, {
        fase: 'aguardando',
        motivo: `${mensagem} — nova tentativa em ${Math.ceil(espera / 1000)} s (${t.tentativas + 1}/${maxTentativas}).`,
      });
      return;
    }

    finalizar(t, { fase: 'erro', mensagem, etapa });
  }

  function iniciarTranscricao(t: Interno) {
    t.status = 'transcrevendo';
    t.controle = new AbortController();
    mudar(t, { fase: 'transcrevendo', feitos: 0, total: 0 });
    o.executar
      .transcrever(t.id, t.controle.signal, (feitos, total) => {
        if (t.status === 'transcrevendo') mudar(t, { fase: 'transcrevendo', feitos, total });
      })
      .then(
        () => {
          t.controle = null;
          if (cancelada) return finalizar(t, { fase: 'cancelada' });
          t.status = 'pronta';
          t.tentativas = 0;
          t.naoAntesDe = 0;
          mudar(t, { fase: 'fila' });
        },
        (e) => {
          t.controle = null;
          falhar(t, 'transcrever', e);
        },
      )
      .finally(bombear);
  }

  function iniciarAnalise(t: Interno) {
    t.status = 'analisando';
    t.controle = new AbortController();
    mudar(t, { fase: 'analisando' });
    o.executar
      .analisar(t.id, t.controle.signal)
      .then(
        (r) => finalizar(t, { fase: 'concluida', meetingId: r.meetingId, jaExistia: r.jaExistia }),
        (e) => {
          t.controle = null;
          falhar(t, 'analisar', e);
        },
      )
      .finally(bombear);
  }

  function bombear() {
    if (tarefas.every(terminal)) {
      if (despertador) clearTimeout(despertador);
      terminar?.();
      return;
    }
    if (pausada || cancelada) return;

    const agora = Date.now();
    let proximoDespertar = Infinity;

    // Etapa com configuração faltando: o que ainda depende dela não tem como andar.
    for (const t of tarefas) {
      if (t.status === 'pendente' && fatal.transcrever) finalizar(t, { fase: 'erro', mensagem: fatal.transcrever, etapa: 'transcrever' });
      if (t.status === 'pronta' && fatal.analisar) finalizar(t, { fase: 'erro', mensagem: fatal.analisar, etapa: 'analisar' });
    }

    let transcrevendo = tarefas.filter((t) => t.status === 'transcrevendo').length;
    let analisando = tarefas.filter((t) => t.status === 'analisando').length;
    const gruposOcupados = new Set(tarefas.filter((t) => t.status === 'analisando' && t.grupo !== null).map((t) => t.grupo));

    for (const t of tarefas) {
      if (t.status === 'pendente' && transcrevendo < conc.transcrever) {
        const quando = Math.max(t.naoAntesDe, pausaAte.transcrever);
        if (quando > agora) proximoDespertar = Math.min(proximoDespertar, quando);
        else {
          transcrevendo++;
          iniciarTranscricao(t);
        }
      } else if (t.status === 'pronta' && analisando < conc.analisar) {
        if (t.grupo !== null && gruposOcupados.has(t.grupo)) continue;
        if (bloqueadaPorAnterior(t)) continue;
        const quando = Math.max(t.naoAntesDe, pausaAte.analisar);
        if (quando > agora) {
          proximoDespertar = Math.min(proximoDespertar, quando);
          continue;
        }
        analisando++;
        if (t.grupo !== null) gruposOcupados.add(t.grupo);
        iniciarAnalise(t);
      }
    }

    if (proximoDespertar !== Infinity) agendarDespertar(proximoDespertar - agora);
    if (tarefas.every(terminal)) terminar?.();
  }

  return {
    iniciar(): Promise<Resumo> {
      return new Promise<Resumo>((resolver) => {
        terminar = () => {
          terminar = null;
          const fins = tarefas.map((t) => t.fim);
          resolver({
            concluidas: fins.filter((f) => f?.fase === 'concluida').length,
            jaExistiam: fins.filter((f) => f?.fase === 'concluida' && f.jaExistia).length,
            erros: fins.filter((f) => f?.fase === 'erro').length,
            canceladas: fins.filter((f) => f?.fase === 'cancelada').length,
            ms: Date.now() - inicio,
          });
        };
        for (const t of tarefas) mudar(t, { fase: 'fila' });
        bombear();
      });
    },
    cancelar() {
      cancelada = true;
      if (despertador) clearTimeout(despertador);
      for (const t of tarefas) {
        if (t.status === 'fim') continue;
        if (t.controle) t.controle.abort();
        else finalizar(t, { fase: 'cancelada' });
      }
      bombear();
    },
    retomar() {
      if (!pausada) return;
      pausada = false;
      for (const t of tarefas) if (t.status === 'pendente' || t.status === 'pronta') mudar(t, { fase: 'fila' });
      bombear();
    },
  };
}
