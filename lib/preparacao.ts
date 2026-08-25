import type { AnalysisRow } from './supabase/database.types';
import type { Bant } from './analysis';
import type { ObjecaoRecorrente, VisaoCliente } from './memory';

/**
 * Briefing pré-reunião — spec 4.4.
 *
 * TypeScript puro: recebe a memória consolidada e devolve o que o vendedor
 * precisa saber nos 5 minutos antes da call, com recomendações priorizadas.
 *
 * Cada recomendação carrega o `porque` — o dado do histórico que a originou.
 * A regra do produto é a mesma do briefing: a IA propõe e mostra a base, o
 * humano decide. Recomendação sem lastro no histórico não é gerada.
 */

export type Recomendacao = {
  titulo: string;
  porque: string;
  /** Prioridade: 1 é o que deve abrir a conversa. */
  ordem: number;
};

export type Preparacao = {
  ultimaConversa: { data: string; dias: number; titulo: string } | null;
  principalNecessidade: { texto: string; mencoes: number } | null;
  principalObjecao: ObjecaoRecorrente | null;
  ultimaDecisao: { texto: string; data: string } | null;
  pendenciasNossas: { descricao: string; diasAtraso: number; prazo: string | null }[];
  pendenciasCliente: { descricao: string; diasAtraso: number; prazo: string | null }[];
  interesse: { atual: number; anterior: number | null; variacao: number | null } | null;
  confianca: { atual: number; rotulo: 'alta' | 'média' | 'baixa' } | null;
  bant: Bant | null;
  ameacas: { nome: string; mencoes: number }[];
  recomendacoes: Recomendacao[];
};

const rotuloConfianca = (n: number): 'alta' | 'média' | 'baixa' =>
  n >= 70 ? 'alta' : n >= 40 ? 'média' : 'baixa';

const parse = <T>(v: unknown, padrao: T): T => (v == null ? padrao : (v as T));

const ROTULO_BANT: Record<'budget' | 'authority' | 'need' | 'timeline', string> = {
  budget: 'Budget',
  authority: 'Authority',
  need: 'Need',
  timeline: 'Timeline',
};

/**
 * Cobertura BANT do CICLO, não da última reunião.
 *
 * O motor calcula BANT por reunião, e é isso que o briefing individual mostra.
 * Mas budget descoberto na terceira conversa não deixa de existir na quinta:
 * para preparar a próxima call, o que importa é o que já foi coberto em todo o
 * relacionamento. Por isso os quatro pilares são acumulados aqui.
 */
function bantDoCiclo(v: VisaoCliente): Bant | null {
  const acumulado = { budget: false, authority: false, need: false, timeline: false };
  let achou = false;

  for (const bruto of v.bantPorReuniao) {
    if (!bruto) continue;
    achou = true;
    acumulado.budget ||= bruto.budget;
    acumulado.authority ||= bruto.authority;
    acumulado.need ||= bruto.need;
    acumulado.timeline ||= bruto.timeline;
  }
  if (!achou) return null;

  const chaves = ['budget', 'authority', 'need', 'timeline'] as const;
  const score = chaves.filter((k) => acumulado[k]).length;
  const missing = chaves.filter((k) => !acumulado[k]).map((k) => ROTULO_BANT[k]);

  return { ...acumulado, score, missing };
}

/** Procura um tema no texto das necessidades, dores e decisões já registradas. */
function historicoMenciona(v: VisaoCliente, termos: RegExp): boolean {
  const corpus = [
    ...v.necessidades.map((n) => n.texto),
    ...v.objecoes.map((o) => o.texto),
    ...v.decisoes.map((d) => d.texto),
    ...v.tarefasAbertas.map((t) => t.descricao),
  ]
    .join(' ')
    .toLowerCase();
  return termos.test(corpus);
}

