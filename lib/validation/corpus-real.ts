import type { Amostra } from './tipos';

/**
 * Corpus A — REAL.
 *
 * Reuniões de role-play gravadas pelo squad no Google Meet e transcritas.
 * Está vazio de propósito: as gravações ainda não foram feitas. Inventar
 * amostra marcada como real seria fraudar exatamente o item que a rubrica da
 * Entrega 2 pede ("demonstração de como os textos foram coletados").
 *
 * O pipeline está pronto: assim que os arquivos existirem, cada um vira uma
 * entrada aqui com o `collection_meta` preenchido, e a validação passa a
 * reportar as duas bases separadamente.
 *
 * Protocolo de coleta e roteiros de encenação: ver PROTOCOLO-CORPUS.md
 */
export const CORPUS_REAL: Amostra[] = [];

export type MetaColeta = {
  data: string;
  participantes: string[];
  papeis: string[];
  duracao_min: number;
  ferramenta_transcricao: 'meet_legenda' | 'whisper_local' | 'whisper_api';
  modelo?: string;
  anotadores: string[];
  concordancia?: number;
};

export const CORPUS_REAL_PENDENTE = {
  meta_alvo: 12,
  gravadas: CORPUS_REAL.length,
  observacao:
    'Nenhuma reunião real gravada até o momento. As métricas do corpus real só aparecem no relatório depois que os arquivos forem ingeridos.',
};
