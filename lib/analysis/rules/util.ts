import type { Evidence, Sentenca } from '../types';
import type { Preparado } from './segment';

/**
 * Utilitários de casamento e evidência.
 *
 * Regra do projeto: item sem evidência rastreável não é retornado. Toda
 * evidência criada aqui é a SENTENÇA que contém o trecho casado — mais legível
 * na interface do que a palavra solta, e ainda assim literal, porque a sentença
 * foi fatiada do próprio texto seguro.
 */

/** Envolve o padrão em fronteiras de palavra que funcionam com grupos. */
export function comLimite(padrao: string): string {
  return `(?<![\\p{L}\\p{N}])(?:${padrao})(?![\\p{L}\\p{N}])`;
}

export function compilar(padrao: string, limite = true): RegExp {
  return new RegExp(limite ? comLimite(padrao) : padrao, 'gu');
}

export type Casamento = {
  inicio: number;
  fim: number;
  /** Trecho literal do texto seguro. */
  texto: string;
};

/** Roda o padrão contra o texto de busca e devolve offsets válidos no texto seguro. */
export function casar(prep: Preparado, padrao: string, limite = true): Casamento[] {
  const re = compilar(padrao, limite);
  const saida: Casamento[] = [];
  for (const m of prep.textoBusca.matchAll(re)) {
    const inicio = m.index;
    const fim = inicio + m[0].length;
    saida.push({ inicio, fim, texto: prep.textoSeguro.slice(inicio, fim) });
  }
  return saida;
}

export function existe(prep: Preparado, padrao: string, limite = true): boolean {
  return compilar(padrao, limite).test(prep.textoBusca);
}

/** A sentença que contém a posição. */
export function sentencaEm(prep: Preparado, pos: number): Sentenca | undefined {
  return prep.sentencas.find((s) => pos >= s.inicio && pos < s.fim);
}

/**
 * Evidência a partir de uma posição no texto.
 * Cai para uma janela de caracteres quando a posição não caiu em nenhuma
 * sentença (texto sem pontuação, por exemplo).
 */
export function evidenciaEm(prep: Preparado, inicio: number, fim: number): Evidence {
  const s = sentencaEm(prep, inicio);

  if (s) {
    return {
      quote: prep.textoSeguro.slice(s.inicio, s.fim),
      start: s.inicio,
      end: s.fim,
      ...(s.falante ? { speaker: s.falante } : {}),
    };
  }

  const ini = Math.max(0, inicio - 60);
  const f = Math.min(prep.textoSeguro.length, fim + 60);
  return { quote: prep.textoSeguro.slice(ini, f), start: ini, end: f };
}

/** Texto de busca da sentença que contém a posição — para checar contexto. */
export function contextoBusca(prep: Preparado, pos: number, janela = 90): string {
  const s = sentencaEm(prep, pos);
  if (s) return prep.textoBusca.slice(s.inicio, s.fim);
  return prep.textoBusca.slice(Math.max(0, pos - janela), Math.min(prep.textoBusca.length, pos + janela));
}

/** Janela de N caracteres ao redor da posição, no texto de busca. */
export function janelaBusca(prep: Preparado, pos: number, antes: number, depois: number): string {
  return prep.textoBusca.slice(Math.max(0, pos - antes), Math.min(prep.textoBusca.length, pos + depois));
}

/**
 * A posição está numa fala do cliente?
 *
 * Sem diarização confiável devolve `true` — o motor não deixa de extrair só
 * porque não sabe quem falou; ele apenas para de afirmar de quem é a dor.
 * Com diarização, isto evita que o discurso do vendedor ("não tem planilha no
 * meio", "nossa integração é nativa") entre no briefing como voz do cliente.
 */
export function ehFalaDoCliente(prep: Preparado, pos: number): boolean {
  if (!prep.podeFiltrarCliente) return true;
  const s = sentencaEm(prep, pos);
  if (!s) return true;
  return s.lado === 'cliente';
}

export function algumPadrao(texto: string, padroes: string[]): boolean {
  return padroes.some((p) => new RegExp(comLimite(p), 'u').test(texto));
}

export function qualPadrao(texto: string, padroes: string[]): string | undefined {
  return padroes.find((p) => new RegExp(comLimite(p), 'u').test(texto));
}

/** Remove itens cuja evidência aponta para a mesma sentença e mesmo rótulo. */
export function dedupPorEvidencia<T extends { evidence: Evidence }>(
  itens: T[],
  chave: (x: T) => string,
): T[] {
  const vistos = new Set<string>();
  const saida: T[] = [];
  for (const item of itens) {
    const k = `${chave(item)}::${item.evidence.start}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    saida.push(item);
  }
  return saida;
}

export const limitar = (n: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, n));

export const contarPalavras = (s: string): number =>
  (s.match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []).length;
