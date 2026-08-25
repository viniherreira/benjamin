import { supabaseServer } from './supabase/server';
import type { CustomerRow, PainSignalRow } from './supabase/database.types';
import type { BusinessUnit } from './analysis';

/**
 * Radar de Dores — o item 1 da oportunidade do briefing TOTVS.
 *
 * "Quais dores reais do cliente estão surgindo com mais frequência" não se
 * responde numa reunião: exige cruzar todas elas e agrupar. Este módulo lê os
 * `pain_signals` gravados na ingestão e os agrupa por tópico canônico.
 *
 * A unidade de negócio é derivada aqui, no read, e não na escrita: a
 * classificação Cross-BU é regra de leitura do radar e pode ser refinada sem
 * reprocessar o histórico já ingerido.
 */

export type Periodo = 30 | 90 | 180 | 0; // 0 = tudo

const ROTULO_DOR: Record<string, string> = {
  rh: 'RH e folha de pagamento',
  fiscal: 'Fiscal e tributário',
  financeiro: 'Financeiro e fluxo de caixa',
  estoque: 'Estoque e logística',
  integracao: 'Integração entre sistemas',
  suporte: 'Suporte e atendimento',
  usabilidade: 'Usabilidade',
  custo: 'Custo e licenciamento',
  performance: 'Performance',
  compliance: 'Compliance',
  relatorios: 'Relatórios e BI',
  mobilidade: 'Mobilidade',
  processo_manual: 'Processo manual',
  pipeline: 'Previsibilidade de pipeline',
  marketing: 'Geração de demanda',
};

/**
 * Mapa dor → unidade de negócio da TOTVS.
 *
 * É o que faz o radar mostrar que existe oportunidade fora do ERP: dor de fluxo
 * de caixa é Techfin, dor de pipeline é RD Station. Quase todo time mapeia só
 * Gestão — esta tabela é o diferencial verificável.
 */
const UNIDADE_DA_DOR: Record<string, BusinessUnit> = {
  rh: 'gestao',
  fiscal: 'gestao',
  estoque: 'gestao',
  integracao: 'gestao',
  suporte: 'gestao',
  usabilidade: 'gestao',
  performance: 'gestao',
  compliance: 'gestao',
  relatorios: 'gestao',
  mobilidade: 'gestao',
  processo_manual: 'gestao',
  custo: 'gestao',
  financeiro: 'techfin',
  pipeline: 'rd_station',
  marketing: 'rd_station',
};

export const NOME_UNIDADE: Record<BusinessUnit, string> = {
  gestao: 'TOTVS Gestão',
  techfin: 'TOTVS Techfin',
  rd_station: 'RD Station',
  indefinido: 'Não classificada',
};

export type OcorrenciaDor = {
  clienteId: string | null;
  cliente: string;
  segmento: string | null;
  citacao: string | null;
  texto: string;
  data: string;
  meetingId: string | null;
};

export type ClusterDor = {
  topico: string;
  rotulo: string;
  unidade: BusinessUnit;
  ocorrencias: number;
  clientes: number;
  /** Ocorrências no período mais recente vs. o anterior, para medir tendência. */
  tendencia: { recente: number; anterior: number; variacao: number };
  exemplos: OcorrenciaDor[];
};

export type VisaoRadar = {
  clusters: ClusterDor[];
  totalSinais: number;
  totalClientes: number;
  segmentos: string[];
  porUnidade: { unidade: BusinessUnit; rotulo: string; ocorrencias: number }[];
  filtros: { segmento: string; unidade: string; periodo: Periodo };
};

export type FiltrosRadar = {
  segmento?: string;
  unidade?: string;
  periodo?: Periodo;
};

const diasAtras = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
};

