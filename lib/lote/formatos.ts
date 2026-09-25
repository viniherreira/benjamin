import { strFromU8, unzipSync } from 'fflate';
import { criarNormalizador, montarTranscricao, type Fala } from './falantes';
import { chaveColuna, desescaparXml, lerCsv } from './texto';

/* ------------------------------------------------------------------ *
 * Legendas: WebVTT (Teams, Zoom, Meet, YouTube) e SRT.
 * ------------------------------------------------------------------ */

const RE_SETA = /(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/;

/** Tem cara de legenda mesmo com extensão .txt? Três setas de tempo bastam. */
export function pareceLegenda(texto: string): boolean {
  let n = 0;
  for (const linha of texto.split('\n', 400)) if (RE_SETA.test(linha) && ++n >= 3) return true;
  return false;
}

function segundos(carimbo: string): number {
  const p = carimbo.replace(',', '.').split(':').map(Number);
  return p.reduce((acc, v) => acc * 60 + v, 0);
}

export function deLegenda(texto: string): string {
  const normalizar = criarNormalizador();
  const falas: (Fala & { inicio: number; fim: number })[] = [];
  let ultimaLinha = '';

  for (const bloco of texto.split(/\n\s*\n/)) {
    const linhas = bloco.split('\n').map((l) => l.trim()).filter(Boolean);
    const iSeta = linhas.findIndex((l) => RE_SETA.test(l));
    if (iSeta === -1) continue; // cabeçalho WEBVTT, NOTE, STYLE, REGION

    const [ini, fim] = linhas[iSeta]!.split('-->').map((s) => segundos(s.trim().split(/\s/)[0]!));
    let falante: string | null = null;
    const partes: string[] = [];

    for (let l of linhas.slice(iSeta + 1)) {
      const voz = /<v(?:\.[^\s>]+)?\s+([^>]+)>/.exec(l); // Teams: <v Ana Torres>
      if (voz) falante = normalizar(voz[1]);
      l = l.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ');
      l = desescaparXml(l).trim();
      if (!falante) {
        const rotulo = /^([^:]{2,45}):\s+(.*)$/.exec(l); // Zoom: "Ana Torres: Olá"
        if (rotulo && !/\d{1,2}:\d{2}/.test(rotulo[1]!)) {
          falante = normalizar(rotulo[1]);
          l = rotulo[2]!;
        }
      }
      l = l.replace(/^-\s+/, ''); // travessão de diálogo no SRT
      // Legenda "rolante" do YouTube repete a linha anterior no cue seguinte.
      if (l && l !== ultimaLinha) {
        partes.push(l);
        ultimaLinha = l;
      }
    }
    if (partes.length) falas.push({ falante, texto: partes.join(' '), inicio: ini ?? 0, fim: fim ?? 0 });
  }

  const comNome = falas.some((f) => f.falante);
  if (comNome) return montarTranscricao(falas);

  // Sem falante em lugar nenhum: parágrafo novo a cada pausa de 2 s ou mais,
  // que é o melhor indício disponível de troca de turno.
  const paragrafos: string[] = [];
  let atual = '';
  let fimAnterior = 0;
  for (const f of falas) {
    if (atual && f.inicio - fimAnterior >= 2) {
      paragrafos.push(atual.trim());
      atual = '';
    }
    atual += ` ${f.texto}`;
    fimAnterior = f.fim;
  }
  if (atual.trim()) paragrafos.push(atual.trim());
  return paragrafos.join('\n');
}

/* ------------------------------------------------------------------ *
 * JSON: Whisper, AssemblyAI, Deepgram, Rev, Fireflies, Otter, Zoom — e
 * lista de reuniões exportada de planilha ou CRM.
 * ------------------------------------------------------------------ */

const CHAVES_TEXTO = ['text', 'texto', 'transcript', 'transcricao', 'content', 'conteudo', 'fala', 'message', 'mensagem', 'sentence', 'value', 'utterance'];
const CHAVES_FALANTE = ['speaker', 'speakername', 'speakerlabel', 'speakerid', 'falante', 'orador', 'participant', 'participante', 'name', 'nome', 'author', 'autor', 'user', 'usuario'];
const CHAVES_TITULO = ['title', 'titulo', 'topic', 'assunto', 'meetingtitle', 'subject', 'name', 'nome'];
const CHAVES_DATA = ['date', 'data', 'starttime', 'start', 'meetingdate', 'datareuniao', 'createdat', 'created', 'datetime'];
const CHAVES_CLIENTE = ['cliente', 'client', 'customer', 'empresa', 'company', 'conta', 'account', 'organizacao', 'organization'];
const CHAVES_TIPO = ['tipo', 'type', 'meetingtype', 'etapa', 'stage'];

type Obj = Record<string, unknown>;
const ehObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);

