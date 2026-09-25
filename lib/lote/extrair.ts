import { strFromU8, Unzip, UnzipInflate, unzipSync } from 'fflate';
import { contarFalantes, reorganizarFalantes } from './falantes';
import { deDocx, deJson, deLegenda, deXlsx, lerTabela, lerTabelaCsv, pareceLegenda, type TranscricaoComMeta } from './formatos';
import { acharNoManifesto, lerManifesto, metadadosDoCaminho, normalizarData, normalizarTipo } from './metadados';
import { decodificar, desescaparXml, extensao, hashConteudo, nomeBase, normalizarQuebras, semExtensao } from './texto';
import type { Formato, ItemExtraido, ItemTexto, LinhaManifesto, Metadados } from './tipos';

/**
 * De "o que o usuário soltou na tela" para "lista de reuniões a processar".
 *
 * Entra: arquivos soltos, pastas inteiras, zips (inclusive zip dentro de zip).
 * Sai: uma lista em que cada item é uma reunião com texto, um áudio a
 * transcrever, ou um arquivo ignorado COM o motivo. Nada some em silêncio —
 * quem solta cem arquivos precisa conseguir conferir que cem foram contados.
 */

export type Fonte = {
  /** Caminho exibido: "lote.zip › Cliente X/call.vtt". */
  caminho: string;
  /** Pastas entre a raiz do que foi solto e o arquivo — de onde sai o cliente. */
  pastas: string[];
  dados: Blob | Uint8Array;
};

export const EXT_AUDIO = new Set(['mp3', 'm4a', 'wav', 'ogg', 'oga', 'opus', 'webm', 'flac', 'aac', 'wma', 'mp4', 'm4v', 'mov', 'mpeg', 'mpga', 'mkv', '3gp', 'amr']);
const EXT_TEXTO = new Set(['txt', 'md', 'markdown', 'text', 'log', 'rtf', 'odt']);

const MIN_CARACTERES = 20;
/** Acima disto não é transcrição de reunião; é despejo de log ou erro de exportação. */
const MAX_CARACTERES = 1_500_000;
const PROFUNDIDADE_ZIP = 3;

/** Lixo de sistema operacional: não é arquivo do usuário, nem entra na contagem. */
export function ehLixoDeSistema(caminho: string): boolean {
  const partes = caminho.split(/[/›]/).map((p) => p.trim());
  const base = partes[partes.length - 1] ?? '';
  return (
    partes.some((p) => p === '__MACOSX' || p === '.git' || p === 'node_modules') ||
    base.startsWith('._') ||
    base.startsWith('~$') ||
    ['.DS_Store', 'Thumbs.db', 'desktop.ini', '.localized'].includes(base) ||
    (base.startsWith('.') && !base.includes('.', 1))
  );
}

/* ------------------------------------------------------------------ *
 * Zip
 * ------------------------------------------------------------------ */

/** Metade alta da página de código 850 (DOS Latin-1), 0x80–0xFF. */
const CP850 =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜø£Ø×ƒáíóúñÑªº¿®¬½¼¡«»░▒▓│┤ÁÂÀ©╣║╗╝¢¥┐└┴┬├─┼ãÃ╚╔╩╦╠═╬¤ðÐÊËÈıÍÎÏ┘┌█▄¦Ì▀ÓßÔÒõÕµþÞÚÛÙýÝ¯´\u00ad±‗¾¶§÷¸°¨·¹³²■\u00a0';

