/**
 * Utilidades de texto do importador: decodificação, CSV, XML e hash.
 *
 * Nada aqui depende do navegador. TextDecoder existe no Node e em todo
 * navegador moderno.
 */

/**
 * Decodifica bytes de um arquivo de texto sem saber de onde ele veio.
 *
 * O caso que motivou isto: .txt exportado por ferramenta Windows em português
 * sai em Windows-1252, e lido como UTF-8 vira "reuni�o" — o motor deixa de
 * reconhecer "não", "reunião", "cotação", e a análise degrada sem nenhum erro
 * visível. UTF-8 estrito primeiro; se falhar, Windows-1252, que é o que sobra
 * na prática para texto em português.
 */
export function decodificar(bytes: Uint8Array): { texto: string; encoding: string } {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { texto: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8' };
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { texto: new TextDecoder('utf-16le').decode(bytes.subarray(2)), encoding: 'utf-16le' };
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { texto: new TextDecoder('utf-16be').decode(bytes.subarray(2)), encoding: 'utf-16be' };
  }
  try {
    return { texto: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { texto: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' };
  }
}

/** \r\n, \r solto e caractere nulo — o motor trabalha linha a linha. */
export function normalizarQuebras(texto: string): string {
  return texto.replace(/\r\n?/g, '\n').replace(/\u0000/g, '').replace(/[\u2028\u2029]/g, '\n');
}

const ENTIDADES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function desescaparXml(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e: string) => {
    if (e[0] === '#') {
      const cp = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(cp) ? String.fromCodePoint(cp) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

/**
 * CSV com aspas (RFC 4180) e separador descoberto pela primeira linha.
 * Excel em português exporta com ";" — assumir vírgula quebraria toda planilha
 * que chega de um gestor comercial brasileiro.
 */
export function lerCsv(texto: string): string[][] {
  const limpo = normalizarQuebras(texto).replace(/^﻿/, '');
  const primeira = limpo.slice(0, limpo.indexOf('\n') === -1 ? undefined : limpo.indexOf('\n'));
  const candidatos = [';', ',', '\t', '|'];
  const sep = candidatos
    .map((c) => ({ c, n: primeira.split(c).length }))
    .sort((a, b) => b.n - a.n)[0]!.c;

  const linhas: string[][] = [];
  let campo = '';
  let linha: string[] = [];
  let aspas = false;

  for (let i = 0; i < limpo.length; i++) {
    const ch = limpo[i]!;
    if (aspas) {
      if (ch === '"') {
        if (limpo[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += ch;
    } else if (ch === '"' && campo === '') aspas = true;
    else if (ch === sep) {
      linha.push(campo);
      campo = '';
    } else if (ch === '\n') {
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = '';
    } else campo += ch;
  }
  if (campo !== '' || linha.length > 0) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.filter((l) => l.some((c) => c.trim() !== ''));
}

/** Chave de coluna comparável: minúscula, sem acento, sem espaço nem pontuação. */
export function chaveColuna(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Hash de conteúdo para achar duplicata dentro do lote (cyrb53).
 *
 * Não é criptográfico e não precisa ser: a pergunta é "estas duas transcrições
 * são a mesma?", e a normalização antes do hash faz "a mesma com outra quebra
 * de linha" contar como a mesma.
 */
export function hashConteudo(texto: string): string {
  const s = texto.toLowerCase().replace(/\s+/g, ' ').trim();
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function nomeBase(caminho: string): string {
  return caminho.split('/').pop() ?? caminho;
}

export function extensao(caminho: string): string {
  const base = nomeBase(caminho);
  const i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.slice(i + 1).toLowerCase();
}

export function semExtensao(nome: string): string {
  const i = nome.lastIndexOf('.');
  return i <= 0 ? nome : nome.slice(0, i);
}