function campo(o: Obj, chaves: string[]): unknown {
  for (const [k, v] of Object.entries(o)) if (chaves.includes(chaveColuna(k))) return v;
  return undefined;
}

function textoDe(o: Obj): string | null {
  const direto = campo(o, CHAVES_TEXTO);
  if (typeof direto === 'string') return direto;
  // Palavras soltas: Deepgram/Rev guardam a fala em words[] ou elements[].
  for (const k of ['words', 'elements', 'tokens']) {
    const lista = o[k];
    if (Array.isArray(lista) && lista.length) {
      const juntas = lista
        .map((w) => (ehObj(w) ? (w.punctuated_word ?? w.word ?? w.value ?? w.text) : w))
        .filter((w): w is string => typeof w === 'string')
        .join(' ')
        .replace(/\s+([.,!?;:])/g, '$1');
      if (juntas.trim()) return juntas;
    }
  }
  return null;
}

function falanteDe(o: Obj): string | number | null {
  const v = campo(o, CHAVES_FALANTE);
  if (typeof v === 'string' || typeof v === 'number') return v;
  if (ehObj(v)) {
    const n = campo(v, ['name', 'nome', 'displayname']);
    if (typeof n === 'string') return n;
  }
  return null;
}

/** A maior lista de falas dentro do objeto, onde quer que ela esteja. */
function acharFalas(raiz: unknown): Obj[] | null {
  let melhor: Obj[] | null = null;
  let melhorPeso = 0;
  const visitar = (v: unknown, prof: number) => {
    if (prof > 6) return;
    if (Array.isArray(v)) {
      const objs = v.filter(ehObj);
      if (objs.length >= 2 && objs.length >= v.length * 0.8) {
        const comTexto = objs.filter((o) => textoDe(o) !== null);
        if (comTexto.length >= objs.length * 0.6) {
          const peso = comTexto.reduce((s, o) => s + (textoDe(o)?.length ?? 0), 0);
          if (peso > melhorPeso) {
            melhor = objs;
            melhorPeso = peso;
          }
        }
      }
      v.forEach((x) => visitar(x, prof + 1));
    } else if (ehObj(v)) Object.values(v).forEach((x) => visitar(x, prof + 1));
  };
  visitar(raiz, 0);
  return melhor;
}

function transcricaoDeObjeto(o: unknown): string | null {
  const falas = acharFalas(o);
  if (falas) {
    const normalizar = criarNormalizador();
    return montarTranscricao(falas.map((f) => ({ falante: normalizar(falanteDe(f)), texto: textoDe(f) ?? '' })));
  }
  if (ehObj(o)) {
    const t = textoDe(o);
    if (t && t.trim().length >= 20) return t;
    // Deepgram: results.channels[0].alternatives[0].transcript
    for (const v of Object.values(o)) {
      const sub = transcricaoDeObjeto(v);
      if (sub) return sub;
    }
  }
  return null;
}

export type TranscricaoComMeta = {
  texto: string;
  titulo?: string;
  data?: string;
  cliente?: string;
  tipo?: string;
};

function metaDe(o: Obj): Omit<TranscricaoComMeta, 'texto'> {
  const s = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
  const titulo = campo(o, CHAVES_TITULO);
  return {
    titulo: typeof titulo === 'string' && titulo.length <= 160 ? titulo.trim() : undefined,
    data: s(campo(o, CHAVES_DATA)),
    cliente: s(campo(o, CHAVES_CLIENTE)),
    tipo: s(campo(o, CHAVES_TIPO)),
  };
}

