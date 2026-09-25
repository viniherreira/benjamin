import { ROTULO_TIPO, type LinhaManifesto, type Metadados, type TipoReuniao } from './tipos';
import { chaveColuna, nomeBase, semExtensao } from './texto';

/**
 * Metadados de uma reunião a partir do que o arquivo já diz sem ninguém
 * digitar nada: o nome ("2026-09-10 Descoberta.vtt"), a pasta onde ele está
 * ("Metalúrgica Vale Verde/…") e, se o lote trouxer, um manifesto.
 *
 * Tudo aqui é sugestão. A tela de revisão mostra o que foi deduzido e deixa
 * corrigir antes de processar — deduzir errado em silêncio criaria cem
 * reuniões atribuídas ao cliente errado.
 */

const PASTAS_GENERICAS = new Set(
  [
    'transcricoes', 'transcricao', 'transcripts', 'transcript', 'reunioes', 'reuniao', 'meetings',
    'meeting', 'calls', 'call', 'audios', 'audio', 'gravacoes', 'gravacao', 'recordings', 'recording',
    'export', 'exports', 'exportacao', 'arquivos', 'files', 'docs', 'documentos', 'lote', 'lotes',
    'batch', 'dados', 'data', 'input', 'entrada', 'upload', 'uploads', 'zoom', 'teams', 'meet',
    'googlemeet', 'microsoftteams', 'novapasta', 'newfolder', 'downloads', 'desktop', 'area de trabalho',
    'areadetrabalho', 'vendas', 'sales', 'cs', 'comercial', 'clientes', 'customers', 'textos', 'legendas',
    'captions', 'subtitles', 'backup',
  ].map(chaveColuna),
);

const MESES = 'janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez|january|february|march|april|may|june|july|august|september|october|november|december';
const RE_PASTA_DE_TEMPO = new RegExp(`^(?:\\d{1,4}[-_. ]?)*(?:${MESES})?(?:[-_. ]?\\d{1,4})*$|^(?:semana|week|sem|q)[-_ ]?\\d+`, 'i');

/**
 * Uma pasta é genérica quando TODAS as suas palavras são genéricas ou de
 * tempo: "Reuniões setembro", "calls 2026", "Transcrições Q3". Basta uma
 * palavra que não seja isso para ela ser nome de conta: "Calls Agro Norte" é
 * da Agro Norte.
 */
function pastaGenerica(bruto: string): boolean {
  const palavras = bruto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  if (palavras.length === 0) return true;
  if (PASTAS_GENERICAS.has(palavras.join(''))) return true;
  return palavras.every(
    (p) => PASTAS_GENERICAS.has(p) || RE_PASTA_DE_TEMPO.test(p) || PALAVRAS_DE_PERIODO.has(p) || /^q[1-4]$/.test(p),
  );
}

const PALAVRAS_DE_PERIODO = new Set([
  'de', 'do', 'da', 'e', 'of', 'the', 'semana', 'semanas', 'week', 'weeks', 'sem', 'mes', 'meses', 'month',
  'trimestre', 'quarter', 'ano', 'year', 'dia', 'dias', 'day', 'hoje', 'ontem', 'today', 'antigas', 'novas', 'old', 'new',
]);

/** A pasta mais próxima do arquivo que parece nome de conta. */
export function clienteDasPastas(pastas: string[]): string | undefined {
  for (let i = pastas.length - 1; i >= 0; i--) {
    const bruto = pastas[i]!.trim();
    if (!chaveColuna(bruto) || pastaGenerica(bruto)) continue;
    return bruto.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
  }
  return undefined;
}

