import type { Lado, Sentenca, Turno } from '../types';
import { redigir } from './redact';
import type { Redacao } from '../types';
import { inferirPapeis, type FalaDoTurno, type OpcoesPapeis } from './papeis';

/**
 * Camada de texto do motor.
 *
 * Decisão central de arquitetura: o texto NUNCA muda de comprimento durante o
 * preparo. Existe um único sistema de coordenadas — o `textoSeguro` — e todos
 * os offsets de evidência apontam para ele.
 *
 *   textoSeguro  o que é guardado e exibido (já anonimizado)
 *   textoBusca   mesmo comprimento, minúsculo e sem acento, com timestamps e
 *                rótulos de falante trocados por espaço. Todo regex roda aqui;
 *                todo índice encontrado vale igual no textoSeguro.
 *
 * Isso elimina aritmética de offset — a classe de bug que faria a UI destacar
 * o trecho errado da transcrição.
 */

const ACENTOS: Record<string, string> = {
  á: 'a', à: 'a', ã: 'a', â: 'a', ä: 'a',
  é: 'e', è: 'e', ê: 'e', ë: 'e',
  í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', õ: 'o', ô: 'o', ö: 'o',
  ú: 'u', ù: 'u', û: 'u', ü: 'u',
  ç: 'c', ñ: 'n',
};

/** Minúsculo e sem acento, caractere a caractere — o comprimento é preservado. */
export function dobrar(texto: string): string {
  let saida = '';
  for (const ch of texto) {
    const min = ch.toLowerCase();
    // Guarda contra caracteres cujo lowercase tem comprimento diferente.
    const seguro = min.length === ch.length ? min : ch;
    saida += ACENTOS[seguro] ?? seguro;
  }
  return saida;
}

const RE_TIMESTAMP = /\[?\(?\b\d{1,2}:\d{2}(?::\d{2})?\b\)?\]?/g;
const RE_INAUDIVEL = /\[(inaud[ií]vel|incompreens[ií]vel|\?+|risos|sil[êe]ncio)\]/gi;

/** Troca um trecho por espaços mantendo o comprimento. */
function apagar(texto: string, inicio: number, fim: number): string {
  return texto.slice(0, inicio) + ' '.repeat(fim - inicio) + texto.slice(fim);
}

/* ------------------------------------------------------------------ *
 * Diarização
 * ------------------------------------------------------------------ */

/*
 * Rótulo de falante.
 *
 * Formatos aceitos: "Ana:", "ANA SILVA:", "[Ana]", "João (TOTVS):" e
 * "Fernanda — TOTVS:" — com o texto na mesma linha OU na linha seguinte.
 *
 * As duas últimas tolerâncias não são capricho. A regex anterior exigia
 * dois-pontos seguidos de espaço na MESMA linha e não aceitava travessão no
 * nome; uma transcrição colada no formato que Meet, Teams e ata de reunião
 * produzem — rótulo sozinho na linha, cargo após travessão — era lida como
 * texto corrido, sem nenhum turno. Sem turno não há talk ratio, não há
 * pergunta contada e o sentimento não consegue separar a fala do cliente da
 * fala do vendedor. Um detalhe de parsing derrubava metade da análise.
 *
 * O cargo depois de travessão ou hífen cercado de espaços sai do NOME, senão
 * "Ricardo — Diretor Financeiro:" e "Ricardo:" viram dois falantes distintos e
 * o agrupamento de turnos se parte no meio da reunião.
 *
 * Sair do nome não é o mesmo que ser jogado fora. O cargo é a evidência mais
 * direta de papel que existe numa transcrição de Meet ou Teams — "Carla (CSM)"
 * contra "Ricardo — Diretor Financeiro" resolve a reunião inteira — e por isso
 * ele é capturado num campo separado e entregue à inferência de papel. O que a
 * chave de agrupamento não pode é vê-lo.
 */