/**
 * Um JSON pode ser UMA reunião (formato de provedor de transcrição) ou VÁRIAS
 * (lista exportada de CRM ou planilha). A distinção: uma lista em que cada
 * item carrega sua própria transcrição longa — ou sua própria lista de falas —
 * é uma lista de reuniões.
 */
export function deJson(texto: string): TranscricaoComMeta[] {
  let raiz: unknown;
  try {
    raiz = JSON.parse(texto);
  } catch {
    return [];
  }

  const candidatas = Array.isArray(raiz)
    ? raiz
    : ehObj(raiz)
      ? (Object.values(raiz).find((v) => Array.isArray(v) && v.some(ehObj)) as unknown[] | undefined)
      : undefined;

  if (candidatas && candidatas.length >= 1) {
    const reunioes = candidatas.filter(ehObj).flatMap((o) => {
      const direto = campo(o, ['transcript', 'transcricao', 'texto', 'text', 'conteudo', 'content']);
      if (typeof direto === 'string' && direto.trim().length >= 200) return [{ texto: direto, ...metaDe(o) }];
      const aninhada = Object.values(o).some((v) => Array.isArray(v) && v.length >= 2 && v.every(ehObj));
      if (aninhada) {
        const t = transcricaoDeObjeto(o);
        if (t) return [{ texto: t, ...metaDe(o) }];
      }
      return [];
    });
    if (reunioes.length >= 1 && reunioes.length >= candidatas.length * 0.5) return reunioes;
  }

  const unica = transcricaoDeObjeto(raiz);
  if (!unica) return [];
  return [{ texto: unica, ...(ehObj(raiz) ? metaDe(raiz) : {}) }];
}

/* ------------------------------------------------------------------ *
 * DOCX e XLSX são zip de XML. Lidos com o mesmo fflate do zip, sem
 * biblioteca de escritório.
 * ------------------------------------------------------------------ */

export function deDocx(bytes: Uint8Array): string {
  const arquivos = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' });
  const xml = arquivos['word/document.xml'];
  if (!xml) throw new Error('DOCX sem word/document.xml — o arquivo pode estar corrompido.');
  const doc = strFromU8(xml);

  // Texto, tabulação e quebra, na ordem em que aparecem em cada parágrafo.
  return doc
    .split(/<\/w:p>/)
    .map((p) =>
      desescaparXml(
        [...p.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>|<w:tab\/>|<w:br[^>]*\/>/g)]
          .map((m) => (m[1] !== undefined ? m[1] : m[0].startsWith('<w:tab') ? '\t' : '\n'))
          .join(''),
      ).trimEnd(),
    )
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function colunaParaIndice(ref: string): number {
  const letras = /^[A-Z]+/.exec(ref)?.[0] ?? 'A';
  return [...letras].reduce((n, c) => n * 26 + (c.charCodeAt(0) - 64), 0) - 1;
}

/** Primeira planilha de um XLSX como linhas de texto. */
export function deXlsx(bytes: Uint8Array): string[][] {
  const arq = unzipSync(bytes, {
    filter: (f) => f.name === 'xl/sharedStrings.xml' || f.name.startsWith('xl/worksheets/sheet') || f.name === 'xl/workbook.xml',
  });
  const compartilhadas: string[] = [];
  const ss = arq['xl/sharedStrings.xml'];
  if (ss) {
    for (const si of strFromU8(ss).split('</si>')) {
      const partes = [...si.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => m[1]);
      if (si.includes('<si')) compartilhadas.push(desescaparXml(partes.join('')));
    }
  }
  const planilha = Object.keys(arq)
    .filter((n) => n.startsWith('xl/worksheets/sheet'))
    .sort((a, b) => Number(/(\d+)/.exec(a)?.[1]) - Number(/(\d+)/.exec(b)?.[1]))[0];
  if (!planilha) return [];

  const linhas: string[][] = [];
  for (const row of strFromU8(arq[planilha]!).split('</row>')) {
    const celulas: string[] = [];
    for (const c of row.matchAll(/<c\s([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const attrs = c[1]!;
      const corpo = c[2] ?? '';
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1] ?? '';
      const tipo = /t="([^"]+)"/.exec(attrs)?.[1];
      let valor = /<v>([\s\S]*?)<\/v>/.exec(corpo)?.[1] ?? '';
      if (tipo === 's') valor = compartilhadas[Number(valor)] ?? '';
      else if (tipo === 'inlineStr') valor = [...corpo.matchAll(/<t(?:\s[^>]*)?>([^<]*)<\/t>/g)].map((m) => m[1]).join('');
      celulas[ref ? colunaParaIndice(ref) : celulas.length] = desescaparXml(valor);
    }
    if (celulas.some((v) => v && v.trim())) linhas.push(Array.from(celulas, (v) => v ?? ''));
  }
  return linhas;
}

