/**
 * Tipos do importador em lote.
 *
 * Tudo em lib/lote/ é isomórfico — roda no navegador, onde o lote de fato
 * acontece, e no Node, onde os testes rodam — com exceção de `audio.ts`, que
 * depende da Web Audio API.
 */

export type TipoReuniao =
  | 'primeiro_contato'
  | 'descoberta'
  | 'demonstracao'
  | 'negociacao'
  | 'proposta'
  | 'follow_up'
  | 'customer_success'
  | 'renovacao'
  | 'reuniao';

export const ROTULO_TIPO: Record<TipoReuniao, string> = {
  descoberta: 'Descoberta',
  primeiro_contato: 'Primeiro contato',
  demonstracao: 'Demonstração',
  negociacao: 'Negociação',
  proposta: 'Proposta',
  follow_up: 'Follow-up',
  customer_success: 'Customer Success',
  renovacao: 'Renovação',
  reuniao: 'Reunião',
};

/** De onde o texto saiu. Vai para a tela, para quem revisa saber o que conferir. */
export type Formato =
  | 'txt'
  | 'vtt'
  | 'srt'
  | 'json'
  | 'docx'
  | 'csv'
  | 'xlsx'
  | 'audio';

export type Metadados = {
  titulo: string;
  /** AAAA-MM-DD. Ausente quando nada no arquivo indica a data. */
  data?: string;
  cliente?: string;
  tipo: TipoReuniao;
};

type Base = {
  /** Caminho completo dentro do lote — "Cliente X/semana 2/call.vtt". */
  caminho: string;
  meta: Metadados;
};

export type ItemTexto = Base & {
  tipo: 'texto';
  formato: Exclude<Formato, 'audio'>;
  texto: string;
  /** Rótulos de falante reconhecidos. Zero significa texto corrido. */
  falantes: number;
  encoding?: string;
};

export type ItemAudio = Base & {
  tipo: 'audio';
  formato: 'audio';
  dados: Blob;
  mime: string;
};

export type ItemIgnorado = {
  tipo: 'ignorado';
  caminho: string;
  motivo: string;
};

export type ItemExtraido = ItemTexto | ItemAudio | ItemIgnorado;

/** Uma linha de manifesto: metadados declarados pelo usuário para um arquivo. */
export type LinhaManifesto = {
  arquivo: string;
  titulo?: string;
  cliente?: string;
  data?: string;
  tipo?: TipoReuniao;
};
