import type { Lado } from '../types';

/**
 * Inferência de papel — quem vende e quem compra.
 *
 * A transcrição quase nunca diz "este é o vendedor". O que ela traz é cargo no
 * rótulo, dêixis ("nossa plataforma" contra "a gente usa") e a assimetria entre
 * quem pergunta e quem responde. Este módulo lê só isso: uma lista de falas com
 * falante, texto e contagem de palavras. Não conhece `Preparado`, não conhece
 * offset e não conhece TOTVS — o nome da empresa vendedora entra por parâmetro,
 * senão qualquer reunião em que a marca não é citada perde a classificação.
 *
 * O motor SEMPRE decide. Quando os sinais não bastam, ele decide mesmo assim e
 * devolve confiança baixa — é a interface que pede confirmação humana. Por isso
 * `sinais` não é enfeite: é o que permite à métrica contar quantas decisões
 * saíram do último recurso, e à interface responder "por que você achou isso?".
 */

export type FalaDoTurno = {
  falante: string;
  texto: string;
  palavras: number;
  cargo?: string | null;
};

export type OpcoesPapeis = {
  /** Quem está vendendo nesta call. Entra no léxico como sinal, não no código. */
  empresaVendedora?: string;
  /** Confirmação humana. Chave em minúsculo; vence qualquer sinal do motor. */
  papeisFixados?: Record<string, Lado>;
};

export type PapelInferido = {
  nome: string;
  lado: Lado;
  /** 0–1. Abaixo de ~0,4 a interface deve pedir confirmação. */
  confianca: number;
  /** Quais sinais dispararam — auditabilidade e métrica. */
  sinais: string[];
};

/* ------------------------------------------------------------------ *
 * Normalização
 * ------------------------------------------------------------------ */

/**
 * Minúsculo e sem acento.
 *
 * Diferente do `dobrar` de `segment.ts`, aqui o comprimento não importa: este
 * módulo nunca devolve offset, só decide papel. Manter a função local é o que
 * evita o ciclo de importação com `segment.ts`, que é quem chama este módulo.
 */