export function montarPreparacao(v: VisaoCliente): Preparacao {
  const ultima = v.ultimaReuniao;
  const analise = (ultima?.analise ?? null) as AnalysisRow | null;

  const bant = bantDoCiclo(v);

  const interesses = v.interesseHistorico;
  const interesse =
    interesses.length > 0
      ? {
          atual: interesses[interesses.length - 1] as number,
          anterior: interesses.length > 1 ? (interesses[interesses.length - 2] as number) : null,
          variacao:
            interesses.length > 1
              ? (interesses[interesses.length - 1] as number) - (interesses[interesses.length - 2] as number)
              : null,
        }
      : null;

  const confiancaAtual = v.confiancaHistorica.at(-1) ?? null;
  const confianca =
    confiancaAtual != null ? { atual: confiancaAtual, rotulo: rotuloConfianca(confiancaAtual) } : null;

  const objecoesAbertas = v.objecoes.filter((o) => !o.resolvida);
  const principalObjecao =
    [...objecoesAbertas].sort((a, b) => b.mencoes - a.mencoes)[0] ?? null;

  const pendenciasNossas = v.tarefasAbertas
    .filter((t) => t.lado === 'interno')
    .map((t) => ({ descricao: t.descricao, diasAtraso: t.diasAtraso, prazo: t.prazo }));
  const pendenciasCliente = v.tarefasAbertas
    .filter((t) => t.lado === 'cliente')
    .map((t) => ({ descricao: t.descricao, diasAtraso: t.diasAtraso, prazo: t.prazo }));

  const ameacas = v.concorrentes.filter((c) => c.ativo).map((c) => ({ nome: c.nome, mencoes: c.mencoes }));

  /* ---------------- Recomendações ---------------- */

  const recomendacoes: Recomendacao[] = [];
  let ordem = 1;
  const add = (titulo: string, porque: string) => {
    recomendacoes.push({ titulo, porque, ordem: ordem++ });
  };

  // 1. O bloqueio de autoridade vem primeiro: sem quem assina, o resto não anda.
  const objAutoridade = objecoesAbertas.find((o) => o.categoria === 'autoridade');
  const semDecisor = v.personaTopo?.decision_power !== 'decisor';
  if (objAutoridade) {
    add(
      'Abra pela aprovação de quem decide — é o bloqueio real, não o preço.',
      `Objeção de autoridade em aberto, citada em ${objAutoridade.mencoes} reunião(ões): "${objAutoridade.texto}"`,
    );
  } else if (semDecisor && v.interesseHistorico.length >= 2) {
    add(
      'Traga quem assina para a próxima conversa.',
      'Nenhuma das reuniões do ciclo contou com um decisor — é o fator que mais pesa contra o health score.',
    );
  }

  // 2. Compromisso nosso atrasado destrói credibilidade — resolver antes da call.
  const atrasadaNossa = pendenciasNossas
    .filter((t) => t.diasAtraso > 0)
    .sort((a, b) => b.diasAtraso - a.diasAtraso)[0];
  if (atrasadaNossa) {
    add(
      `Entregue "${atrasadaNossa.descricao}" antes da call.`,
      `Compromisso nosso atrasado há ${atrasadaNossa.diasAtraso} dia(s). Cobrar avanço com pendência nossa em aberto custa credibilidade.`,
    );
  }

  // 3. Desconfiança técnica não se resolve com slide.
  const objTecnica = objecoesAbertas.find((o) => o.categoria === 'tecnica');
  if (objTecnica) {
    add(
      'Demonstre a integração ao vivo, com dados reais.',
      `Objeção técnica nunca foi resolvida (${objTecnica.mencoes} menção(ões)): "${objTecnica.texto}"`,
    );
  }

  // 4. Preço recorrente é sintoma: o eixo da conversa precisa mudar para valor.
  const objPreco = objecoesAbertas.find((o) => o.categoria === 'preco');
  if (objPreco && objPreco.mencoes >= 2) {
    add(
      'Mude o eixo de preço para retorno: leve o cálculo de payback pronto.',
      `Preço voltou em ${objPreco.mencoes} reuniões e segue em aberto. Repetir desconto sem mudar o enquadramento não encerrou o assunto até agora.`,
    );
  } else if (objPreco) {
    add(
      'Enderece a objeção de preço com escopo, não só com desconto.',
      `Preço apareceu na última conversa: "${objPreco.texto}"`,
    );
  }

  // 5. ROI só entra se o histórico mostrar que alguém cobra ROI.
  if (historicoMenciona(v, /\broi\b|payback|retorno|cfo|financeiro/)) {
    add(
      'Leve o ROI fechado, com a conta aberta para auditoria.',
      'O histórico registra cobrança de ROI/CFO. Número redondo sem memória de cálculo não passa por área financeira.',
    );
  }

  // 6. Concorrente ativo precisa ser endereçado de frente.
  if (ameacas.length > 0) {
    const a = ameacas[0]!;
    add(
      `Enderece ${a.nome} comparando escopo e integração, não só preço de lista.`,
      `${a.nome} aparece em ${a.mencoes} reunião(ões) como avaliação ativa.`,
    );
  }

  // 7. BANT incompleto: cobre o que falta.
  if (bant && bant.missing.length > 0) {
    const faltando = bant.missing.join(', ');
    add(
      `Feche a lacuna de BANT: falta ${faltando}.`,
      `Cobertura ${bant.score}/4 somando todas as reuniões do ciclo. Ciclo longo sem ${faltando.toLowerCase()} costuma travar na aprovação.`,
    );
  }

  // 8. Última reunião sem próximo passo.
  if (analise) {
    const proximos = parse<{ text: string }[]>(analise.next_steps, []);
    if (proximos.length === 0) {
      add(
        'Saia da call com data marcada — a anterior terminou sem compromisso.',
        'A última reunião não registrou próximo passo, o que já derrubou o interesse projetado.',
      );
    }
  }

  // 9. Interesse em queda.
  if (interesse?.variacao != null && interesse.variacao < 0) {
    add(
      'Reabra a conversa perguntando o que mudou desde a última reunião.',
      `O interesse caiu ${Math.abs(interesse.variacao)} pontos (de ${interesse.anterior} para ${interesse.atual}).`,
    );
  }

  return {
    ultimaConversa: ultima
      ? {
          data: ultima.meeting_date,
          dias: v.diasDesdeUltimoContato ?? 0,
          titulo: ultima.title,
        }
      : null,
    principalNecessidade: v.necessidades[0]
      ? { texto: v.necessidades[0].texto, mencoes: v.necessidades[0].mencoes }
      : null,
    principalObjecao,
    ultimaDecisao: v.decisoes.length > 0 ? (v.decisoes[v.decisoes.length - 1] as { texto: string; data: string }) : null,
    pendenciasNossas,
    pendenciasCliente,
    interesse,
    confianca,
    bant,
    ameacas,
    recomendacoes,
  };
}