/**
 * Conserta nome de arquivo dentro de zip criado no Windows.
 *
 * O Explorer grava o nome na página de código do sistema — CP850 num Windows
 * em português — sem marcar o arquivo como UTF-8. O leitor de zip então
 * decodifica como Latin-1, e "Metalúrgica" vira "Metal£rgica". Como o cliente
 * sai do nome da pasta, isso criaria no banco um cliente chamado
 * "Metal£rgica", separado do verdadeiro. O nome volta aos bytes originais e é
 * relido: UTF-8 se for válido (zip de Mac), CP850 se houver evidência dele.
 *
 * "Se houver evidência" é o que impede o conserto de estragar nome certo: um
 * zip marcado como UTF-8 já chega como "Reunião", e esses bytes lidos como
 * CP850 dariam "ReuniÒo". As letras do português em CP850, lidas como
 * Latin-1, caem em caracteres que nenhum nome real contém — controles C1,
 * espaço rígido, ¡ ¢ £ µ ¶ Æ — e só a presença deles autoriza a troca.
 */
const EVIDENCIA_CP850 = /[\u0080-\u00a3\u00b5\u00b6\u00c6]/;

export function consertarNomeZip(nome: string): string {
  if (!/[\u0080-\u00ff]/.test(nome) || /[^\u0000-\u00ff]/.test(nome)) return nome;
  const bytes = Uint8Array.from(nome, (c) => c.charCodeAt(0));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    if (!EVIDENCIA_CP850.test(nome)) return nome;
    return nome.replace(/[\u0080-\u00ff]/g, (c) => CP850[c.charCodeAt(0) - 0x80] ?? c);
  }
}

type Entrada = { nome: string; dados: Blob | Uint8Array };

function entradasDeZipSincrono(bytes: Uint8Array): Entrada[] {
  const arquivos = unzipSync(bytes, { filter: (f) => !f.name.endsWith('/') });
  return Object.entries(arquivos).map(([nome, dados]) => ({ nome: consertarNomeZip(nome), dados }));
}

/**
 * Zip grande (típico de lote de áudio) é lido em fluxo: cada arquivo vira um
 * Blob assim que termina, sem que o zip inteiro precise caber na memória do
 * navegador ao mesmo tempo que o seu conteúdo descomprimido.
 */
async function entradasDeZipEmFluxo(blob: Blob): Promise<Entrada[]> {
  const entradas: Entrada[] = [];
  let erro: Error | null = null;
  const uz = new Unzip((arq) => {
    if (arq.name.endsWith('/')) return;
    const partes: Uint8Array[] = [];
    arq.ondata = (e, dat, final) => {
      if (e) {
        erro = e;
        return;
      }
      partes.push(dat);
      if (final) entradas.push({ nome: consertarNomeZip(arq.name), dados: new Blob(partes as BlobPart[]) });
    };
    arq.start();
  });
  uz.register(UnzipInflate);

  const leitor = blob.stream().getReader();
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) {
      uz.push(new Uint8Array(0), true);
      break;
    }
    uz.push(value);
    if (erro) throw erro;
  }
  if (erro) throw erro;
  return entradas;
}

const LIMITE_ZIP_EM_MEMORIA = 200 * 1024 * 1024;

export async function abrirZip(dados: Blob | Uint8Array): Promise<Entrada[]> {
  if (dados instanceof Uint8Array) return entradasDeZipSincrono(dados);
  if (dados.size <= LIMITE_ZIP_EM_MEMORIA) {
    return entradasDeZipSincrono(new Uint8Array(await dados.arrayBuffer()));
  }
  try {
    return await entradasDeZipEmFluxo(dados);
  } catch (e) {
    throw new Error(
      `Não foi possível ler o zip em fluxo (${e instanceof Error ? e.message : String(e)}). ` +
        'Zips acima de 200 MB precisam ser divididos ou enviados como pasta.',
    );
  }
}

/* ------------------------------------------------------------------ *
 * Formatos de documento simples
 * ------------------------------------------------------------------ */

