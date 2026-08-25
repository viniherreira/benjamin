import { NextResponse } from 'next/server';
import { analisar } from '@/lib/analysis';
import { CORPUS_SINTETICO, coberturaCorpus } from '@/lib/validation/corpus-sintetico';
import { CORPUS_REAL, CORPUS_REAL_PENDENTE } from '@/lib/validation/corpus-real';
import { calcularMetricas, type ResultadoAmostra } from '@/lib/validation/metrics';
import type { Amostra } from '@/lib/validation/tipos';
import { supabaseConfigurado, supabaseServer } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/database.types';

/**
 * Roda o motor sobre o corpus AGORA e devolve as métricas.
 *
 * É a mesma execução que scripts/validar.ts faz na linha de comando — mesmo
 * motor, mesmo corpus, mesmas contas. A tela não repete número guardado: ela
 * manda rodar e mostra o que saiu, inclusive quando sai ruim.
 *
 * Cada execução é gravada em validation_runs, então a tela também mostra o
 * histórico e permite ver se uma mudança no motor melhorou ou piorou.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function rodar(amostras: Amostra[]): ResultadoAmostra[] {
  return amostras.map((a) => {
    const t0 = performance.now();
    const analise = analisar({ texto: a.texto, dataReuniao: a.data ?? '2026-08-14' });
    return {
      codigo: a.codigo,
      particao: a.particao,
      latencia_ms: Number((performance.now() - t0).toFixed(2)),
      palavras: (a.texto.match(/[\p{L}\p{N}]+/gu) ?? []).length,
      analise,
      gold: a.gold,
    };
  });
}

export async function POST() {
  // Aquecimento: a primeira execução carrega e otimiza o código, e mediria
  // latência errada. Descartado de propósito, como no script de linha de comando.
  rodar(CORPUS_SINTETICO.slice(0, 5));

  const sinteticos = rodar(CORPUS_SINTETICO);
  const reais = rodar(CORPUS_REAL);

  const dev = sinteticos.filter((r) => r.particao === 'dev');
  const holdout = sinteticos.filter((r) => r.particao === 'holdout');

  const mDev = calcularMetricas(dev);
  const mHold = calcularMetricas(holdout);
  const mSintetico = calcularMetricas(sinteticos);
  const mReal = reais.length > 0 ? calcularMetricas(reais) : null;

  // Teste de overfitting: dev muito acima do holdout significa que o motor
  // decorou o que foi lido durante o ajuste.
  const campos = Object.keys(mDev.campos);
  const deltas = campos.map((nome) => ({
    campo: nome,
    f1_dev: mDev.campos[nome]?.f1 ?? 0,
    f1_holdout: mHold.campos[nome]?.f1 ?? 0,
    delta: Number(((mDev.campos[nome]?.f1 ?? 0) - (mHold.campos[nome]?.f1 ?? 0)).toFixed(3)),
  }));
  const deltaMedio =
    deltas.length > 0 ? Number((deltas.reduce((s, d) => s + d.delta, 0) / deltas.length).toFixed(3)) : 0;

  const resposta = {
    executado_em: new Date().toISOString(),
    cobertura: coberturaCorpus(),
    corpus_real: {
      amostras: CORPUS_REAL.length,
      pendente: CORPUS_REAL_PENDENTE,
      metricas: mReal,
    },
    sintetico: { dev: mDev, holdout: mHold, total: mSintetico },
    overfitting: {
      por_campo: deltas,
      delta_medio: deltaMedio,
      veredito:
        deltaMedio > 0.1
          ? 'Dev bem acima do holdout: há sinal de ajuste excessivo ao que foi lido.'
          : 'Delta baixo: o motor generaliza para amostras que não foram usadas no ajuste.',
      suspeitos: deltas.filter((d) => d.delta > 0.15).map((d) => d.campo),
    },
  };

  // Persistir a execução é o que permite comparar rodadas ao longo do tempo.
  // Falha ao gravar não invalida a medição — a métrica é devolvida de todo jeito.
  let gravado = false;
  let erroGravacao: string | null = null;
  if (supabaseConfigurado()) {
    try {
      const sb = supabaseServer();
      const ins = await sb.from('validation_runs').insert({
        engine: 'rules',
        corpus: CORPUS_REAL.length > 0 ? 'todos' : 'sintetico',
        sample_count: sinteticos.length + reais.length,
        metrics: resposta as unknown as Json,
        per_field: deltas as unknown as Json,
        avg_latency_ms: Math.round(mSintetico.latencia.media),
        p95_latency_ms: Math.round(mSintetico.latencia.p95),
        throughput_per_min: mSintetico.throughput_por_min,
      });
      if (ins.error) erroGravacao = ins.error.message;
      else gravado = true;
    } catch (erro) {
      erroGravacao = erro instanceof Error ? erro.message : 'erro desconhecido';
    }
  }

  return NextResponse.json({ ...resposta, gravado, erro_gravacao: erroGravacao });
}
