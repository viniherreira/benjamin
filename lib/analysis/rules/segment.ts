import type { Lado, Sentenca, Turno } from '../types';
import { redigir } from './redact';
import type { Redacao } from '../types';

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

// "Ana:", "ANA SILVA:", "[Ana]", "João (TOTVS):"
const RE_ROTULO = /^[ \t>-]*(?:\[([^\]\n]{2,45})\]|([\p{Lu}][\p{L}.\- ]{1,40}?)(?:\s*\([^)\n]{1,30}\))?)\s*:[ \t]/u;

const PALAVRAS_NAO_FALANTE = new Set([
  'obs', 'nota', 'ps', 'atenção', 'atencao', 'resumo', 'obrigado', 'olha', 'veja',
  'exemplo', 'importante', 'link', 'http', 'https', 'obs.', 'pauta', 'agenda',
]);

type RotuloAchado = { falante: string; inicioRotulo: number; inicioTexto: number };

function acharRotulos(textoSeguro: string): RotuloAchado[] {
  const achados: RotuloAchado[] = [];
  let offset = 0;

  for (const linha of textoSeguro.split('\n')) {
    const m = RE_ROTULO.exec(linha);
    if (m) {
      const bruto = (m[1] ?? m[2] ?? '').trim();
      const chave = bruto.toLowerCase().replace(/[.:]/g, '');
      const palavras = chave.split(/\s+/).filter(Boolean).length;

      if (bruto && palavras <= 4 && !PALAVRAS_NAO_FALANTE.has(chave)) {
        achados.push({
          falante: bruto,
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
 * Classificação de lado
 * ------------------------------------------------------------------ */

const MARCAS_VENDEDOR: RegExp[] = [
  /\bnossa (solucao|plataforma|ferramenta|equipe|implantacao|consultoria)\b/,
  /\bnosso (produto|time de implantacao|suporte tecnico)\b/,
  /\baqui na totvs\b/,
  /\bna totvs (a gente|nos)\b/,
  /\bposso te (mostrar|enviar|mandar|apresentar)\b/,
  /\bvou te (mostrar|enviar|mandar|passar)\b/,
  /\bconseguimos (entregar|implantar|fazer)\b/,
  /\bo que a gente entrega\b/,
  /\bdeixa eu (te mostrar|compartilhar)\b/,
  /\bfico de (mandar|enviar|passar)\b/,
];

const MARCAS_CLIENTE: RegExp[] = [
  /\ba gente (precisa|sofre|usa|tem|ta com|esta com|nao consegue)\b/,
  /\bo nosso (time|pessoal|erp|sistema|financeiro|rh)\b/,
  /\bvoces (conseguem|tem|fazem|entregam|cobram)\b/,
  /\bmeu (cfo|ceo|diretor|chefe|socio)\b/,
  /\bnossa empresa\b/,
  /\baqui (na nossa empresa|na empresa|dentro de casa)\b/,
  /\bpreciso (aprovar|levar|validar) (com|para|pra)\b/,
  /\bo pessoal (do|da|de)\b/,
];

function pontuarLado(textoBusca: string): { vendedor: number; cliente: number } {
  let vendedor = 0;
  let cliente = 0;
  for (const re of MARCAS_VENDEDOR) if (re.test(textoBusca)) vendedor++;
  for (const re of MARCAS_CLIENTE) if (re.test(textoBusca)) cliente++;
  return { vendedor, cliente };
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
};

const contarPalavras = (s: string): number => (s.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length;

export function preparar(bruto: string): Preparado {
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

  if (temDiarizacao) {
    for (let i = 0; i < rotulos.length; i++) {
      const atual = rotulos[i] as RotuloAchado;
      const proximo = rotulos[i + 1];
      const fim = proximo ? proximo.inicioRotulo : textoSeguro.length;
      const conteudo = textoSeguro.slice(atual.inicioTexto, fim);

      // O rótulo em si sai da base de busca — "Ana:" não é conteúdo dito.
      textoBusca = apagar(textoBusca, atual.inicioRotulo, atual.inicioTexto);

      turnos.push({
        falante: atual.falante,
        lado: 'desconhecido',
        ladoConfianca: 0,
        inicio: atual.inicioTexto,
        fim,
        texto: conteudo.trim(),
        palavras: contarPalavras(conteudo),
      });
    }
  }

  // Lado de cada falante, somando as marcas de todos os turnos dele.
  const falantes: FalanteResumo[] = [];

  if (temDiarizacao) {
    const porFalante = new Map<string, Turno[]>();
    for (const t of turnos) {
      const chave = t.falante.toLowerCase();
      const lista = porFalante.get(chave) ?? [];
      lista.push(t);
      porFalante.set(chave, lista);
    }

    const pontos = new Map<string, { vendedor: number; cliente: number }>();
    for (const [chave, lista] of porFalante) {
      const junto = lista.map((t) => dobrar(t.texto)).join(' ');
      pontos.set(chave, pontuarLado(junto));
    }

    for (const [chave, lista] of porFalante) {
      const p = pontos.get(chave) ?? { vendedor: 0, cliente: 0 };
      let lado: Lado = 'desconhecido';
      let confianca = 0;

      if (p.vendedor > p.cliente) {
        lado = 'vendedor';
        confianca = Math.min(1, (p.vendedor - p.cliente) / 3);
      } else if (p.cliente > p.vendedor) {
        lado = 'cliente';
        confianca = Math.min(1, (p.cliente - p.vendedor) / 3);
      }

      const primeiro = lista[0] as Turno;
      falantes.push({
        nome: primeiro.falante,
        lado,
        palavras: lista.reduce((s, t) => s + t.palavras, 0),
        turnos: lista.length,
        confianca: Number(confianca.toFixed(2)),
      });
    }

    // Desempate: com dois falantes e só um identificado, o outro é o oposto.
    if (falantes.length === 2) {
      const [a, b] = falantes as [FalanteResumo, FalanteResumo];
      if (a.lado !== 'desconhecido' && b.lado === 'desconhecido') {
        b.lado = a.lado === 'vendedor' ? 'cliente' : 'vendedor';
        b.confianca = 0.3;
      } else if (b.lado !== 'desconhecido' && a.lado === 'desconhecido') {
        a.lado = b.lado === 'vendedor' ? 'cliente' : 'vendedor';
        a.confianca = 0.3;
      }
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

  return {
    textoSeguro,
    textoBusca,
    textoLimpo,
    redacoes,
    turnos,
    sentencas,
    falantes,
    temDiarizacao,
    podeFiltrarCliente: temDiarizacao && falantes.some((f) => f.lado === 'cliente'),
    trechosInaudiveis,
  };
}