/** RTF (TextEdit, WordPad): tira grupos de controle e palavras de controle. */
export function deRtf(rtf: string): string {
  return rtf
    .replace(/\\'([0-9a-f]{2})/gi, (_, h: string) => String.fromCharCode(parseInt(h, 16)))
    .replace(/\\u(-?\d+)\??/g, (_, n: string) => String.fromCharCode((Number(n) + 65536) % 65536))
    .replace(/\{\\\*[^{}]*\}/g, '')
    .replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|pict)[\s\S]*?\}\s*(?=\\|\{|$)/g, '')
    .replace(/\\(?:par|line)\b ?/g, '\n')
    .replace(/\\tab\b ?/g, '\t')
    .replace(/\\[a-z]+-?\d* ?/gi, '')
    .replace(/[{}]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** ODT (LibreOffice): zip com content.xml, parágrafos em text:p e text:h. */
export function deOdt(bytes: Uint8Array): string {
  const xml = unzipSync(bytes, { filter: (f) => f.name === 'content.xml' })['content.xml'];
  if (!xml) throw new Error('ODT sem content.xml — o arquivo pode estar corrompido.');
  return strFromU8(xml)
    .split(/<\/text:(?:p|h)>/)
    .map((p) => desescaparXml(p.replace(/<text:tab\/>/g, '\t').replace(/<text:line-break\/>/g, '\n').replace(/<[^>]+>/g, '')).trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ------------------------------------------------------------------ *
 * Montagem dos itens
 * ------------------------------------------------------------------ */

function itemTexto(
  caminho: string,
  pastas: string[],
  formato: ItemTexto['formato'],
  bruto: string,
  extra?: Partial<TranscricaoComMeta> & { sufixo?: string; encoding?: string },
): ItemExtraido {
  const texto = normalizarQuebras(bruto).trim();
  const exibido = extra?.sufixo ? `${caminho} › ${extra.sufixo}` : caminho;
  if (texto.length < MIN_CARACTERES) {
    return { tipo: 'ignorado', caminho: exibido, motivo: `Texto curto demais (${texto.length} caracteres; mínimo ${MIN_CARACTERES}).` };
  }
  if (texto.length > MAX_CARACTERES) {
    return { tipo: 'ignorado', caminho: exibido, motivo: `Texto grande demais (${(texto.length / 1e6).toFixed(1)} milhões de caracteres) — não parece uma reunião.` };
  }
  const base = metadadosDoCaminho(caminho, pastas);
  const meta: Metadados = {
    titulo: extra?.titulo?.trim() || (extra?.sufixo ? `${base.titulo} ${extra.sufixo}`.trim() : base.titulo),
    data: normalizarData(extra?.data) ?? base.data,
    cliente: extra?.cliente?.trim() || base.cliente,
    tipo: normalizarTipo(extra?.tipo) ?? base.tipo,
  };
  return {
    tipo: 'texto',
    caminho: exibido,
    formato,
    texto,
    falantes: contarFalantes(texto),
    meta,
    ...(extra?.encoding ? { encoding: extra.encoding } : {}),
  };
}

function reunioesDeLista(caminho: string, pastas: string[], formato: ItemTexto['formato'], lista: TranscricaoComMeta[]): ItemExtraido[] {
  if (lista.length === 1) return [itemTexto(caminho, pastas, formato, reorganizarFalantes(lista[0]!.texto), lista[0])];
  return lista.map((r, i) =>
    itemTexto(caminho, pastas, formato, reorganizarFalantes(normalizarQuebras(r.texto)), { ...r, sufixo: `#${i + 1}` }),
  );
}

async function bytesDe(dados: Blob | Uint8Array): Promise<Uint8Array> {
  return dados instanceof Uint8Array ? dados : new Uint8Array(await dados.arrayBuffer());
}

type Coleta = { itens: ItemExtraido[]; manifestos: LinhaManifesto[] };

async function extrairFonte(f: Fonte, coleta: Coleta, profundidade: number): Promise<void> {
  const { caminho, pastas } = f;
  if (ehLixoDeSistema(caminho)) return;
  const ext = extensao(caminho);
  const push = (...i: ItemExtraido[]): void => {
    coleta.itens.push(...i);
  };
  const ignorar = (motivo: string): void => push({ tipo: 'ignorado', caminho, motivo });

  try {
    if (ext === 'zip') {
      if (profundidade >= PROFUNDIDADE_ZIP) return ignorar('Zip aninhado em mais de três níveis.');
      const entradas = await abrirZip(f.dados);
      if (entradas.length === 0) return ignorar('Zip vazio.');
      for (const e of entradas) {
        const partes = e.nome.split('/').filter(Boolean);
        // O nome do zip conta como pasta: "Metalúrgica Vale Verde.zip" diz de
        // quem são as reuniões tanto quanto uma pasta com esse nome diria.
        const pastaDoZip = semExtensao(nomeBase(caminho.split(' › ').pop() ?? caminho));
        await extrairFonte(
          { caminho: `${caminho} › ${partes.join('/')}`, pastas: [...pastas, pastaDoZip, ...partes.slice(0, -1)], dados: e.dados },
          coleta,
          profundidade + 1,
        );
      }
      return;
    }

    if (EXT_AUDIO.has(ext)) {
      const blob = f.dados instanceof Blob ? f.dados : new Blob([f.dados as BlobPart]);
      if (blob.size === 0) return ignorar('Arquivo de áudio vazio.');
      const meta = metadadosDoCaminho(caminho, pastas);
      return push({ tipo: 'audio', formato: 'audio', caminho, dados: blob, mime: mimeDeAudio(ext), meta });
    }

    if (ext === 'pdf') {
      return ignorar('PDF não é lido: o texto de PDF sai sem ordem de leitura garantida. Exporte a transcrição como .txt, .docx ou .vtt.');
    }
    if (ext === 'doc') return ignorar('Formato .doc antigo. Abra no Word e salve como .docx.');
    if (ext === 'xls') return ignorar('Formato .xls antigo. Salve como .xlsx ou .csv.');
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'svg', 'bmp', 'tif', 'tiff'].includes(ext)) {
      return ignorar('Imagem não contém transcrição.');
    }

    const bytes = await bytesDe(f.dados);

    if (ext === 'docx') return push(itemTexto(caminho, pastas, 'docx', reorganizarFalantes(deDocx(bytes))));
    if (ext === 'odt') return push(itemTexto(caminho, pastas, 'docx', reorganizarFalantes(deOdt(bytes))));

    if (ext === 'xlsx') {
      const leitura = lerTabela(deXlsx(bytes));
      return tratarTabela(leitura, caminho, pastas, 'xlsx', coleta);
    }

    const { texto: bruto, encoding } = decodificar(bytes);
    const texto = normalizarQuebras(bruto);
    const extra = encoding !== 'utf-8' ? { encoding } : undefined;

    if (ext === 'vtt' || ext === 'srt' || ext === 'sbv') {
      return push(itemTexto(caminho, pastas, ext === 'srt' ? 'srt' : 'vtt', deLegenda(texto), extra));
    }
    if (ext === 'json') {
      const lista = deJson(texto);
      if (lista.length === 0) return ignorar('JSON sem transcrição reconhecível (procurei texto, falas, segmentos e utterances).');
      return push(...reunioesDeLista(caminho, pastas, 'json', lista));
    }
    if (ext === 'csv' || ext === 'tsv') return tratarTabela(lerTabelaCsv(texto), caminho, pastas, 'csv', coleta);

    if (EXT_TEXTO.has(ext) || ext === '') {
      const conteudo = ext === 'rtf' ? deRtf(texto) : texto;
      if (pareceLegenda(conteudo)) return push(itemTexto(caminho, pastas, 'vtt', deLegenda(conteudo), extra));
      return push(itemTexto(caminho, pastas, 'txt', reorganizarFalantes(conteudo), extra));
    }

    return ignorar(`Extensão .${ext} não reconhecida.`);
  } catch (e) {
    return ignorar(`Não foi possível ler: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function tratarTabela(
  leitura: ReturnType<typeof lerTabela>,
  caminho: string,
  pastas: string[],
  formato: 'csv' | 'xlsx',
  coleta: Coleta,
): void {
  if (leitura.forma === 'reunioes') {
    if (leitura.reunioes.length === 0) {
      coleta.itens.push({ tipo: 'ignorado', caminho, motivo: 'Planilha sem nenhuma linha com transcrição.' });
      return;
    }
    coleta.itens.push(...reunioesDeLista(caminho, pastas, formato, leitura.reunioes));
  } else if (leitura.forma === 'falas') {
    coleta.itens.push(itemTexto(caminho, pastas, formato, leitura.texto));
  } else if (leitura.forma === 'manifesto') {
    coleta.manifestos.push(...lerManifesto(leitura.linhas));
  } else {
    coleta.itens.push({
      tipo: 'ignorado',
      caminho,
      motivo: `Planilha sem coluna de transcrição, de fala ou de arquivo. Colunas encontradas: ${leitura.colunas.slice(0, 6).join(', ') || 'nenhuma'}.`,
    });
  }
}

export function mimeDeAudio(ext: string): string {
  const mapa: Record<string, string> = {
    mp3: 'audio/mpeg', mpga: 'audio/mpeg', mpeg: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac',
    wav: 'audio/wav', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', webm: 'audio/webm',
    flac: 'audio/flac', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', mkv: 'video/x-matroska',
    wma: 'audio/x-ms-wma', '3gp': 'video/3gpp', amr: 'audio/amr',
  };
  return mapa[ext] ?? 'application/octet-stream';
}

export type ResultadoExtracao = {
  itens: ItemExtraido[];
  /** Quantas linhas de manifesto foram lidas, e quantas casaram com algum arquivo. */
  manifesto: { linhas: number; aplicadas: number };
};

/**
 * Extrai tudo e aplica o manifesto. Duplicatas de conteúdo dentro do lote
 * viram "ignorado" apontando para a primeira ocorrência — exportar a mesma
 * reunião em .vtt e em .docx é comum, e analisar as duas dobraria a
 * contagem de objeções da conta.
 */
export async function extrair(
  fontes: Fonte[],
  aoAvancar?: (feitos: number, total: number, caminho: string) => void,
): Promise<ResultadoExtracao> {
  const coleta: Coleta = { itens: [], manifestos: [] };
  for (let i = 0; i < fontes.length; i++) {
    aoAvancar?.(i, fontes.length, fontes[i]!.caminho);
    await extrairFonte(fontes[i]!, coleta, 0);
  }
  aoAvancar?.(fontes.length, fontes.length, '');

  let aplicadas = 0;
  if (coleta.manifestos.length) {
    for (const item of coleta.itens) {
      if (item.tipo === 'ignorado') continue;
      const alvo = item.caminho.split(' › ').pop() ?? item.caminho;
      const linha = acharNoManifesto(alvo, coleta.manifestos);
      if (!linha) continue;
      aplicadas++;
      item.meta = {
        titulo: linha.titulo ?? item.meta.titulo,
        cliente: linha.cliente ?? item.meta.cliente,
        data: linha.data ?? item.meta.data,
        tipo: linha.tipo ?? item.meta.tipo,
      };
    }
  }

  const vistos = new Map<string, string>();
  const itens = coleta.itens.map((item): ItemExtraido => {
    if (item.tipo !== 'texto') return item;
    const h = hashConteudo(item.texto);
    const primeiro = vistos.get(h);
    if (primeiro) return { tipo: 'ignorado', caminho: item.caminho, motivo: `Conteúdo idêntico a ${nomeBase(primeiro)} — importado uma vez só.` };
    vistos.set(h, item.caminho);
    return item;
  });

  return { itens, manifesto: { linhas: coleta.manifestos.length, aplicadas } };
}

export type { Formato };
