import type {
  Budget,
  Concorrente,
  Decisao,
  Necessidade,
  Objecao,
  Oportunidade,
  Persona,
  Problema,
  ProdutoTotvs,
  ProximoPasso,
  Risco,
  SinalPontuado,
  Tarefa,
  VozDoCliente,
} from '../types';
import type { Preparado } from './segment';
import { pontuarTrecho } from './sentiment';
import type { EntradaProduto } from './lexicons';
import {
  ASPECTOS,
  CARGOS,
  CATEGORIAS_DOR,
  CONCORRENTES,
  CONTEXTO_CONCORRENTE_ATIVO,
  CONTEXTO_CONCORRENTE_HISTORICO,
  GATILHOS_COMPRA,
  OBJECOES,
  PRODUTOS,
  SINAIS_CHURN,
  SINAIS_CROSS_BU,
  SUPERIOR_ACIMA,
  VOZ_DUVIDA_JORNADA,
  VOZ_ELOGIO,
  VOZ_LEGADO,
  VOZ_RECLAMACAO,
} from './lexicons';
import {
  algumPadrao,
  casar,
  contextoBusca,
  dedupPorEvidencia,
  ehFalaDoCliente,
  evidenciaEm,
  janelaBusca,
  limitar,
} from './util';

/* ================================================================== *
 * Produtos TOTVS
 * ================================================================== */

/*
 * Posse precisa ser ADJACENTE ao produto, não estar solta na vizinhança.
 * "O RH é o nosso ponto cego. A folha é feita na mão" tem um "nosso" a 27
 * caracteres da palavra "folha" — e a folha justamente NÃO é deles.
 * Por isso estes padrões são ancorados no fim do trecho anterior à menção.
 */
const POSSE_ANTES = [
  '(?:o|a|os|as)?\\s*(?:nosso|nossa|nossos|nossas)\\s+',
  '(?:a gente|nos)\\s+(?:usa|usamos|tem|temos|roda|rodamos)\\s+(?:o|a|os|as)?\\s*',
  '(?:usamos|utilizamos|rodamos|implantamos|temos|contratamos)\\s+(?:o|a|os|as)?\\s*',
  'ja\\s+(?:temos|usamos|rodamos)\\s+(?:o|a)?\\s*',
  // O vendedor descrevendo a base do cliente também é evidência de uso.
  'voces?\\s+(?:estao com|usam|tem|têm|rodam|usa|roda)\\s+(?:o|a|os|as)?\\s*',
];

/** Confirmação de uso que vem DEPOIS do nome do produto. */
const POSSE_DEPOIS = [
  '\\s+(?:esta|ta)\\s+(?:atendendo|rodando|instalado)',
  '\\s+que\\s+(?:a gente|nos)\\s+(?:usa|usamos|roda)',
  '\\s+atende\\s+(?:o|a|bem|nosso)',
  '\\s+(?:ja\\s+)?roda\\s+(?:aqui|na empresa|ha)',
];

const NEGA_POSSE = [
  'nem chegou a usar',
  'nao chegou a usar',
  'nunca (?:usamos|usei|usou|chegamos a usar)',
  'nao (?:usamos|uso|usa)',
  'nao chegamos a',
  'nao temos',
];

const AVALIANDO = ['avaliando', 'analisando', 'conhecendo', 'testando', 'em piloto', 'vendo o'];

const OPORTUNIDADE_CTX = [
  '\\bse\\b',
  'talvez',
  'poderia',
  'quero',
  'queria',
  'gostaria',
  'precisamos d[eo]',
  'preciso d[eo]',
  'penso em',
  'pensando em',
  'consolidar',
  'modulo de',
  'seria bom',
  'faz sentido',
];

const DOR_CTX = [
  'manual',
  'sofrendo',
  'sofre',
  'problema',
  'dificuldade',
  'retrabalho',
  'planilha',
  'nao temos',
  'falta',
];

/** Condicional fraco: rebaixa a probabilidade da oportunidade. */
const CONDICIONAL_FRACO = [
  'se um dia',
  'talvez',
  'quem sabe',
  'no futuro',
  'mais (?:pra|para) frente',
  'se a gente crescer',
  'eventualmente',
  'algum dia',
];