function dobrar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function escaparRegex(bruto: string): string {
  return bruto.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/* ------------------------------------------------------------------ *
 * Sinais léxicos — dêixis, sem marca
 * ------------------------------------------------------------------ */

type Marca = { re: RegExp; sinal: string };

/** Quem fala de dentro do fornecedor: a solução é "nossa", a entrega é dele. */
const MARCAS_FORNECEDOR: Marca[] = [
  { re: /\bnoss[ao] (solucao|plataforma|ferramenta|produto|equipe|implantacao|consultoria|metodologia)\b/, sinal: 'dexis_fornecedor' },
  { re: /\bnosso (time de implantacao|suporte tecnico|time tecnico)\b/, sinal: 'dexis_fornecedor' },
  { re: /\b(a gente|nos) (entrega|entregamos|implanta|implantamos|atende|atendemos)\b/, sinal: 'dexis_fornecedor' },
  { re: /\bconseguimos (entregar|implantar|fazer|atender)\b/, sinal: 'dexis_fornecedor' },
  { re: /\b(posso|vou|deixa eu) (te )?(mostrar|apresentar|compartilhar|demonstrar)\b/, sinal: 'oferece_demonstracao' },
  { re: /\b(posso|vou) te (enviar|mandar|passar)\b/, sinal: 'compromisso_de_envio' },
  { re: /\bfico de (enviar|mandar|passar|te mandar)\b/, sinal: 'compromisso_de_envio' },
  { re: /\b(te|lhe) envio (a proposta|o material|depois)\b/, sinal: 'compromisso_de_envio' },
];

/** Quem fala de dentro do comprador: a dor é "nossa", o fornecedor é "vocês". */
const MARCAS_COMPRADOR: Marca[] = [
  { re: /\b(a gente|nos) (precisa|precisamos|sofre|sofremos|usa|usamos|tem|temos|ta com|estamos com|esta com|nao consegue|nao conseguimos)\b/, sinal: 'dexis_comprador' },
  { re: /\bo noss[ao] (time|pessoal|erp|sistema|financeiro|rh|fiscal|controladoria|operacao)\b/, sinal: 'dexis_comprador' },
  { re: /\bnossa empresa\b/, sinal: 'dexis_comprador' },
  { re: /\baqui (na nossa empresa|na empresa|dentro de casa|do nosso lado)\b/, sinal: 'dexis_comprador' },
  { re: /\bvoces (conseguem|tem|fazem|entregam|cobram|trabalham|atendem)\b/, sinal: 'trata_o_outro_como_fornecedor' },
  { re: /\b(meu|nosso) (cfo|ceo|cto|coo|diretor|diretora|chefe|socio|gestor)\b/, sinal: 'reporta_a_decisor_interno' },
  { re: /\bpreciso (aprovar|levar|validar|submeter) (com|para|pra|ao|a)\b/, sinal: 'reporta_a_decisor_interno' },
  { re: /\bo pessoal (do|da|de) \w+/, sinal: 'dexis_comprador' },
];

/** Quem abre agradecendo o tempo ou propondo pauta está conduzindo a reunião. */
const MARCAS_ABERTURA: RegExp[] = [
  /\bobrigad[ao] (por|pelo|pela) (aceitar|receber|ter aceitado|seu tempo|o tempo|essa conversa|a conversa)\b/,
  /\bobrigad[ao] pelo tempo\b/,
  /\bvaleu (por|pelo) (aceitar|seu tempo|o tempo)\b/,
  /\b(a|nossa) pauta (de hoje|hoje|e)\b/,
  /\btrouxe uma pauta\b/,
];

/* ------------------------------------------------------------------ *
 * Sinais de cargo — a evidência mais direta, e hoje jogada fora
 * ------------------------------------------------------------------ */

/*
 * `RE_ROTULO` em `segment.ts` já captura "Carla (CSM)" e
 * "Ricardo — Diretor Financeiro" e descarta o cargo de propósito, para não
 * partir o agrupamento de turnos. O cargo chega aqui num campo separado do
 * nome, sem voltar a poluir a chave de agrupamento.
 *
 * Fornecedor é testado antes de comprador: "Gerente de Contas" é do lado de
 * quem vende, "Gerente Financeiro" é do lado de quem compra.
 */
const CARGOS_FORNECEDOR: RegExp[] = [
  /\bcsm\b/,
  /\bcustomer success\b/,
  /\b(executiv[ao]|gerente|gestor[a]?) de (conta|contas|vendas|novos negocios)\b/,
  /\baccount (executive|manager)\b/,
  /\b(sdr|bdr|ae)\b/,
  /\bconsultor[ae]?\b/,
  /\b(pre-?vendas|presales)\b/,
  /\bespecialista (de|em) (produto|solucao|solucoes)\b/,
  /\barquitet[ao] de solucoes\b/,
  /\b(vendedor|vendedora|sales|comercial)\b/,
];

const CARGOS_COMPRADOR: RegExp[] = [
  /\b(cfo|ceo|cto|coo|cio)\b/,
  /\bdiretor[a]?\b/,
  /\bgerente\b/,
  /\bcontroller\b/,
  /\b(coordenador[a]?|supervisor[a]?|analista)\b/,
  /\b(socio|socia|proprietari[ao])\b/,
  /\bcomprador[a]?\b/,
];

/* ------------------------------------------------------------------ *
 * Pesos
 * ------------------------------------------------------------------ */

const PESO = {
  cargo: 2.5,
  empresaVendedora: 2.0,
  lexico: 1.0,
  abertura: 0.8,
  /**
   * Teto deliberadamente abaixo do limiar: numa call de descoberta quem
   * pergunta costuma ser o vendedor, mas o cliente que faz cotação também
   * pergunta muito. Sozinho o sinal não classifica ninguém — só elege quando
   * nenhum outro sinal apareceu na reunião inteira.
   */
  taxaDePergunta: 0.8,
  /** Cliente descreve dor em turno longo, vendedor conduz em turno curto. */
  comprimento: 0.25,
} as const;

const LIMIAR = 1.0;

/** Abaixo disto, turno longo é ruído de saudação, não descrição de dor. */
const MEDIANA_MINIMA_PARA_SINAL = 12;

const CONFIANCA_PROPAGADA = 0.3;
const CONFIANCA_ORDEM_DE_FALA = 0.2;

/**
 * Força do placar vira confiança por uma curva que satura, nunca em 1.
 * Certeza absoluta é reservada ao humano que confirmou.
 */
function confiancaDe(forca: number): number {
  return Number(Math.min(0.95, 1 - Math.exp(-forca / 2.5)).toFixed(2));
}

function mediana(valores: number[]): number {
  if (valores.length === 0) return 0;
  const ordenado = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenado.length / 2);
  return ordenado.length % 2 === 1
    ? (ordenado[meio] as number)
    : ((ordenado[meio - 1] as number) + (ordenado[meio] as number)) / 2;
}