const RE_ROTULO =
  /^[ \t>-]*(?:\[([^\]\n]{2,45})\]|([\p{Lu}][\p{L}.'’ ]{1,40}?)(?:(?:\s*[—–]\s*|\s+-\s+)([^:\n]{1,40}))?(?:\s*\(([^)\n]{1,30})\))?)\s*:(?:[ \t]|$)/u;

const PALAVRAS_NAO_FALANTE = new Set([
  'obs', 'nota', 'ps', 'atenção', 'atencao', 'resumo', 'obrigado', 'olha', 'veja',
  'exemplo', 'importante', 'link', 'http', 'https', 'obs.', 'pauta', 'agenda',
]);

/** Partículas de nome próprio que legitimamente vêm em minúscula. */
const PARTICULAS = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'del', 'di']);

/**
 * Parece nome de pessoa?
 *
 * Nome próprio vem capitalizado ou em caixa alta. Frase comum não vem — e é
 * frase comum que produz falso falante quando o rótulo pode ocupar a linha
 * inteira: "Os principais pontos são: baixa percepção de retorno..." casava a
 * estrutura de rótulo e criava um participante que nunca existiu na reunião.
 */
function pareceNome(bruto: string): boolean {
  const palavras = bruto.split(/\s+/).filter(Boolean);
  if (palavras.length === 0 || palavras.length > 3) return false;
  if (bruto === bruto.toUpperCase()) return true; // ANA SILVA
  return palavras.every((p, i) => {
    if (i > 0 && PARTICULAS.has(p.toLowerCase())) return true;
    const primeira = p[0] ?? '';
    return primeira === primeira.toUpperCase() && primeira !== primeira.toLowerCase();
  });
}

type RotuloAchado = {
  falante: string;
  /** Cargo ou empresa que vinha colado ao nome. Fora da chave, dentro da análise. */
  cargo: string | null;
  inicioRotulo: number;
  inicioTexto: number;
};

function acharRotulos(textoSeguro: string): RotuloAchado[] {
  const achados: RotuloAchado[] = [];
  let offset = 0;

  for (const linha of textoSeguro.split('\n')) {
    const m = RE_ROTULO.exec(linha);
    if (m) {
      const bruto = (m[1] ?? m[2] ?? '').trim();
      const cargo = (m[3] ?? m[4] ?? '').trim();
      const chave = bruto.toLowerCase().replace(/[.:]/g, '');
      const palavras = chave.split(/\s+/).filter(Boolean).length;

      if (bruto && palavras <= 4 && !PALAVRAS_NAO_FALANTE.has(chave) && pareceNome(bruto)) {
        achados.push({
          falante: bruto,
          cargo: cargo || null,
          inicioRotulo: offset,
          inicioTexto: offset + m[0].length,
        });
      }
    }
    offset += linha.length + 1; // +1 do \n
  }

  return achados;
}

/* ------------------------------------------------------------------ *
 * Sentenças
 * ------------------------------------------------------------------ */

const ABREVIACOES = new Set([
  'sr', 'sra', 'srta', 'dr', 'dra', 'prof', 'profa', 'eng', 'adv', 'exmo',
  'av', 'r', 'no', 'n', 'pag', 'pág', 'art', 'ltda', 'cia', 'etc', 'ex',
  'fig', 'obs', 'ref', 'cap', 'vs', 'aprox', 'aprox',
]);