export function extrairProdutos(prep: Preparado): ProdutoTotvs[] {
  const achados: ProdutoTotvs[] = [];

  /*
   * Supressão de sobreposição: "RD Station Marketing" casa com três padrões —
   * o do produto completo, o do CRM e o genérico "RD Station". Sem isto, uma
   * menção virava três produtos no briefing. Vence sempre o casamento mais
   * longo; os contidos nele são descartados.
   */
  const brutos: { p: EntradaProduto; c: { inicio: number; fim: number } }[] = [];
  for (const p of PRODUTOS) {
    for (const c of casar(prep, p.padrao)) brutos.push({ p, c });
  }
  brutos.sort((a, b) => b.c.fim - b.c.inicio - (a.c.fim - a.c.inicio));

  const aceitos: typeof brutos = [];
  for (const b of brutos) {
    const contido = aceitos.some((a) => b.c.inicio >= a.c.inicio && b.c.fim <= a.c.fim);
    if (!contido) aceitos.push(b);
  }

  for (const { p, c } of aceitos) {
    {
      const ctx = contextoBusca(prep, c.inicio);

      const antes = janelaBusca(prep, c.inicio, 40, 0);
      const depois = prep.textoBusca.slice(c.fim, Math.min(prep.textoBusca.length, c.fim + 40));
      const negacao = janelaBusca(prep, c.inicio, 60, (c.fim - c.inicio) + 60);

      /*
       * "nossa área de Techfin" dito pelo VENDEDOR é o portfólio dele, não a
       * base do cliente. Posse com pronome de primeira pessoa só vale quando
       * quem fala é o cliente.
       */
      const primeiraPessoa = POSSE_ANTES.slice(0, 4).some((p) => new RegExp(`${p}$`, 'u').test(antes));
      const vendedorDescreveBase = new RegExp(`${POSSE_ANTES[4]}$`, 'u').test(antes);
      const posseAntes =
        (primeiraPessoa && ehFalaDoCliente(prep, c.inicio)) || vendedorDescreveBase;
      const posseDepois = POSSE_DEPOIS.some((p) => new RegExp(`^${p}`, 'u').test(depois));

      /*
       * O status, ao contrário da posse, precisa de contexto LARGO: em
       * "a gente precisa resolver isso esse ano" / "existe sim, é a linha RM",
       * a intenção mora no turno anterior. Uma sentença só não alcança.
       */
      const largo = janelaBusca(prep, c.inicio, 220, (c.fim - c.inicio) + 220);

      let status: ProdutoTotvs['status'] = 'mencionado';
      let confianca = 0.6;

      if (algumPadrao(negacao, NEGA_POSSE)) {
        status = 'mencionado';
        confianca = 0.8;
      } else if (posseAntes || posseDepois) {
        status = 'em_uso';
        confianca = 0.9;
      } else if (algumPadrao(ctx, AVALIANDO) || algumPadrao(largo, AVALIANDO)) {
        status = 'avaliando';
        confianca = 0.75;
      } else if (algumPadrao(ctx, OPORTUNIDADE_CTX) || algumPadrao(largo, OPORTUNIDADE_CTX)) {
        status = 'oportunidade';
        confianca = 0.75;
      } else if (algumPadrao(largo, DOR_CTX)) {
        // Dor no tema do produto sem posse: o cliente precisa e ainda não tem.
        status = 'oportunidade';
        confianca = 0.7;
      }

      achados.push({
        name: p.nome,
        unit: p.unidade,
        status,
        confidence: confianca,
        evidence: evidenciaEm(prep, c.inicio, c.fim),
      });
    }
  }

  // Um produto pode aparecer várias vezes; fica o status mais forte.
  const ordem: Record<ProdutoTotvs['status'], number> = {
    em_uso: 4,
    avaliando: 3,
    oportunidade: 2,
    mencionado: 1,
  };

  const porNome = new Map<string, ProdutoTotvs>();
  for (const a of achados) {
    const atual = porNome.get(a.name);
    if (!atual || ordem[a.status] > ordem[atual.status]) porNome.set(a.name, a);
  }

  return [...porNome.values()];
}

/** Necessidades de outra unidade de negócio faladas sem citar produto (Cross-BU). */
export function extrairCrossBu(prep: Preparado): ProdutoTotvs[] {
  const saida: ProdutoTotvs[] = [];

  for (const grupo of SINAIS_CROSS_BU) {
    for (const padrao of grupo.padroes) {
      const cs = casar(prep, padrao);
      if (cs.length === 0) continue;
      const c = cs[0] as { inicio: number; fim: number };
      saida.push({
        name: grupo.produto,
        unit: grupo.unidade,
        status: 'oportunidade',
        confidence: 0.65,
        evidence: evidenciaEm(prep, c.inicio, c.fim),
      });
      break;
    }
  }

  return saida;
}

