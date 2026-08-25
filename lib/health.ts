/**
 * Health score do cliente — spec 7.8.
 *
 * TypeScript puro, sem I/O: recebe os agregados do histórico e devolve o score
 * com os fatores que o explicam. A regra 10.5 proíbe score sem explicação, então
 * a soma dos `factors` bate EXATAMENTE com o `score` exibido.
 *
 * Composição: interesse da última reunião (30%), tendência nas últimas 3 (15%),
 * recência do contato (15%), objeções abertas vs. resolvidas (15%), tarefas
 * concluídas vs. atrasadas (15%) e presença de decisor no ciclo (10%).
 *
 * Cliente novo não tem histórico para todos os componentes. Em vez de zerar o
 * que falta — o que faria toda conta nova parecer doente —, o peso é
 * renormalizado entre os componentes disponíveis, como já é feito no churn.
 */

export type FatorHealth = {
  label: string;
  /** Contribuição em pontos do score final. A soma dos deltas é o score. */
  delta: number;
  detalhe?: string;
};

export type BandaHealth = 'alto' | 'medio' | 'baixo';

export type ResultadoHealth = {
  score: number;
  band: BandaHealth;
  factors: FatorHealth[];
};

export type EntradaHealth = {
  /** Interesse da reunião mais recente (0–100). null quando não há reunião. */
  interesseUltima: number | null;
  /** Interesse de todas as reuniões, da mais antiga para a mais nova. */
  interesseHistorico: number[];
  /** Dias desde o último contato. null quando nunca houve reunião. */
  diasDesdeUltimoContato: number | null;
  objecoesAbertas: number;
  objecoesResolvidas: number;
  tarefasConcluidas: number;
  tarefasAtrasadas: number;
  /** Um decisor apareceu em alguma reunião do ciclo? */
  temDecisorNoCiclo: boolean;
  /** Houve pelo menos uma reunião analisada. */
  temHistorico: boolean;
};

const limitar = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function bandaHealth(score: number): BandaHealth {
  if (score >= 67) return 'alto';
  if (score >= 34) return 'medio';
  return 'baixo';
}

type Componente = { label: string; peso: number; valor: number; detalhe?: string };

export function calcularHealth(e: EntradaHealth): ResultadoHealth {
  // Sem nenhuma reunião não há o que medir. Dizer "50, neutro" seria inventar.
  if (!e.temHistorico) {
    return {
      score: 50,
      band: 'medio',
      factors: [
        {
          label: 'Sem reuniões analisadas',
          delta: 50,
          detalhe: 'O health score começa neutro e passa a ser calculado na primeira análise.',
        },
      ],
    };
  }

  const componentes: Componente[] = [];

  if (e.interesseUltima !== null) {
    componentes.push({
      label: 'Interesse na última reunião',
      peso: 0.3,
      valor: limitar(e.interesseUltima, 0, 100),
      detalhe: `${e.interesseUltima}/100 na conversa mais recente`,
    });
  }

  // Tendência: compara a mais nova com a primeira das últimas três.
  if (e.interesseHistorico.length >= 2) {
    const ultimos = e.interesseHistorico.slice(-3);
    const primeiro = ultimos[0] as number;
    const ultimo = ultimos[ultimos.length - 1] as number;
    const variacao = ultimo - primeiro;
    // −50 pontos de queda vira 0; +50 de alta vira 100; estável fica em 50.
    const valor = limitar(50 + variacao, 0, 100);
    componentes.push({
      label: 'Tendência do interesse',
      peso: 0.15,
      valor,
      detalhe:
        variacao > 0
          ? `subiu ${variacao} pontos nas últimas ${ultimos.length} reuniões`
          : variacao < 0
            ? `caiu ${Math.abs(variacao)} pontos nas últimas ${ultimos.length} reuniões`
            : 'estável nas últimas reuniões',
    });
  }

  if (e.diasDesdeUltimoContato !== null) {
    // Até 15 dias é contato quente; a partir de 90 dias a conta esfriou.
    const d = e.diasDesdeUltimoContato;
    const valor = d <= 15 ? 100 : d >= 90 ? 0 : Math.round(100 - ((d - 15) / 75) * 100);
    componentes.push({
      label: 'Recência do contato',
      peso: 0.15,
      valor: limitar(valor, 0, 100),
      detalhe: d === 0 ? 'contato hoje' : `último contato há ${d} dia(s)`,
    });
  }

  const totalObj = e.objecoesAbertas + e.objecoesResolvidas;
  if (totalObj > 0) {
    const valor = Math.round((e.objecoesResolvidas / totalObj) * 100);
    componentes.push({
      label: 'Objeções endereçadas',
      peso: 0.15,
      valor,
      detalhe: `${e.objecoesResolvidas} de ${totalObj} resolvida(s); ${e.objecoesAbertas} em aberto`,
    });
  }

  const totalTarefas = e.tarefasConcluidas + e.tarefasAtrasadas;
  if (totalTarefas > 0) {
    const valor = Math.round((e.tarefasConcluidas / totalTarefas) * 100);
    componentes.push({
      label: 'Compromissos cumpridos',
      peso: 0.15,
      valor,
      detalhe: `${e.tarefasConcluidas} concluída(s), ${e.tarefasAtrasadas} atrasada(s)`,
    });
  }

  componentes.push({
    label: e.temDecisorNoCiclo ? 'Decisor presente no ciclo' : 'Decisor ausente do ciclo',
    peso: 0.1,
    valor: e.temDecisorNoCiclo ? 100 : 25,
    detalhe: e.temDecisorNoCiclo
      ? 'quem decide já participou de uma reunião'
      : 'nenhuma reunião contou com quem assina',
  });

  const pesoTotal = componentes.reduce((s, c) => s + c.peso, 0);
  const bruto = pesoTotal > 0 ? componentes.reduce((s, c) => s + c.valor * c.peso, 0) / pesoTotal : 50;
  const score = Math.round(limitar(bruto, 0, 100));

  // Contribuição de cada componente em pontos do score final.
  const cru = componentes.map((c) => ({
    label: c.label,
    detalhe: c.detalhe,
    exato: (c.valor * c.peso) / pesoTotal,
  }));

  const factors: FatorHealth[] = cru.map((c) => ({
    label: c.label,
    delta: Math.round(c.exato),
    ...(c.detalhe ? { detalhe: c.detalhe } : {}),
  }));

  // Arredondar item a item pode não somar o score. A diferença é absorvida pelo
  // maior componente, para a conta exibida fechar exatamente.
  const somaFatores = factors.reduce((s, f) => s + f.delta, 0);
  const sobra = score - somaFatores;
  if (sobra !== 0 && factors.length > 0) {
    let maior = 0;
    for (let i = 1; i < factors.length; i++) {
      if ((factors[i] as FatorHealth).delta > (factors[maior] as FatorHealth).delta) maior = i;
    }
    (factors[maior] as FatorHealth).delta += sobra;
  }

  return { score, band: bandaHealth(score), factors };
}