/* ------------------------------------------------------------------ *
 * Versão em texto — para copiar e colar no CRM ou no WhatsApp
 * ------------------------------------------------------------------ */

const fmtData = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR');

export function preparacaoEmTexto(nomeCliente: string, p: Preparacao): string {
  const L: string[] = [];
  L.push(`${nomeCliente} — Briefing pré-reunião`);
  L.push('');

  if (p.ultimaConversa) {
    L.push(
      `Última conversa: ${fmtData(p.ultimaConversa.data)} (há ${p.ultimaConversa.dias} dia(s)) — ${p.ultimaConversa.titulo}`,
    );
  } else {
    L.push('Última conversa: nenhuma reunião analisada ainda.');
  }

  if (p.principalNecessidade) {
    L.push(
      `Principal necessidade: ${p.principalNecessidade.texto} (${p.principalNecessidade.mencoes}x)`,
    );
  }
  if (p.principalObjecao) {
    L.push(
      `Principal objeção: ${p.principalObjecao.categoria} — ${p.principalObjecao.mencoes} menção(ões), ${
        p.principalObjecao.resolvida ? 'endereçada' : 'não endereçada'
      }`,
    );
  }
  if (p.ultimaDecisao) {
    L.push(`Última decisão: ${p.ultimaDecisao.texto} (${fmtData(p.ultimaDecisao.data)})`);
  }

  for (const t of p.pendenciasNossas) {
    L.push(`Pendência nossa: ${t.descricao}${t.diasAtraso > 0 ? `  [atrasada há ${t.diasAtraso}d]` : ''}`);
  }
  for (const t of p.pendenciasCliente) {
    L.push(`Pendência do cliente: ${t.descricao}${t.diasAtraso > 0 ? `  [atrasada há ${t.diasAtraso}d]` : ''}`);
  }

  if (p.interesse) {
    const seta = p.interesse.variacao == null ? '' : p.interesse.variacao > 0 ? ' ↑' : p.interesse.variacao < 0 ? ' ↓' : ' →';
    const antes = p.interesse.anterior != null ? ` (era ${p.interesse.anterior})` : '';
    L.push(`Interesse: ${p.interesse.atual}${seta}${antes}`);
  }
  if (p.confianca) {
    L.push(`Confiança no vendedor: ${p.confianca.rotulo} (${p.confianca.atual})`);
  }
  if (p.bant) {
    L.push(
      `Cobertura BANT do ciclo: ${p.bant.score}/4${p.bant.missing.length > 0 ? ` — falta ${p.bant.missing.join(', ')}` : ''}`,
    );
  }
  for (const a of p.ameacas) {
    L.push(`Ameaça ativa: ${a.nome} (mencionada ${a.mencoes}x)`);
  }

  if (p.recomendacoes.length > 0) {
    L.push('');
    L.push('Recomendações');
    for (const r of p.recomendacoes) {
      L.push(`${r.ordem}. ${r.titulo}`);
      L.push(`   Por quê: ${r.porque}`);
    }
  }

  L.push('');
  L.push('Gerado pelo InsightIQ a partir do histórico analisado da conta.');
  return L.join('\n');
}
