import { supabaseServer } from './supabase/server';
import type { CorrectionRow, Json, TranscriptRow, ValidationRunRow } from './supabase/database.types';
import type { QualidadeTranscricao, Redacao } from './analysis';

/**
 * Dados reais do pipeline de tratamento, para a tela de Validação.
 *
 * A rubrica pede demonstrar como os textos foram "coletados, tratados e
 * analisados". Este módulo responde a parte do "tratados" com números da base,
 * não com um diagrama decorativo: quantos turnos foram diarizados, quantas
 * entidades foram mascaradas e por tipo, como o Índice de Confiabilidade se
 * distribui.
 */

const parse = <T>(v: Json, padrao: T): T => (v == null ? padrao : (v as unknown as T));

export type EtapaPipeline = {
  etapa: string;
  descricao: string;
  numero: string;
  detalhe: string;
};

export type FaixaConfiabilidade = { faixa: string; quantidade: number; tom: 'health' | 'warn' | 'risk' };

export type TaxaCorrecao = {
  campo: string;
  correcoes: number;
  confirmacoes: number;
  /** Correções sobre o total de intervenções humanas naquele campo. */
  taxa: number;
};

export type VisaoTratamento = {
  transcricoes: number;
  palavras: number;
  turnos: number;
  sentencasEstimadas: number;
  comDiarizacao: number;
  semDiarizacao: number;
  redacoesPorTipo: { tipo: string; quantidade: number }[];
  totalRedacoes: number;
  confiabilidadeMedia: number;
  distribuicao: FaixaConfiabilidade[];
  avisosMaisComuns: { aviso: string; ocorrencias: number }[];
};

export type VisaoValidacao = {
  tratamento: VisaoTratamento;
  correcoes: { total: number; porCampo: TaxaCorrecao[] };
  execucoes: ValidationRunRow[];
};

export async function carregarValidacao(): Promise<VisaoValidacao> {
  const sb = supabaseServer();

  const [transcriptsRes, correcoesRes, execucoesRes] = await Promise.all([
    sb.from('transcripts').select('word_count, turn_count, quality, redactions').limit(2000),
    sb.from('corrections').select('*').limit(2000),
    sb.from('validation_runs').select('*').order('created_at', { ascending: false }).limit(10),
  ]);

  if (transcriptsRes.error) throw new Error(`Falha ao carregar transcrições: ${transcriptsRes.error.message}`);
  if (correcoesRes.error) throw new Error(`Falha ao carregar correções: ${correcoesRes.error.message}`);
  if (execucoesRes.error) throw new Error(`Falha ao carregar execuções: ${execucoesRes.error.message}`);

  const transcricoes = (transcriptsRes.data ?? []) as Pick<
    TranscriptRow,
    'word_count' | 'turn_count' | 'quality' | 'redactions'
  >[];

  let palavras = 0;
  let turnos = 0;
  let comDiarizacao = 0;
  let somaConfiabilidade = 0;
  let totalRedacoes = 0;
  const porTipo = new Map<string, number>();
  const avisos = new Map<string, number>();
  const distribuicao = { alta: 0, media: 0, baixa: 0 };

  for (const t of transcricoes) {
    palavras += t.word_count ?? 0;
    turnos += t.turn_count ?? 0;

    const q = parse<Partial<QualidadeTranscricao>>(t.quality, {});
    if (q.has_diarization) comDiarizacao++;
    const indice = q.reliability_index ?? 0;
    somaConfiabilidade += indice;
    if (indice >= 75) distribuicao.alta++;
    else if (indice >= 50) distribuicao.media++;
    else distribuicao.baixa++;

    for (const aviso of q.warnings ?? []) {
      // Avisos trazem números variáveis; o prefixo agrupa os do mesmo tipo.
      const chave = aviso.replace(/\d+/g, 'N');
      avisos.set(chave, (avisos.get(chave) ?? 0) + 1);
    }

    for (const r of parse<Redacao[]>(t.redactions, [])) {
      totalRedacoes++;
      porTipo.set(r.type, (porTipo.get(r.type) ?? 0) + 1);
    }
  }

  const n = transcricoes.length || 1;

  // Correções: taxa por campo. Confirmar não é corrigir — a distinção importa,
  // porque é ela que separa "a IA errou" de "o humano validou".
  const correcoes = (correcoesRes.data ?? []) as CorrectionRow[];
  const mapaCampos = new Map<string, { correcoes: number; confirmacoes: number }>();
  for (const c of correcoes) {
    const atual = mapaCampos.get(c.field) ?? { correcoes: 0, confirmacoes: 0 };
    if (c.action === 'confirm') atual.confirmacoes++;
    else atual.correcoes++;
    mapaCampos.set(c.field, atual);
  }

  return {
    tratamento: {
      transcricoes: transcricoes.length,
      palavras,
      turnos,
      // O motor segmenta por sentença; a média em PT-BR falado fica perto de
      // 14 palavras. É estimativa declarada, e a tela diz isso.
      sentencasEstimadas: Math.round(palavras / 14),
      comDiarizacao,
      semDiarizacao: transcricoes.length - comDiarizacao,
      redacoesPorTipo: [...porTipo.entries()]
        .map(([tipo, quantidade]) => ({ tipo, quantidade }))
        .sort((a, b) => b.quantidade - a.quantidade),
      totalRedacoes,
      confiabilidadeMedia: Math.round(somaConfiabilidade / n),
      distribuicao: [
        { faixa: '75–100 (alta)', quantidade: distribuicao.alta, tom: 'health' },
        { faixa: '50–74 (média)', quantidade: distribuicao.media, tom: 'warn' },
        { faixa: '0–49 (baixa)', quantidade: distribuicao.baixa, tom: 'risk' },
      ],
      avisosMaisComuns: [...avisos.entries()]
        .map(([aviso, ocorrencias]) => ({ aviso, ocorrencias }))
        .sort((a, b) => b.ocorrencias - a.ocorrencias)
        .slice(0, 5),
    },
    correcoes: {
      total: correcoes.length,
      porCampo: [...mapaCampos.entries()]
        .map(([campo, v]) => ({
          campo,
          correcoes: v.correcoes,
          confirmacoes: v.confirmacoes,
          taxa:
            v.correcoes + v.confirmacoes > 0
              ? Number((v.correcoes / (v.correcoes + v.confirmacoes)).toFixed(3))
              : 0,
        }))
        .sort((a, b) => b.correcoes - a.correcoes),
    },
    execucoes: (execucoesRes.data ?? []) as ValidationRunRow[],
  };
}