function ehFimDeSentenca(texto: string, i: number): boolean {
  const ch = texto[i];
  if (ch !== '.' && ch !== '!' && ch !== '?') return false;

  // Número decimal ou milhar: 50.000 / 3.5
  if (ch === '.' && /\d/.test(texto[i - 1] ?? '') && /\d/.test(texto[i + 1] ?? '')) return false;

  // Abreviação conhecida antes do ponto
  if (ch === '.') {
    const antes = texto.slice(Math.max(0, i - 12), i);
    const ultima = /([\p{L}]+)$/u.exec(antes)?.[1]?.toLowerCase();
    if (ultima && ABREVIACOES.has(ultima)) return false;
    // Inicial de nome: "J. Silva"
    if (ultima && ultima.length === 1) return false;
  }

  // Precisa vir espaço/fim e depois algo que comece frase
  let j = i + 1;
  while (j < texto.length && /[.!?"'”’)\]]/.test(texto[j] ?? '')) j++;
  if (j >= texto.length) return true;
  if (!/\s/.test(texto[j] ?? '')) return false;
  while (j < texto.length && /\s/.test(texto[j] ?? '')) j++;
  if (j >= texto.length) return true;

  return /[\p{Lu}\d"'“—-]/u.test(texto[j] ?? '');
}

function fatiarSentencas(
  textoSeguro: string,
  inicio: number,
  fim: number,
  falante: string | null,
  lado: Lado,
): Sentenca[] {
  const saida: Sentenca[] = [];
  let cursor = inicio;

  for (let i = inicio; i < fim; i++) {
    if (ehFimDeSentenca(textoSeguro, i)) {
      let corte = i + 1;
      while (corte < fim && /[.!?"'”’)\]]/.test(textoSeguro[corte] ?? '')) corte++;
      const bruto = textoSeguro.slice(cursor, corte);
      if (bruto.trim()) {
        const esq = bruto.length - bruto.trimStart().length;
        saida.push({
          texto: bruto.trim(),
          inicio: cursor + esq,
          fim: cursor + esq + bruto.trim().length,
          falante,
          lado,
        });
      }
      cursor = corte;
    }
  }

  const resto = textoSeguro.slice(cursor, fim);
  if (resto.trim()) {
    const esq = resto.length - resto.trimStart().length;
    saida.push({
      texto: resto.trim(),
      inicio: cursor + esq,
      fim: cursor + esq + resto.trim().length,
      falante,
      lado,
    });
  }

  return saida;
}

/* ------------------------------------------------------------------ *
 * Preparo
 * ------------------------------------------------------------------ */

export type FalanteResumo = {
  nome: string;
  lado: Lado;
  palavras: number;
  turnos: number;
  confianca: number;
  /**
   * Quais sinais levaram a este lado. Serve à interface — que precisa
   * responder "por que você achou isso?" na faixa de confirmação — e à
   * métrica, que precisa separar decisão fundamentada de palpite por ordem
   * de fala.
   */
  sinais: string[];
};

export type Preparado = {
  textoSeguro: string;
  textoBusca: string;
  textoLimpo: string;
  redacoes: Redacao[];
  turnos: Turno[];
  sentencas: Sentenca[];
  falantes: FalanteResumo[];
  temDiarizacao: boolean;
  /**
   * Só é seguro atribuir dor, objeção e sentimento ao cliente quando sabemos
   * quem falou o quê. Sem isso, o discurso do vendedor entra no briefing como
   * se fosse a voz do cliente.
   */
  podeFiltrarCliente: boolean;
  trechosInaudiveis: number;
  /**
   * A diarização veio picada pelo ASR?
   *
   * Transcrição automática de reunião longa costuma inventar falante: o corpus
   * real do desafio traz mediana de 13 e máximo de 38 "locutores" distintos numa
   * conversa comercial. Reunião de verdade tem duas a seis pessoas.
   *
   * Isso não é detalhe cosmético. Com falante picado, a divisão
   * vendedor/cliente perde sentido e o talk ratio sai em 0,004 — número que
   * parece medição e é ruído. Preferimos não responder a responder errado.
   */
  diarizacaoFragmentada: boolean;
};

/** Acima disto não é reunião com muita gente, é o ASR picando quem falou. */
const LIMITE_FALANTES = 6;

const contarPalavras = (s: string): number => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length;

export function preparar(bruto: string, opcoes?: OpcoesPapeis): Preparado {
  const { texto: textoSeguro, redacoes } = redigir(bruto.replace(/\r\n?/g, '\n'));

  // Base de busca: mesmo comprimento, minúsculo, sem acento.
  let textoBusca = dobrar(textoSeguro);
  if (textoBusca.length !== textoSeguro.length) {
    throw new Error('Dobra de acentos alterou o comprimento do texto.');
  }

  // Timestamps e marcas de inaudível não podem virar match de conteúdo.
  let trechosInaudiveis = 0;
  for (const m of textoSeguro.matchAll(RE_TIMESTAMP)) {
    textoBusca = apagar(textoBusca, m.index, m.index + m[0].length);
  }
  for (const m of textoSeguro.matchAll(RE_INAUDIVEL)) {
    trechosInaudiveis++;
    textoBusca = apagar(textoBusca, m.index, m.index + m[0].length);
  }

  // Diarização
  const rotulos = acharRotulos(textoSeguro);
  const distintos = new Set(rotulos.map((r) => r.falante.toLowerCase()));
  const temDiarizacao = rotulos.length >= 2 && distintos.size >= 2;

  const turnos: Turno[] = [];
  const falas: FalaDoTurno[] = [];

  if (temDiarizacao) {
    for (let i = 0; i < rotulos.length; i++) {
      const atual = rotulos[i] as RotuloAchado;
      const proximo = rotulos[i + 1];
      const fim = proximo ? proximo.inicioRotulo : textoSeguro.length;
      const conteudo = textoSeguro.slice(atual.inicioTexto, fim);
      const palavras = contarPalavras(conteudo);

      // O rótulo em si sai da base de busca — "Ana:" não é conteúdo dito.
      // O cargo vai junto: ele já foi capturado, e como texto falado não é.
      textoBusca = apagar(textoBusca, atual.inicioRotulo, atual.inicioTexto);

      turnos.push({
        falante: atual.falante,
        lado: 'desconhecido',
        ladoConfianca: 0,
        inicio: atual.inicioTexto,
        fim,
        texto: conteudo.trim(),
        palavras,
      });

      falas.push({
        falante: atual.falante,
        texto: conteudo.trim(),
        palavras,
        cargo: atual.cargo,
      });
    }
  }

  /*
   * Lado de cada falante.
   *
   * A decisão em si mora em `papeis.ts`. Aqui ficou só a costura: montar as
   * falas, chamar a inferência e espalhar o resultado pelos turnos. Esta
   * função já anonimiza, diariza e fatia sentenças — classificar papel era o
   * quarto trabalho, e o único que dava para testar sem construir um
   * `Preparado` inteiro.
   */
  const falantes: FalanteResumo[] = [];

  if (temDiarizacao) {
    const porFalante = new Map<string, Turno[]>();
    for (const t of turnos) {
      const chave = t.falante.toLowerCase();
      const lista = porFalante.get(chave) ?? [];
      lista.push(t);
      porFalante.set(chave, lista);
    }

    for (const papel of inferirPapeis(falas, opcoes)) {
      const lista = porFalante.get(papel.nome.toLowerCase()) ?? [];
      falantes.push({
        nome: papel.nome,
        lado: papel.lado,
        palavras: lista.reduce((s, t) => s + t.palavras, 0),
        turnos: lista.length,
        confianca: Number(papel.confianca.toFixed(2)),
        sinais: papel.sinais,
      });
    }

    const ladoDe = new Map(falantes.map((f) => [f.nome.toLowerCase(), f]));
    for (const t of turnos) {
      const f = ladoDe.get(t.falante.toLowerCase());
      if (f) {
        t.lado = f.lado;
        t.ladoConfianca = f.confianca;
      }
    }
  }

  // Sentenças
  const sentencas: Sentenca[] = temDiarizacao
    ? turnos.flatMap((t) => fatiarSentencas(textoSeguro, t.inicio, t.fim, t.falante, t.lado))
    : fatiarSentencas(textoSeguro, 0, textoSeguro.length, null, 'desconhecido');

  // Versão legível para guardar em clean_text — não serve de coordenada.
  const textoLimpo = textoSeguro
    .replace(RE_TIMESTAMP, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const diarizacaoFragmentada = temDiarizacao && falantes.length > LIMITE_FALANTES;

  return {
    textoSeguro,
    textoBusca,
    textoLimpo,
    redacoes,
    turnos,
    sentencas,
    falantes,
    temDiarizacao,
    /*
     * Com falante picado pelo ASR, "esta frase é do cliente" deixa de ser uma
     * afirmação sustentável. Melhor extrair sem atribuir dono do que atribuir
     * dono errado — é a mesma regra que já vale quando não há diarização
     * nenhuma.
     */
    podeFiltrarCliente:
      temDiarizacao && !diarizacaoFragmentada && falantes.some((f) => f.lado === 'cliente'),
    trechosInaudiveis,
    diarizacaoFragmentada,
  };
}
