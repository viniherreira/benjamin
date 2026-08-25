import { NextResponse } from 'next/server';
import { analisar } from '@/lib/analysis';
import { CORPUS_SINTETICO } from '@/lib/validation/corpus-sintetico';

/**
 * Processamento em lote — a resposta à pergunta das 10.000 reuniões/dia.
 *
 * Não basta afirmar que escala: aqui o corpus inteiro é processado com
 * concorrência controlada e a rota devolve throughput, latência p50/p95 e a
 * projeção medida, não estimada no chute.
 *
 * O motor é síncrono e determinístico, então "concorrência" aqui significa
 * lotes: é o formato que uma fila com N workers teria, e o número por worker é
 * o que a projeção usa.
 *
 *   POST /api/batch/analyze            → corpus inteiro, lotes de 8
 *   POST /api/batch/analyze?lote=16    → ajusta o tamanho do lote
 *   POST /api/batch/analyze?workers=4  → projeta para N processos paralelos
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const legivel = (segundos: number): string => {
  if (segundos < 60) return `${segundos.toFixed(1)} segundos`;
  if (segundos < 3600) return `${(segundos / 60).toFixed(1)} minutos`;
  return `${(segundos / 3600).toFixed(2)} horas`;
};

const percentil = (ordenadas: number[], p: number): number => {
  if (ordenadas.length === 0) return 0;
  const i = Math.min(ordenadas.length - 1, Math.floor((p / 100) * ordenadas.length));
  return Number((ordenadas[i] as number).toFixed(2));
};

export async function POST(req: Request) {
  const url = new URL(req.url);
  const lote = Math.max(1, Math.min(64, Number(url.searchParams.get('lote') ?? 8)));
  const workers = Math.max(1, Math.min(64, Number(url.searchParams.get('workers') ?? 1)));

  // Aquecimento fora da medição.
  for (const a of CORPUS_SINTETICO.slice(0, 5)) {
    analisar({ texto: a.texto, dataReuniao: a.data ?? '2026-08-14' });
  }

  const latencias: number[] = [];
  const inicio = performance.now();

  for (let i = 0; i < CORPUS_SINTETICO.length; i += lote) {
    const bloco = CORPUS_SINTETICO.slice(i, i + lote);
    // Promise.all mantém o formato de lote mesmo com motor síncrono: é assim
    // que o pipeline se comporta quando o provider LLM entra e passa a ter I/O.
    await Promise.all(
      bloco.map(async (a) => {
        const t0 = performance.now();
        analisar({ texto: a.texto, dataReuniao: a.data ?? '2026-08-14' });
        latencias.push(performance.now() - t0);
      }),
    );
  }

  const totalMs = performance.now() - inicio;
  const ordenadas = [...latencias].sort((x, y) => x - y);
  const porMinuto = totalMs > 0 ? Math.round((CORPUS_SINTETICO.length / totalMs) * 60_000) : 0;
  const comWorkers = porMinuto * workers;
  const horas10k = comWorkers > 0 ? 10_000 / comWorkers / 60 : 0;

  return NextResponse.json({
    processadas: CORPUS_SINTETICO.length,
    tamanho_do_lote: lote,
    tempo_total_ms: Number(totalMs.toFixed(1)),
    latencia: {
      media_ms: Number((latencias.reduce((s, n) => s + n, 0) / (latencias.length || 1)).toFixed(2)),
      p50_ms: percentil(ordenadas, 50),
      p95_ms: percentil(ordenadas, 95),
    },
    throughput_por_minuto: porMinuto,
    projecao_10k_dia: {
      workers,
      analises_por_minuto: comWorkers,
      horas_de_processo: Number(horas10k.toFixed(3)),
      // Em horas o número arredonda para zero e não informa nada; o texto
      // legível é o que responde de fato à pergunta das 10.000/dia.
      tempo_legivel: legivel(horas10k * 3600),
      custo_api_reais: 0,
      observacao:
        'Custo de API é zero porque o motor roda 100% em regras determinísticas. Com o provider LLM ativo, o custo passa a ser por token e a projeção muda.',
    },
  });
}
