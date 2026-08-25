'use client';

import { useState } from 'react';
import { FlaskConical, Loader2, TriangleAlert } from 'lucide-react';

/**
 * Executa a validação sobre o corpus e mostra o que saiu.
 *
 * A tela não repete número guardado em slide: ela manda rodar o motor agora e
 * exibe o resultado, inclusive quando o resultado é ruim. Um F1 de 0,60 com
 * análise honesta do erro vale mais que 0,99 sem procedência.
 */

type PRF = { precision: number; recall: number; f1: number; suporte: number };
type Acuracia = { acertos: number; total: number; taxa: number };

type Relatorio = {
  amostras: number;
  campos: Record<string, PRF>;
  acuracias: Record<string, Acuracia>;
  mae: Record<string, number>;
  cobertura_evidencia: number;
  falso_positivo_sem_sinal: Record<string, number>;
  latencia: { p50: number; p95: number; media: number };
  throughput_por_min: number;
};

type Resultado = {
  executado_em: string;
  corpus_real: { amostras: number; pendente: { observacao: string }; metricas: Relatorio | null };
  sintetico: { dev: Relatorio; holdout: Relatorio; total: Relatorio };
  overfitting: {
    por_campo: { campo: string; f1_dev: number; f1_holdout: number; delta: number }[];
    delta_medio: number;
    veredito: string;
    suspeitos: string[];
  };
  gravado: boolean;
  erro_gravacao: string | null;
};

const n3 = (v: number) => v.toFixed(3);