/* ================================================================== *
 * Concorrentes
 * ================================================================== */

export function extrairConcorrentes(prep: Preparado): Concorrente[] {
  const saida: Concorrente[] = [];

  for (const conc of CONCORRENTES) {
    for (const c of casar(prep, conc.padrao)) {
      const ctx = contextoBusca(prep, c.inicio);
      const historico = algumPadrao(ctx, CONTEXTO_CONCORRENTE_HISTORICO);
      const ativoExplicito = algumPadrao(ctx, CONTEXTO_CONCORRENTE_ATIVO);

      // "usava na empresa anterior" não é ameaça — é histórico.
      const active = historico ? false : true;

      let threat: Concorrente['threat'];
      if (!active) threat = 'baixa';
      else if (ativoExplicito) threat = 'alta';
      else threat = 'media';

      saida.push({
        name: conc.nome,
        context: historico ? 'Uso passado, sem avaliação corrente' : ativoExplicito ? 'Avaliação ativa' : 'Mencionado na conversa',
        threat,
        active,
        evidence: evidenciaEm(prep, c.inicio, c.fim),
      });
    }
  }

  // Fica a ocorrência mais grave de cada concorrente.
  const peso: Record<Concorrente['threat'], number> = { alta: 3, media: 2, baixa: 1 };
  const porNome = new Map<string, Concorrente>();
  for (const c of saida) {
    const atual = porNome.get(c.name);
    if (!atual || peso[c.threat] > peso[atual.threat]) porNome.set(c.name, c);
  }

  return [...porNome.values()];
}

/* ================================================================== *
 * Valores e budget
 * ================================================================== */

const NUMEROS_ESCRITOS: Record<string, number> = {
  um: 1, dois: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9,
  dez: 10, onze: 11, doze: 12, treze: 13, catorze: 14, quatorze: 14, quinze: 15,
  dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19,
  vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50,
  sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100,
  duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500,
  seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900, meio: 0.5,
};

const NOMES_NUMERO = Object.keys(NUMEROS_ESCRITOS).join('|');

/**
 * Números compostos por extenso: "setenta e cinco mil", "cento e vinte mil".
 * Sem isto, "setenta e cinco mil" casava só o "cinco mil" e virava R$ 5.000 —
 * um erro de uma ordem de grandeza no campo mais sensível do briefing.
 */
function numeroEscrito(texto: string): number | null {
  let total = 0;
  for (const parte of texto.split(/\s+e\s+/u)) {
    const v = NUMEROS_ESCRITOS[parte.trim()];
    if (v === undefined) return null;
    total += v;
  }
  return total > 0 ? total : null;
}

const MULTIPLICADORES: Record<string, number> = {
  mil: 1_000,
  k: 1_000,
  milhao: 1_000_000,
  milhoes: 1_000_000,
  mi: 1_000_000,
};

const SIGILO = [
  'nao (?:menciona|mencione|comenta|comente|fala|fale|conta|conte)',
  'confidencial',
  'entre (?:nos|a gente)',
  'segredo',
  'sigilo',
  'nao espalha',
  'fica entre',
];