/* ------------------------------------------------------------------ *
 * Inferência
 * ------------------------------------------------------------------ */

type Acumulado = {
  nome: string;
  chave: string;
  ordem: number;
  falas: FalaDoTurno[];
  cargo: string | null;
  placar: number;
  sinais: string[];
  lado: Lado;
  confianca: number;
};

function anotar(a: Acumulado, peso: number, sinal: string): void {
  a.placar += peso;
  if (!a.sinais.includes(sinal)) a.sinais.push(sinal);
}

export function inferirPapeis(
  turnos: FalaDoTurno[],
  opcoes?: OpcoesPapeis,
): PapelInferido[] {
  const empresa = opcoes?.empresaVendedora ?? 'TOTVS';
  const fixados = opcoes?.papeisFixados ?? {};

  // Agrupamento por falante, preservando a ordem em que cada um entrou na call.
  const porFalante = new Map<string, Acumulado>();
  for (const t of turnos) {
    const chave = t.falante.toLowerCase();
    let a = porFalante.get(chave);
    if (!a) {
      a = {
        nome: t.falante,
        chave,
        ordem: porFalante.size,
        falas: [],
        cargo: null,
        placar: 0,
        sinais: [],
        lado: 'desconhecido',
        confianca: 0,
      };
      porFalante.set(chave, a);
    }
    a.falas.push(t);
    if (!a.cargo && t.cargo) a.cargo = t.cargo;
  }

  const pessoas = [...porFalante.values()];
  if (pessoas.length === 0) return [];

  const reEmpresa = new RegExp(`\\b(?:aqui\\s+)?n[ao]\\s+${escaparRegex(dobrar(empresa))}\\b`);

  /* --- 1. Confirmação humana vence tudo. ------------------------------ */
  for (const p of pessoas) {
    const fixado = fixados[p.chave];
    if (fixado) {
      p.lado = fixado;
      p.confianca = 1;
      p.sinais = ['fixado_por_humano'];
    }
  }

  const livres = pessoas.filter((p) => !fixados[p.chave]);

  /* --- 2. Cargo, empresa e dêixis. ------------------------------------ */
  for (const p of livres) {
    const texto = dobrar(p.falas.map((f) => f.texto).join(' '));

    if (p.cargo) {
      const cargo = dobrar(p.cargo);
      if (cargo.includes(dobrar(empresa))) {
        anotar(p, PESO.cargo, 'cargo_fornecedor');
      } else if (CARGOS_FORNECEDOR.some((re) => re.test(cargo))) {
        anotar(p, PESO.cargo, 'cargo_fornecedor');
      } else if (CARGOS_COMPRADOR.some((re) => re.test(cargo))) {
        anotar(p, -PESO.cargo, 'cargo_comprador');
      }
    }

    if (reEmpresa.test(texto)) anotar(p, PESO.empresaVendedora, 'cita_empresa_vendedora');

    for (const m of MARCAS_FORNECEDOR) if (m.re.test(texto)) anotar(p, PESO.lexico, m.sinal);
    for (const m of MARCAS_COMPRADOR) if (m.re.test(texto)) anotar(p, -PESO.lexico, m.sinal);
  }

  /* --- 3. Quem abre a reunião. ---------------------------------------- */
  const primeiro = turnos[0];
  if (primeiro) {
    const abridor = livres.find((p) => p.chave === primeiro.falante.toLowerCase());
    if (abridor && MARCAS_ABERTURA.some((re) => re.test(dobrar(primeiro.texto)))) {
      anotar(abridor, PESO.abertura, 'abre_a_reuniao');
    }
  }

  /* --- 4. Taxa de pergunta. -------------------------------------------
   * Sinal estrutural: não depende de vocabulário nenhum, e é o que sobra
   * quando a reunião inteira passa sem uma expressão do léxico.
   */
  if (livres.length >= 2) {
    const taxas = livres
      .map((p) => ({
        p,
        valor: p.falas.filter((f) => f.texto.includes('?')).length / p.falas.length,
      }))
      .sort((a, b) => b.valor - a.valor);

    const lider = taxas[0];
    const segundo = taxas[1];
    if (lider && segundo && lider.valor >= 0.5) {
      const vantagem = lider.valor - segundo.valor;
      if (vantagem > 0) anotar(lider.p, PESO.taxaDePergunta * vantagem, 'taxa_de_pergunta');
    }
  }

  /* --- 5. Comprimento mediano de turno — sinal fraco, guardado. -------- */
  if (livres.length >= 2) {
    const medianas = livres
      .map((p) => ({ p, valor: mediana(p.falas.map((f) => f.palavras)) }))
      .sort((a, b) => b.valor - a.valor);

    const longo = medianas[0];
    const curto = medianas[medianas.length - 1];
    if (
      longo &&
      curto &&
      longo.p !== curto.p &&
      longo.valor >= MEDIANA_MINIMA_PARA_SINAL &&
      curto.valor > 0 &&
      longo.valor >= curto.valor * 1.5
    ) {
      anotar(longo.p, -PESO.comprimento, 'turno_longo');
      anotar(curto.p, PESO.comprimento, 'turno_curto');
    }
  }

  /* --- 6. Classificação por limiar. ------------------------------------ */
  for (const p of livres) {
    if (p.placar >= LIMIAR) {
      p.lado = 'vendedor';
      p.confianca = confiancaDe(p.placar);
    } else if (p.placar <= -LIMIAR) {
      p.lado = 'cliente';
      p.confianca = confiancaDe(-p.placar);
    }
  }

  const temVendedor = () => pessoas.some((p) => p.lado === 'vendedor');

  /* --- 7. Eleição pela condução. ---------------------------------------
   * Ninguém cruzou o limiar, mas alguém puxou as perguntas da reunião
   * inteira. Vale mais que ordem de fala, e vem com confiança baixa.
   */
  if (!temVendedor()) {
    const candidato = livres
      .filter((p) => p.lado === 'desconhecido' && p.placar > 0 && p.sinais.includes('taxa_de_pergunta'))
      .sort((a, b) => b.placar - a.placar)[0];
    if (candidato) {
      candidato.lado = 'vendedor';
      candidato.confianca = confiancaDe(candidato.placar);
    }
  }

  /* --- 8. Propagação: achado um lado, quem sobra está do outro. -------- */
  const propagar = () => {
    const desconhecidos = pessoas.filter((p) => p.lado === 'desconhecido');
    if (desconhecidos.length === 0) return;

    if (temVendedor()) {
      for (const p of desconhecidos) {
        p.lado = 'cliente';
        p.confianca = CONFIANCA_PROPAGADA;
        if (!p.sinais.includes('propagado')) p.sinais.push('propagado');
      }
    } else if (desconhecidos.length === 1 && pessoas.some((p) => p.lado === 'cliente')) {
      const unico = desconhecidos[0] as Acumulado;
      unico.lado = 'vendedor';
      unico.confianca = CONFIANCA_PROPAGADA;
      unico.sinais.push('propagado');
    }
  };

  propagar();

  /* --- 9. Último recurso: ordem de fala. -------------------------------
   * O corpus de treino tem o vendedor abrindo quase sempre, então este é o
   * palpite que mais decora formato e menos entende conversa. Ele fica no
   * fim da fila, declarado nos sinais e com confiança de palpite — para que
   * a métrica consiga separar "o motor soube" de "o motor chutou".
   */
  if (!temVendedor()) {
    const abridor = pessoas.filter((p) => !fixados[p.chave]).sort((a, b) => a.ordem - b.ordem)[0];
    if (abridor) {
      abridor.lado = 'vendedor';
      abridor.confianca = CONFIANCA_ORDEM_DE_FALA;
      abridor.sinais.push('ordem_de_fala');
      propagar();
    }
  }

  return pessoas.map((p) => ({
    nome: p.nome,
    lado: p.lado,
    confianca: p.confianca,
    sinais: p.sinais,
  }));
}