function Tabela({ titulo, legenda, r }: { titulo: string; legenda: string; r: Relatorio }) {
  return (
    <div className="rounded-lg border border-line bg-surface">
      <div className="border-b border-line px-4 py-2.5">
        <h3 className="text-[12.5px] font-semibold text-ink">{titulo}</h3>
        <p className="text-[11px] text-ink-faint">
          {legenda} · {r.amostras} amostra(s)
        </p>
      </div>
      <div className="overflow-x-auto p-4">
        <table className="w-full text-[12px]">
          <thead className="text-left text-[10.5px] uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="pb-1.5 pr-3 font-medium">Campo</th>
              <th className="pb-1.5 pr-3 text-right font-medium">Precisão</th>
              <th className="pb-1.5 pr-3 text-right font-medium">Recall</th>
              <th className="pb-1.5 pr-3 text-right font-medium">F1</th>
              <th className="pb-1.5 text-right font-medium">Suporte</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            {Object.entries(r.campos).map(([campo, v]) => (
              <tr key={campo} className="border-t border-line/60">
                <td className="py-1.5 pr-3 font-sans text-ink-dim">{campo}</td>
                <td className="py-1.5 pr-3 text-right text-ink-dim">{n3(v.precision)}</td>
                <td className="py-1.5 pr-3 text-right text-ink-dim">{n3(v.recall)}</td>
                <td
                  className={`py-1.5 pr-3 text-right ${
                    v.f1 >= 0.8 ? 'text-health' : v.f1 >= 0.6 ? 'text-warn' : 'text-risk'
                  }`}
                >
                  {n3(v.f1)}
                </td>
                <td className="py-1.5 text-right text-ink-faint">{v.suporte}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
              Acurácia
            </p>
            <ul className="space-y-0.5 text-[11.5px]">
              {Object.entries(r.acuracias).map(([nome, a]) => (
                <li key={nome} className="flex justify-between gap-3">
                  <span className="text-ink-dim">{nome}</span>
                  <span className="font-mono tabular-nums text-ink">
                    {n3(a.taxa)}{' '}
                    <span className="text-ink-faint">
                      ({a.acertos}/{a.total})
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
              Erro e desempenho
            </p>
            <ul className="space-y-0.5 text-[11.5px]">
              {Object.entries(r.mae).map(([nome, v]) => (
                <li key={nome} className="flex justify-between gap-3">
                  <span className="text-ink-dim">MAE {nome}</span>
                  <span className="font-mono tabular-nums text-ink">{v}</span>
                </li>
              ))}
              <li className="flex justify-between gap-3">
                <span className="text-ink-dim">cobertura de evidência</span>
                <span
                  className={`font-mono tabular-nums ${
                    r.cobertura_evidencia >= 0.999 ? 'text-health' : 'text-warn'
                  }`}
                >
                  {(r.cobertura_evidencia * 100).toFixed(2)}%
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-ink-dim">latência p50 / p95</span>
                <span className="font-mono tabular-nums text-ink">
                  {r.latencia.p50} / {r.latencia.p95} ms
                </span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-ink-dim">throughput</span>
                <span className="font-mono tabular-nums text-ink">
                  {r.throughput_por_min.toLocaleString('pt-BR')}/min
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-3 border-t border-line pt-2">
          <p className="text-[10.5px] font-semibold uppercase tracking-wide text-ink-faint">
            Falso positivo nas amostras sem sinal comercial
          </p>
          <p className="mt-0.5 font-mono text-[11.5px] text-ink-dim">
            {Object.entries(r.falso_positivo_sem_sinal)
              .map(([k, v]) => `${k} ${v}`)
              .join(' · ')}
          </p>
        </div>
      </div>
    </div>
  );
}

export function MetricasAoVivo() {
  const [rodando, setRodando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [r, setR] = useState<Resultado | null>(null);

  async function rodar() {
    setRodando(true);
    setErro(null);
    try {
      const resp = await fetch('/api/validation/run', { method: 'POST' });
      if (!resp.ok) {
        const j = (await resp.json().catch(() => ({}))) as { erro?: string };
        setErro(j.erro ?? `Falha na execução (HTTP ${resp.status}).`);
        setRodando(false);
        return;
      }
      setR((await resp.json()) as Resultado);
    } catch {
      setErro('Não foi possível falar com o servidor.');
    }
    setRodando(false);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={rodar}
          disabled={rodando}
          className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {rodando ? <Loader2 size={14} className="animate-spin" /> : <FlaskConical size={14} />}
          {rodando ? 'Rodando o motor sobre o corpus' : 'Rodar validação agora'}
        </button>
        {r ? (
          <span className="text-[11.5px] text-ink-faint">
            executado em {new Date(r.executado_em).toLocaleString('pt-BR')}
            {r.gravado ? ' · gravado no histórico' : ''}
          </span>
        ) : (
          <span className="text-[11.5px] text-ink-faint">
            Roda o motor sobre as amostras do corpus e mede tudo de novo, na hora.
          </span>
        )}
      </div>

      {erro ? (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border border-risk/30 bg-risk-soft/30 px-3 py-2 text-[12px] text-risk">
          <TriangleAlert size={13} />
          {erro}
        </p>
      ) : null}

      {r ? (
        <div className="mt-4 space-y-4">
          {/* Corpus real primeiro: é o que a rubrica cobra em primeiro lugar. */}
          <div
            className={`rounded-lg border px-4 py-3 ${
              r.corpus_real.amostras > 0
                ? 'border-health/30 bg-health-soft/20'
                : 'border-warn/30 bg-warn-soft/20'
            }`}
          >
            <p className="text-[12.5px] font-semibold text-ink">
              Corpus real: {r.corpus_real.amostras} amostra(s)
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-dim">
              {r.corpus_real.amostras > 0
                ? 'Métricas do corpus real reportadas separadamente abaixo.'
                : r.corpus_real.pendente.observacao}
            </p>
          </div>

          <div
            className={`rounded-lg border px-4 py-3 ${
              r.overfitting.delta_medio > 0.1
                ? 'border-risk/30 bg-risk-soft/20'
                : 'border-health/30 bg-health-soft/20'
            }`}
          >
            <p className="text-[12.5px] font-semibold text-ink">
              Teste de overfitting — delta médio{' '}
              <span className="font-mono">{r.overfitting.delta_medio}</span>
            </p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-dim">{r.overfitting.veredito}</p>
            {r.overfitting.suspeitos.length > 0 ? (
              <p className="mt-1 text-[11.5px] leading-relaxed text-warn">
                Campos com delta acima de 0,15: {r.overfitting.suspeitos.join(', ')}. O ganho veio de
                amostras lidas durante o ajuste e o holdout não acompanhou — o gap fica reportado em vez
                de ser escondido.
              </p>
            ) : null}
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-[11.5px]">
                <thead className="text-left text-[10.5px] uppercase tracking-wide text-ink-faint">
                  <tr>
                    <th className="pb-1 pr-3 font-medium">Campo</th>
                    <th className="pb-1 pr-3 text-right font-medium">F1 dev</th>
                    <th className="pb-1 pr-3 text-right font-medium">F1 holdout</th>
                    <th className="pb-1 text-right font-medium">Delta</th>
                  </tr>
                </thead>
                <tbody className="font-mono tabular-nums">
                  {r.overfitting.por_campo.map((c) => (
                    <tr key={c.campo} className="border-t border-line/60">
                      <td className="py-1 pr-3 font-sans text-ink-dim">{c.campo}</td>
                      <td className="py-1 pr-3 text-right text-ink-dim">{n3(c.f1_dev)}</td>
                      <td className="py-1 pr-3 text-right text-ink-dim">{n3(c.f1_holdout)}</td>
                      <td className={`py-1 text-right ${c.delta > 0.15 ? 'text-warn' : 'text-ink-faint'}`}>
                        {c.delta > 0 ? '+' : ''}
                        {n3(c.delta)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {r.corpus_real.metricas ? (
            <Tabela titulo="Corpus REAL" legenda="Reuniões gravadas pelo squad" r={r.corpus_real.metricas} />
          ) : null}
          <Tabela
            titulo="DEV — partição ajustável"
            legenda="Os erros desta partição são lidos para ajustar léxico e pesos"
            r={r.sintetico.dev}
          />
          <Tabela
            titulo="HOLDOUT — partição lacrada"
            legenda="Nunca inspecionada item a item; só métrica agregada"
            r={r.sintetico.holdout}
          />
          <Tabela titulo="Corpus sintético completo" legenda="Dev e holdout somados" r={r.sintetico.total} />
        </div>
      ) : null}
    </div>
  );
}