function numeroBr(texto: string): number | null {
  const limpo = texto.replace(/\./g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? n : null;
}

export function extrairBudget(prep: Preparado): Budget[] {
  const saida: Budget[] = [];

  const padroes = [
    // R$ 50 mil / R$ 50.000,00 / R$ 1,2 milhão
    'r\\$\\s*([\\d.,]+)\\s*(mil|milhoes|milhao|mi|k)?',
    // 50 mil reais / 50k
    '([\\d.,]+)\\s*(mil|milhoes|milhao|mi|k)\\b(?:\\s*(?:reais|de reais))?',
    // cinquenta mil / setenta e cinco mil / cento e vinte mil / meio milhão
    `((?:${NOMES_NUMERO})(?:\\s+e\\s+(?:${NOMES_NUMERO}))?)\\s+(mil|milhoes|milhao)`,
  ];

  for (const padrao of padroes) {
    const re = new RegExp(padrao, 'gu');
    for (const m of prep.textoBusca.matchAll(re)) {
      const inicio = m.index;
      const fim = inicio + m[0].length;

      const bruto = m[1] ?? '';
      const mult = (m[2] ?? '').trim();

      const base = /[\d]/u.test(bruto) ? numeroBr(bruto) : numeroEscrito(bruto);
      if (base === null || base === undefined) continue;

      const amount = base * (MULTIPLICADORES[mult] ?? 1);
      if (!Number.isFinite(amount) || amount <= 0) continue;

      // Já capturado por um padrão anterior nesta mesma posição?
      if (saida.some((b) => b.evidence.start <= inicio && inicio < b.evidence.end && b.amount === amount)) {
        continue;
      }

      const janela = janelaBusca(prep, inicio, 140, 140);
      const confidential = algumPadrao(janela, SIGILO);

      /*
       * O qualificador do valor tem que estar colado nele. Numa janela larga,
       * "fico de mandar a proposta até sexta" transformava um budget declarado
       * em "limite" — prazo virando teto de orçamento.
       */
      const antesDoValor = janelaBusca(prep, inicio, 28, 0);

      let kind: Budget['kind'] = 'declarado';
      if (/\b(?:no maximo|limite de|teto de|ate)\s*(?:r\$)?\s*$/u.test(antesDoValor)) kind = 'limite';
      else if (/\b(?:por volta de|cerca de|uns|umas|em torno de|aproximadamente)\s*(?:r\$)?\s*$/u.test(antesDoValor)) {
        kind = 'estimado';
      }

      saida.push({
        amount,
        currency: 'BRL',
        raw: prep.textoSeguro.slice(inicio, fim).trim(),
        kind,
        confidential,
        evidence: evidenciaEm(prep, inicio, fim),
      });
    }
  }

  /*
   * Elipse de unidade. Em negociação falada, o segundo número herda a escala do
   * primeiro: "Sessenta mil ainda é muito." / "Uns cinquenta." — ninguém está
   * oferecendo cinquenta reais. Só aplicamos quando já existe um valor na casa
   * dos milhares na conversa, e a confiança fica marcada como estimada.
   */
  const temEscalaMil = saida.some((b) => (b.amount ?? 0) >= 1000);
  if (temEscalaMil) {
    const re = new RegExp(
      `\\b(?:uns|umas|por volta de|em torno de|cerca de|seria|fica em|chegar? (?:a|em)|nos)\\s+((?:${NOMES_NUMERO})|\\d{1,3})\\b`,
      'gu',
    );

    for (const m of prep.textoBusca.matchAll(re)) {
      const bruto = m[1] ?? '';
      const base = /\d/u.test(bruto) ? numeroBr(bruto) : numeroEscrito(bruto);
      if (base === null || base === undefined || base < 10) continue;

      const inicio = m.index;
      const fim = inicio + m[0].length;
      const amount = base * 1000;

      if (saida.some((b) => b.amount === amount)) continue;

      saida.push({
        amount,
        currency: 'BRL',
        raw: prep.textoSeguro.slice(inicio, fim).trim(),
        kind: 'estimado',
        confidential: algumPadrao(janelaBusca(prep, inicio, 140, 140), SIGILO),
        evidence: evidenciaEm(prep, inicio, fim),
      });
    }
  }

  // Mesmo valor citado duas vezes na mesma sentença: fica um.
  const vistos = new Set<string>();
  return saida.filter((b) => {
    const k = `${b.amount}::${b.evidence.start}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  });
}

/* ================================================================== *
 * Persona
 * ================================================================== */

export function extrairPersona(prep: Preparado): Persona {
  // Cargos citados como superior ("meu CFO") são de terceiros, não do falante.
  const spansSuperior: [number, number][] = [];
  for (const padrao of SUPERIOR_ACIMA) {
    for (const c of casar(prep, padrao)) spansSuperior.push([c.inicio, c.fim]);
  }
  const dentroDeSuperior = (pos: number): boolean =>
    spansSuperior.some(([i, f]) => pos >= i && pos < f);

  let role: string | undefined;
  let poder: Persona['decision_power'] = 'desconhecido';
  let evidencia: Persona['evidence'];

  for (const cargo of CARGOS) {
    const cs = casar(prep, cargo.padrao).filter((c) => !dentroDeSuperior(c.inicio));
    const c = cs[0];
    if (c) {
      role = cargo.rotulo;
      poder = cargo.poder;
      evidencia = evidenciaEm(prep, c.inicio, c.fim);
      break;
    }
  }

  // Quem precisa convencer alguém acima não é o decisor final.
  if (spansSuperior.length > 0) {
    poder = 'influenciador';
    if (!evidencia) {
      const s = spansSuperior[0] as [number, number];
      evidencia = evidenciaEm(prep, s[0], s[1]);
    }
  }

  // Nome do falante do lado cliente, quando há diarização.
  const cliente = prep.falantes.find((f) => f.lado === 'cliente');

  return {
    ...(cliente ? { name: cliente.nome } : {}),
    ...(role ? { role } : {}),
    decision_power: poder,
    ...(evidencia ? { evidence: evidencia } : {}),
  };
}

/* ================================================================== *
 * Problemas (dores) — alimentam o radar
 * ================================================================== */

export function extrairProblemas(prep: Preparado): Problema[] {
  type Bruto = { categoria: string; generica: boolean; inicio: number; fim: number; tamanho: number };
  const brutos: Bruto[] = [];

  for (const cat of CATEGORIAS_DOR) {
    for (const padrao of cat.padroes) {
      for (const c of casar(prep, padrao)) {
        // Dor é do cliente. O vendedor dizendo "não tem planilha no meio" está
        // vendendo, não sofrendo.
        if (!ehFalaDoCliente(prep, c.inicio)) continue;
        brutos.push({
          categoria: cat.categoria,
          generica: cat.generica === true,
          inicio: c.inicio,
          fim: c.fim,
          tamanho: c.fim - c.inicio,
        });
      }
    }
  }

  // Uma dor por sentença. O domínio ganha da categoria genérica; entre iguais,
  // ganha o casamento mais específico (o mais longo).
  const porSentenca = new Map<number, Bruto>();
  for (const b of brutos) {
    const ev = evidenciaEm(prep, b.inicio, b.fim);
    const atual = porSentenca.get(ev.start);
    if (!atual) {
      porSentenca.set(ev.start, b);
      continue;
    }
    if (atual.generica && !b.generica) porSentenca.set(ev.start, b);
    else if (atual.generica === b.generica && b.tamanho > atual.tamanho) porSentenca.set(ev.start, b);
  }

  const saida: Problema[] = [];
  for (const b of porSentenca.values()) {
    const ev = evidenciaEm(prep, b.inicio, b.fim);
    const ctx = contextoBusca(prep, b.inicio);

    /*
     * Só é dor se o cliente estiver reclamando. Além dos marcadores explícitos,
     * a própria carga negativa da frase conta: "o SPED não fecha e a gente
     * descobre no dia do vencimento" não tem nenhuma palavra da lista de dor,
     * mas é obviamente uma queixa.
     */
    const temMarcador =
      algumPadrao(ctx, DOR_CTX) ||
      /\b(?:ruim|lento|trava|erro|falha|demora|caro|reclama|nao funciona|nao conseguimos|complicado|dificil|nao fecha|nao bate|sai errado|inferno|sofrimento|apertado|esgotad)\b/u.test(
        ctx,
      );
    const cargaNegativa = pontuarTrecho(ctx).score <= -0.15;

    if (!temMarcador && !cargaNegativa) continue;

    saida.push({
      text: ev.quote,
      category: b.categoria,
      confidence: temMarcador ? 0.75 : 0.6,
      evidence: ev,
    });
  }

  return saida;
}

/* ================================================================== *
 * Necessidades
 * ================================================================== */

const NECESSIDADE = [
  'precisamos d[eo]',
  'preciso d[eo]',
  'a gente precisa',
  'estamos precisando',
  'queria (?:ter|poder|conseguir)',
  'gostaria d[eo]',
  'seria bom (?:se|ter)',
  'o que a gente (?:quer|busca|precisa)',
  'nossa necessidade',
  'estamos buscando',
  'to procurando',
  'estou procurando',
  'tem que (?:ter|dar|permitir)',
];

export function extrairNecessidades(prep: Preparado): Necessidade[] {
  const saida: Necessidade[] = [];

  for (const padrao of NECESSIDADE) {
    for (const c of casar(prep, padrao)) {
      if (!ehFalaDoCliente(prep, c.inicio)) continue;
      const ev = evidenciaEm(prep, c.inicio, c.fim);
      saida.push({ text: ev.quote, confidence: 0.7, evidence: ev });
    }
  }

  return dedupPorEvidencia(saida, (n) => n.text);
}

/* ================================================================== *
 * Objeções
 * ================================================================== */

/** "preço não é problema" não é objeção de preço. */
const NEGA_OBJECAO = [
  'nao e (?:um )?problema',
  'nao e (?:uma )?questao',
  'nao (?:me )?preocupa',
  'sem problema',
  'nao tem problema',
  'tranquilo (?:quanto|em relacao) a',
  'nao e (?:o )?empecilho',
];

const RESOLVIDA = [
  'entendi',
  'ficou claro',
  'resolvido',
  'era isso mesmo',
  'agora sim',
  'perfeito',
  'me convenceu',
];

export function extrairObjecoes(prep: Preparado): Objecao[] {
  const saida: Objecao[] = [];

  for (const grupo of OBJECOES) {
    for (const padrao of grupo.padroes) {
      for (const c of casar(prep, padrao)) {
        if (!ehFalaDoCliente(prep, c.inicio)) continue;

        const ctx = contextoBusca(prep, c.inicio);
        if (algumPadrao(ctx, NEGA_OBJECAO)) continue;

        /*
         * Negação colada ao termo: "não achamos caro" não é objeção de preço.
         * A janela é curta de propósito — "não, o preço está alto" começa com
         * "não" como marcador de discurso e continua sendo objeção de verdade.
         */
        const antes = janelaBusca(prep, c.inicio, 22, 0);
        if (/\b(?:nao|nunca|nem)\s+(?:[\p{L}]+\s+){0,2}$/u.test(antes) && !/,[^,]*$/u.test(antes)) {
          continue;
        }

        /*
         * Quem cobra caro precisa ser NÓS. "O banco cobra caro pela
         * antecipação" é dor financeira do cliente, não objeção ao nosso preço.
         */
        if (grupo.categoria === 'preco' && /\b(?:o|os|do|dos)\s+(?:banco|bancos|fornecedor|fornecedores)\b/u.test(ctx)) {
          continue;
        }

        const ev = evidenciaEm(prep, c.inicio, c.fim);
        const depois = janelaBusca(prep, ev.end, 0, 260);

        saida.push({
          text: ev.quote,
          category: grupo.categoria,
          resolved: algumPadrao(depois, RESOLVIDA),
          confidence: 0.75,
          evidence: ev,
        });
      }
    }
  }

  return dedupPorEvidencia(saida, (o) => o.category);
}

/* ================================================================== *
 * Decisões, próximos passos e riscos
 * ================================================================== */

const DECISAO = [
  'ficou decidido',
  'decidimos',
  'ficou combinado',
  'combinado (?:entao|assim)',
  'vamos (?:seguir|fechar|com) (?:com|o|a)',
  'optamos por',
  'escolhemos',
  'fechado',
  'ta acertado',
  'entao fica (?:assim|desse jeito)',
];

const PROXIMO_PASSO = [
  'proximo passo',
  'proximos passos',
  'vamos agendar',
  'vamos marcar',
  'marcar (?:para|pra|no)',
  'fico de',
  'vou (?:enviar|mandar|passar|preparar|montar)',
  'voce (?:me )?(?:manda|envia)',
  'semana que vem (?:a gente|eu|nos)',
  'te (?:mando|envio) (?:ate|na|no)',
  'agendamos (?:para|pra)',
];

/** Encerramento vago não é próximo passo — é ausência de compromisso. */
const PASSO_VAGO = [
  'vou ver e te aviso',
  'depois (?:eu )?(?:te )?(?:retorno|falo|aviso)',
  'qualquer coisa (?:eu )?(?:aviso|falo)',
  'a gente se fala',
  'te retorno depois',
  'vou pensar',
];

export function extrairDecisoes(prep: Preparado): Decisao[] {
  const saida: Decisao[] = [];
  for (const padrao of DECISAO) {
    for (const c of casar(prep, padrao)) {
      const ev = evidenciaEm(prep, c.inicio, c.fim);
      saida.push({ text: ev.quote, confidence: 0.75, evidence: ev });
    }
  }
  return dedupPorEvidencia(saida, (d) => d.text);
}

export function extrairProximosPassos(prep: Preparado): ProximoPasso[] {
  const saida: ProximoPasso[] = [];
  for (const padrao of PROXIMO_PASSO) {
    for (const c of casar(prep, padrao)) {
      const ctx = contextoBusca(prep, c.inicio);
      if (algumPadrao(ctx, PASSO_VAGO)) continue;
      const ev = evidenciaEm(prep, c.inicio, c.fim);
      saida.push({ text: ev.quote, confidence: 0.7, evidence: ev });
    }
  }
  return dedupPorEvidencia(saida, (p) => p.text);
}

export function temEncerramentoVago(prep: Preparado): boolean {
  return PASSO_VAGO.some((p) => casar(prep, p).length > 0);
}

/* ================================================================== *
 * Prazos
 * ================================================================== */

const DIAS_SEMANA: Record<string, number> = {
  domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6,
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Resolve prazo relativo usando a data da reunião como âncora. */
export function resolverPrazo(textoJanela: string, dataReuniao: string): string | null {
  const ancora = new Date(`${dataReuniao}T12:00:00Z`);
  if (Number.isNaN(ancora.getTime())) return null;

  const dm = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/u.exec(textoJanela);
  if (dm) {
    const dia = Number(dm[1]);
    const mes = Number(dm[2]);
    let ano = dm[3] ? Number(dm[3]) : ancora.getUTCFullYear();
    if (ano < 100) ano += 2000;
    const d = new Date(Date.UTC(ano, mes - 1, dia, 12));
    if (!Number.isNaN(d.getTime())) return iso(d);
  }

  const emDias = /\bem\s+(\d{1,3})\s+dias?\b/u.exec(textoJanela);
  if (emDias) {
    const d = new Date(ancora);
    d.setUTCDate(d.getUTCDate() + Number(emDias[1]));
    return iso(d);
  }

  const emSemanas = /\bem\s+(\d{1,2})\s+semanas?\b/u.exec(textoJanela);
  if (emSemanas) {
    const d = new Date(ancora);
    d.setUTCDate(d.getUTCDate() + Number(emSemanas[1]) * 7);
    return iso(d);
  }

  const diaSemana = /\b(?:ate|na|nesta|proxima)?\s*(domingo|segunda|terca|quarta|quinta|sexta|sabado)\b/u.exec(
    textoJanela,
  );
  if (diaSemana) {
    const alvo = DIAS_SEMANA[diaSemana[1] as string];
    if (alvo !== undefined) {
      const d = new Date(ancora);
      const atual = d.getUTCDay();
      let delta = (alvo - atual + 7) % 7;
      if (delta === 0) delta = 7;
      d.setUTCDate(d.getUTCDate() + delta);
      return iso(d);
    }
  }

  if (/\bproxima semana\b|\bsemana que vem\b/u.test(textoJanela)) {
    const d = new Date(ancora);
    d.setUTCDate(d.getUTCDate() + 7);
    return iso(d);
  }

  if (/\bfinal do mes\b|\bfim do mes\b/u.test(textoJanela)) {
    const d = new Date(Date.UTC(ancora.getUTCFullYear(), ancora.getUTCMonth() + 1, 0, 12));
    return iso(d);
  }

  if (/\bmes que vem\b|\bproximo mes\b/u.test(textoJanela)) {
    const d = new Date(ancora);
    d.setUTCMonth(d.getUTCMonth() + 1);
    return iso(d);
  }

  return null;
}

/* ================================================================== *
 * Tarefas
 * ================================================================== */

const TAREFA_INTERNA = [
  'vou (?:enviar|mandar|passar|preparar|montar|fazer|agendar|verificar|checar)',
  'fico de (?:enviar|mandar|passar|preparar|montar|trazer)',
  'eu (?:mando|envio|preparo|trago)',
  'a gente (?:manda|envia|prepara) (?:ate|na|no|pra)',
];

const TAREFA_CLIENTE = [
  'voce (?:me )?(?:manda|envia|passa)',
  'voces (?:me )?(?:mandam|enviam|passam)',
  'preciso que (?:voce|voces)',
  'me (?:manda|envia) (?:o|a|os|as)',
  'fica de (?:me )?(?:mandar|enviar|passar)',
];

export function extrairTarefas(prep: Preparado, dataReuniao: string): Tarefa[] {
  const saida: Tarefa[] = [];

  const coletar = (padroes: string[], side: Tarefa['side']) => {
    for (const padrao of padroes) {
      for (const c of casar(prep, padrao)) {
        const ev = evidenciaEm(prep, c.inicio, c.fim);
        const janela = prep.textoBusca.slice(ev.start, Math.min(prep.textoBusca.length, ev.end + 80));
        saida.push({
          description: ev.quote,
          responsible: ev.speaker ?? null,
          side,
          due_date: resolverPrazo(janela, dataReuniao),
          evidence: ev,
        });
      }
    }
  };

  coletar(TAREFA_INTERNA, 'interno');
  coletar(TAREFA_CLIENTE, 'cliente');

  return dedupPorEvidencia(saida, (t) => `${t.side}:${t.description}`);
}

/* ================================================================== *
 * Sinais de churn e de upsell
 * ================================================================== */

export function extrairSinaisChurn(prep: Preparado): SinalPontuado[] {
  const saida: SinalPontuado[] = [];
  for (const sinal of SINAIS_CHURN) {
    for (const c of casar(prep, sinal.padrao)) {
      if (!ehFalaDoCliente(prep, c.inicio)) continue;
      const ev = evidenciaEm(prep, c.inicio, c.fim);
      saida.push({ text: sinal.rotulo, weight: sinal.peso, evidence: ev });
    }
  }
  return dedupPorEvidencia(saida, (s) => s.text);
}

export function extrairSinaisUpsell(prep: Preparado): SinalPontuado[] {
  const saida: SinalPontuado[] = [];
  for (const gatilho of GATILHOS_COMPRA) {
    for (const c of casar(prep, gatilho.padrao)) {
      const ev = evidenciaEm(prep, c.inicio, c.fim);
      saida.push({ text: gatilho.rotulo, weight: gatilho.peso, evidence: ev });
    }
  }
  return dedupPorEvidencia(saida, (s) => s.text);
}

export function extrairRiscos(churn: SinalPontuado[], concorrentes: Concorrente[]): Risco[] {
  const saida: Risco[] = [];

  for (const s of churn) {
    saida.push({
      text: s.text,
      severity: s.weight >= 20 ? 'alta' : s.weight >= 14 ? 'media' : 'baixa',
      evidence: s.evidence,
    });
  }

  for (const c of concorrentes) {
    if (!c.active) continue;
    saida.push({
      text: `Concorrente ativo na conversa: ${c.name}`,
      severity: c.threat,
      evidence: c.evidence,
    });
  }

  return saida;
}

/* ================================================================== *
 * Oportunidades
 * ================================================================== */

export function extrairOportunidades(
  prep: Preparado,
  produtos: ProdutoTotvs[],
  temBudget: boolean,
): Oportunidade[] {
  const saida: Oportunidade[] = [];

  const preferenciaTotvs = algumPadrao(prep.textoBusca, [
    'consolidar tudo na totvs',
    'consolidar na totvs',
    'prefiro (?:a )?totvs',
    'prefiro consolidar',
    'ficar (?:tudo )?(?:na|com a) totvs',
    'manter (?:na|com a) totvs',
  ]);

  for (const p of produtos) {
    if (p.status !== 'oportunidade' && p.status !== 'avaliando') continue;

    const ctx = contextoBusca(prep, p.evidence.start);
    const temDor = algumPadrao(ctx, DOR_CTX);
    const condicionalFraco = algumPadrao(ctx, CONDICIONAL_FRACO);

    let probabilidade = 0.5;
    if (temDor) probabilidade += 0.2;
    if (preferenciaTotvs) probabilidade += 0.15;
    if (temBudget) probabilidade += 0.1;
    if (condicionalFraco) probabilidade -= 0.3;

    const razoes: string[] = [];
    if (temDor) razoes.push('dor explícita no tema do produto');
    if (preferenciaTotvs) razoes.push('cliente declarou preferência por consolidar na TOTVS');
    if (temBudget) razoes.push('budget declarado na conversa');
    if (condicionalFraco) razoes.push('menção condicional, sem urgência');

    saida.push({
      product: p.name,
      unit: p.unit,
      kind: 'upsell',
      probability: Number(limitar(probabilidade, 0.05, 0.95).toFixed(2)),
      rationale: razoes.length > 0 ? razoes.join('; ') : 'produto citado como possibilidade',
      evidence: p.evidence,
    });
  }

  return saida;
}

/* ================================================================== *
 * Voz do cliente
 * ================================================================== */

function alvoDoAspecto(ctx: string): string | undefined {
  for (const a of ASPECTOS) {
    if (algumPadrao(ctx, a.padroes)) return a.rotulo;
  }
  return undefined;
}

export function extrairVoz(prep: Preparado): VozDoCliente[] {
  const saida: VozDoCliente[] = [];

  const coletar = (padroes: string[], tipo: VozDoCliente['type']) => {
    for (const padrao of padroes) {
      for (const c of casar(prep, padrao)) {
        // Voz DO cliente: elogio e reclamação do vendedor não contam.
        if (!ehFalaDoCliente(prep, c.inicio)) continue;
        const ev = evidenciaEm(prep, c.inicio, c.fim);
        const alvo = alvoDoAspecto(contextoBusca(prep, c.inicio));
        saida.push({
          type: tipo,
          ...(alvo ? { target: alvo } : {}),
          text: ev.quote,
          evidence: ev,
        });
      }
    }
  };

  coletar(VOZ_ELOGIO, 'elogio');
  coletar(VOZ_RECLAMACAO, 'reclamacao');
  coletar(VOZ_LEGADO, 'legado');
  coletar(VOZ_DUVIDA_JORNADA, 'duvida_jornada');

  return dedupPorEvidencia(saida, (v) => v.type);
}