function iso(a: number, m: number, d: number): string | undefined {
  if (a < 2000 || a > 2099 || m < 1 || m > 12 || d < 1 || d > 31) return undefined;
  const dt = new Date(Date.UTC(a, m - 1, d));
  if (dt.getUTCMonth() !== m - 1) return undefined; // 31/02
  return `${a}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** Data dentro de um nome de arquivo, e o trecho que ela ocupava (para tirar do título). */
export function dataNoNome(nome: string): { data: string; trecho: string } | undefined {
  const padroes: [RegExp, (m: RegExpExecArray) => string | undefined][] = [
    [/(?<!\d)(20\d{2})[-_.](\d{1,2})[-_.](\d{1,2})(?!\d)/, (m) => iso(+m[1]!, +m[2]!, +m[3]!)],
    [/(?<!\d)(\d{1,2})[-_.](\d{1,2})[-_.](20\d{2})(?!\d)/, (m) => iso(+m[3]!, +m[2]!, +m[1]!)],
    // Zoom: GMT20260910-143000 ; câmeras e gravadores: 20260910_143000
    [/(?<!\d)(20\d{2})(\d{2})(\d{2})(?!\d{3})/, (m) => iso(+m[1]!, +m[2]!, +m[3]!)],
  ];
  for (const [re, conv] of padroes) {
    const m = re.exec(nome);
    const data = m ? conv(m) : undefined;
    if (m && data) return { data, trecho: m[0] };
  }
  return undefined;
}

/**
 * Qualquer forma de data que planilha, CRM ou JSON costumam produzir.
 * Inclui o número serial do Excel: uma célula de data num XLSX chega como
 * "46275", e ignorar isso jogaria a data de toda reunião para hoje.
 */
export function normalizarData(v: string | undefined | null): string | undefined {
  if (!v) return undefined;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return iso(+m[1]!, +m[2]!, +m[3]!);
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/.exec(s);
  if (m) return iso(+m[3]!, +m[2]!, +m[1]!);
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const n = Math.floor(Number(s));
    if (n > 30000 && n < 80000) {
      const d = new Date(Date.UTC(1899, 11, 30) + n * 86_400_000);
      return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
    }
  }
  if (/^\d{10}(\d{3})?$/.test(s)) {
    const d = new Date(s.length === 10 ? Number(s) * 1000 : Number(s));
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  return dataNoNome(s)?.data;
}

const TIPOS: [TipoReuniao, RegExp][] = [
  ['renovacao', /renova|renewal|renew/],
  ['customer_success', /customersuccess|\bcs\b|sucessodocliente|onboarding|qbr|checkin|healthcheck/],
  ['negociacao', /negocia|negotiat|fechamento|closing/],
  ['proposta', /proposta|proposal|orcamento|cotacao|quote/],
  ['demonstracao', /demonstra|\bdemo\b|apresentacao|presentation|walkthrough/],
  ['descoberta', /descoberta|discovery|diagnostico|levantamento|qualifica/],
  ['follow_up', /followup|follow|acompanhamento|retorno|alinhamento/],
  ['primeiro_contato', /primeirocontato|primeirareuniao|kickoff|\bintro|introdu|prospec|coldcall/],
];

export function normalizarTipo(v: string | undefined | null): TipoReuniao | undefined {
  if (!v) return undefined;
  const bruto = v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const colado = bruto.replace(/[^a-z0-9 ]+/g, '').replace(/\s+/g, '');
  const espacado = ` ${bruto.replace(/[^a-z0-9]+/g, ' ')} `;
  for (const [tipo, re] of TIPOS) if (re.test(colado) || re.test(espacado)) return tipo;
  const exato = colado as TipoReuniao;
  return ['reuniao'].includes(exato) ? exato : undefined;
}

const RUIDO_NO_TITULO =
  /\b(?:gmt\d{8}[-_ ]?\d{0,6}|recording|gravacao|gravação|transcript|transcricao|transcrição|transcription|audio[_ ]?only|captions?|legendas?|final|copy|copia|cópia|v\d+)\b/gi;

export function tituloDoNome(nome: string, trechoData?: string): string {
  // Ruído primeiro: "GMT20260910-143000_Recording" só é reconhecido inteiro,
  // antes de a data sair do meio dele. E "_" vira espaço antes, senão
  // "_Recording" não tem fronteira de palavra.
  let t = semExtensao(nome).replace(/[_]+/g, ' ').replace(RUIDO_NO_TITULO, ' ');
  if (trechoData) t = t.replace(trechoData, ' ');
  t = t
    .replace(/\(\d+\)$/, ' ')
    .replace(/\s*[-–—.]\s*$/g, '')
    .replace(/^\s*[-–—.]\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return t.slice(0, 160);
}

/**
 * "2026-09-10 descoberta.vtt" sem a data vira só "descoberta" — e cem
 * reuniões chamadas "descoberta" ou "negociacao" são indistinguíveis na lista.
 * Quando o que sobra do nome é só o tipo (ou nada), o título é montado:
 * "Descoberta — Metalúrgica Vale Verde".
 */
const VOCABULARIO_DE_TIPO = new Set(
  (
    'descoberta discovery diagnostico levantamento follow up followup acompanhamento retorno alinhamento ' +
    'proposta proposal orcamento cotacao negociacao negotiation fechamento closing renovacao renewal demo ' +
    'demonstracao apresentacao kickoff kick off intro introducao primeiro primeira contato reuniao call ' +
    'meeting cs onboarding qbr checkin check in sucesso do de da com e a o no na com audio gravacao'
  ).split(' '),
);

function tituloInformativo(titulo: string, tipo: TipoReuniao, cliente: string | undefined): string {
  const palavras = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  const soVocabularioDeTipo = palavras.every((p) => VOCABULARIO_DE_TIPO.has(p));
  if (!soVocabularioDeTipo) return titulo;
  return cliente ? `${ROTULO_TIPO[tipo]} — ${cliente}` : ROTULO_TIPO[tipo];
}

export function metadadosDoCaminho(caminho: string, pastas: string[]): Metadados {
  const nome = nomeBase(caminho);
  const achada = dataNoNome(nome);
  const cliente = clienteDasPastas(pastas);
  const tipo = normalizarTipo(semExtensao(nome)) ?? 'reuniao';
  return {
    titulo: tituloInformativo(tituloDoNome(nome, achada?.trecho), tipo, cliente),
    data: achada?.data,
    cliente,
    tipo,
  };
}

/** Converte as linhas de uma tabela-manifesto em entradas por arquivo. */
export function lerManifesto(linhas: Record<string, string>[]): LinhaManifesto[] {
  const pega = (r: Record<string, string>, ks: string[]) => ks.map((k) => r[k]).find((v) => v && v.trim());
  return linhas
    .map((r) => ({
      arquivo: pega(r, ['arquivo', 'file', 'filename', 'nomearquivo', 'nomedoarquivo', 'path', 'caminho']) ?? '',
      titulo: pega(r, ['titulo', 'title', 'assunto', 'topic', 'subject']),
      cliente: pega(r, ['cliente', 'client', 'customer', 'empresa', 'company', 'conta', 'account']),
      data: normalizarData(pega(r, ['data', 'date', 'datareuniao', 'meetingdate', 'dia'])),
      tipo: normalizarTipo(pega(r, ['tipo', 'type', 'meetingtype', 'etapa', 'stage'])),
    }))
    .filter((l) => l.arquivo);
}

/**
 * Casa um arquivo com a linha do manifesto que o descreve. Aceita o nome com
 * ou sem extensão e o caminho completo — quem preenche planilha escreve de
 * qualquer um dos três jeitos.
 */
export function acharNoManifesto(caminho: string, manifesto: LinhaManifesto[]): LinhaManifesto | undefined {
  if (manifesto.length === 0) return undefined;
  const alvo = caminho.toLowerCase();
  const base = nomeBase(alvo);
  const semExt = semExtensao(base);
  return manifesto.find((l) => {
    const a = l.arquivo.toLowerCase().replace(/\\/g, '/').trim();
    return a === alvo || alvo.endsWith(`/${a}`) || a === base || a === semExt || semExtensao(nomeBase(a)) === semExt;
  });
}