export async function carregarRadar(filtros: FiltrosRadar = {}): Promise<VisaoRadar> {
  const sb = supabaseServer();

  const [sinaisRes, clientesRes, reunioesRes] = await Promise.all([
    sb.from('pain_signals').select('*').order('created_at', { ascending: false }).limit(3000),
    sb.from('customers').select('id, name, segment'),
    sb.from('meetings').select('id, meeting_date').limit(3000),
  ]);

  if (sinaisRes.error) throw new Error(`Falha ao carregar dores: ${sinaisRes.error.message}`);
  if (clientesRes.error) throw new Error(`Falha ao carregar clientes: ${clientesRes.error.message}`);
  if (reunioesRes.error) throw new Error(`Falha ao carregar reuniões: ${reunioesRes.error.message}`);

  const sinais = (sinaisRes.data ?? []) as PainSignalRow[];
  const clientes = new Map(
    ((clientesRes.data ?? []) as Pick<CustomerRow, 'id' | 'name' | 'segment'>[]).map((c) => [c.id, c]),
  );
  const dataDaReuniao = new Map(
    ((reunioesRes.data ?? []) as { id: string; meeting_date: string }[]).map((m) => [m.id, m.meeting_date]),
  );

  const segmento = filtros.segmento ?? 'todos';
  const unidade = filtros.unidade ?? 'todas';
  const periodo = filtros.periodo ?? 0;

  const limite = periodo > 0 ? diasAtras(periodo) : null;
  const metadePeriodo = periodo > 0 ? diasAtras(Math.round(periodo / 2)) : diasAtras(45);

  const filtrados = sinais.filter((s) => {
    const uni = UNIDADE_DA_DOR[s.canonical_topic] ?? 'indefinido';
    if (unidade !== 'todas' && uni !== unidade) return false;

    const cliente = s.customer_id ? clientes.get(s.customer_id) : undefined;
    if (segmento !== 'todos' && (cliente?.segment ?? '') !== segmento) return false;

    if (limite) {
      const data = (s.meeting_id ? dataDaReuniao.get(s.meeting_id) : null) ?? s.created_at.slice(0, 10);
      if (data < limite) return false;
    }
    return true;
  });

  const mapa = new Map<string, ClusterDor>();
  const clientesGerais = new Set<string>();

  for (const s of filtrados) {
    const topico = s.canonical_topic;
    const cliente = s.customer_id ? clientes.get(s.customer_id) : undefined;
    const data = (s.meeting_id ? dataDaReuniao.get(s.meeting_id) : null) ?? s.created_at.slice(0, 10);
    if (s.customer_id) clientesGerais.add(s.customer_id);

    const atual =
      mapa.get(topico) ??
      ({
        topico,
        rotulo: ROTULO_DOR[topico] ?? topico,
        unidade: UNIDADE_DA_DOR[topico] ?? 'indefinido',
        ocorrencias: 0,
        clientes: 0,
        tendencia: { recente: 0, anterior: 0, variacao: 0 },
        exemplos: [],
      } as ClusterDor);

    atual.ocorrencias++;
    if (data >= metadePeriodo) atual.tendencia.recente++;
    else atual.tendencia.anterior++;

    if (atual.exemplos.length < 6) {
      atual.exemplos.push({
        clienteId: s.customer_id,
        cliente: cliente?.name ?? 'Conta não vinculada',
        segmento: cliente?.segment ?? null,
        citacao: s.evidence,
        texto: s.raw_text,
        data,
        meetingId: s.meeting_id,
      });
    }

    mapa.set(topico, atual);
  }

  // Contagem de clientes distintos por cluster.
  for (const [topico, cluster] of mapa) {
    const distintos = new Set(
      filtrados.filter((s) => s.canonical_topic === topico && s.customer_id).map((s) => s.customer_id),
    );
    cluster.clientes = distintos.size;
    cluster.tendencia.variacao = cluster.tendencia.recente - cluster.tendencia.anterior;
  }

  const clusters = [...mapa.values()].sort(
    (a, b) => b.ocorrencias - a.ocorrencias || b.clientes - a.clientes,
  );

  const porUnidadeMapa = new Map<BusinessUnit, number>();
  for (const c of clusters) {
    porUnidadeMapa.set(c.unidade, (porUnidadeMapa.get(c.unidade) ?? 0) + c.ocorrencias);
  }

  const segmentos = [
    ...new Set(
      [...clientes.values()].map((c) => c.segment).filter((s): s is string => Boolean(s)),
    ),
  ].sort();

  return {
    clusters,
    totalSinais: filtrados.length,
    totalClientes: clientesGerais.size,
    segmentos,
    porUnidade: [...porUnidadeMapa.entries()]
      .map(([u, n]) => ({ unidade: u, rotulo: NOME_UNIDADE[u], ocorrencias: n }))
      .sort((a, b) => b.ocorrencias - a.ocorrencias),
    filtros: { segmento, unidade, periodo },
  };
}
