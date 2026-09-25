import type { Fonte } from '@/lib/lote/extrair';

/**
 * Transforma o que o navegador entrega (arquivos soltos, pasta escolhida,
 * pasta ou zip arrastado) em Fontes com caminho e pastas.
 *
 * SÓ NAVEGADOR.
 */

/** input type=file (múltiplo ou webkitdirectory). */
export function fontesDeLista(lista: FileList | File[]): Fonte[] {
  return Array.from(lista).map((arquivo) => {
    const relativo = (arquivo as File & { webkitRelativePath?: string }).webkitRelativePath || arquivo.name;
    const partes = relativo.split('/').filter(Boolean);
    return { caminho: partes.join('/'), pastas: partes.slice(0, -1), dados: arquivo };
  });
}

function arquivoDe(entrada: FileSystemFileEntry): Promise<File> {
  return new Promise((ok, erro) => entrada.file(ok, erro));
}

/**
 * readEntries() devolve os filhos em lotes — no Chrome, no máximo 100 por
 * chamada — e sinaliza o fim com um lote vazio. Ler uma vez só perde
 * silenciosamente tudo a partir do 101º arquivo da pasta, que é exatamente o
 * tamanho de lote que este importador existe para aceitar.
 */
async function lerTodosOsFilhos(pasta: FileSystemDirectoryEntry): Promise<FileSystemEntry[]> {
  const leitor = pasta.createReader();
  const todos: FileSystemEntry[] = [];
  for (;;) {
    const lote = await new Promise<FileSystemEntry[]>((ok, erro) => leitor.readEntries(ok, erro));
    if (lote.length === 0) return todos;
    todos.push(...lote);
  }
}

async function percorrer(entrada: FileSystemEntry, pastas: string[], saida: Fonte[]): Promise<void> {
  if (entrada.isFile) {
    const arquivo = await arquivoDe(entrada as FileSystemFileEntry);
    saida.push({ caminho: [...pastas, arquivo.name].join('/'), pastas, dados: arquivo });
    return;
  }
  if (entrada.isDirectory) {
    for (const filho of await lerTodosOsFilhos(entrada as FileSystemDirectoryEntry)) {
      await percorrer(filho, [...pastas, entrada.name], saida);
    }
  }
}

/** Arrastar e soltar: arquivos, pastas inteiras (recursivo) e zips. */
export async function fontesDeArraste(dt: DataTransfer): Promise<Fonte[]> {
  // As entradas precisam ser capturadas antes do primeiro await: depois dele o
  // navegador invalida o DataTransfer.
  const entradas = Array.from(dt.items)
    .filter((i) => i.kind === 'file')
    .map((i) => (typeof i.webkitGetAsEntry === 'function' ? i.webkitGetAsEntry() : null));

  if (entradas.every((e) => e === null)) return fontesDeLista(dt.files);

  const saida: Fonte[] = [];
  for (const e of entradas) if (e) await percorrer(e, [], saida);
  return saida;
}