/* ------------------------------------------------------------------ *
 * Tabelas (CSV e XLSX): três formas possíveis.
 * ------------------------------------------------------------------ */

const COL_TRANSCRICAO = ['transcricao', 'transcript', 'texto', 'text', 'conteudo', 'content', 'reuniao', 'conversa'];
const COL_FALA = ['fala', 'text', 'texto', 'mensagem', 'message', 'utterance', 'sentence', 'frase'];
const COL_FALANTE = ['falante', 'speaker', 'orador', 'participante', 'participant', 'nome', 'name', 'autor', 'author', 'locutor'];
const COL_ARQUIVO = ['arquivo', 'file', 'filename', 'nomearquivo', 'nomedoarquivo', 'path', 'caminho'];

export type LeituraTabela =
  | { forma: 'reunioes'; reunioes: TranscricaoComMeta[] }
  | { forma: 'falas'; texto: string }
  | { forma: 'manifesto'; linhas: Record<string, string>[] }
  | { forma: 'desconhecida'; colunas: string[] };

/**
 * Uma planilha pode ser:
 *   - uma reunião por linha (coluna de transcrição longa),
 *   - uma reunião inteira, uma fala por linha (colunas falante + fala),
 *   - um manifesto (coluna de arquivo, sem transcrição) que dá título,
 *     cliente e data aos outros arquivos do lote.
 */
export function lerTabela(linhas: string[][]): LeituraTabela {
  if (linhas.length < 2) return { forma: 'desconhecida', colunas: linhas[0] ?? [] };
  const cab = linhas[0]!.map(chaveColuna);
  const corpo = linhas.slice(1);
  const idx = (nomes: string[]) => cab.findIndex((c) => nomes.includes(c));

  const iArquivo = idx(COL_ARQUIVO);
  const iTrans = idx(COL_TRANSCRICAO);
  const iFalante = idx(COL_FALANTE);

  const registro = (l: string[]) => Object.fromEntries(cab.map((c, i) => [c, (l[i] ?? '').trim()]));

  if (iTrans !== -1) {
    const media = corpo.reduce((s, l) => s + (l[iTrans]?.length ?? 0), 0) / corpo.length;
    if (media >= 150) {
      return {
        forma: 'reunioes',
        reunioes: corpo
          .filter((l) => (l[iTrans] ?? '').trim().length >= 20)
          .map((l) => {
            const r = registro(l);
            const pega = (ks: string[]) => ks.map((k) => r[k]).find((v) => v);
            return {
              texto: l[iTrans]!,
              titulo: pega(CHAVES_TITULO.filter((k) => k !== 'name' && k !== 'nome')),
              data: pega(CHAVES_DATA),
              cliente: pega(CHAVES_CLIENTE),
              tipo: pega(CHAVES_TIPO),
            };
          }),
      };
    }
  }

  const iFala = idx(COL_FALA);
  if (iFala !== -1 && iFalante !== -1 && iFala !== iFalante) {
    const normalizar = criarNormalizador();
    return {
      forma: 'falas',
      texto: montarTranscricao(corpo.map((l) => ({ falante: normalizar(l[iFalante]), texto: l[iFala] ?? '' }))),
    };
  }

  if (iArquivo !== -1) return { forma: 'manifesto', linhas: corpo.map(registro) };
  return { forma: 'desconhecida', colunas: linhas[0]! };
}

export function lerTabelaCsv(texto: string): LeituraTabela {
  return lerTabela(lerCsv(texto));
}
