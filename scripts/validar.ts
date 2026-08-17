/**
 * Roda o motor sobre o corpus inteiro e imprime a tabela de métricas.
 *
 *   npm run validar              → dev, holdout e total
 *   npm run validar -- --erros   → lista os erros da partição DEV (só dev!)
 *
 * O holdout nunca é aberto item a item: se eu ler os erros dele para ajustar
 * léxico, ele deixa de ser holdout e a métrica vira propaganda.
 */
import { analisar } from '../lib/analysis/index';
import { CORPUS_SINTETICO, coberturaCorpus } from '../lib/validation/corpus-sintetico';
import { CORPUS_REAL, CORPUS_REAL_PENDENTE } from '../lib/validation/corpus-real';
import { calcularMetricas, type ResultadoAmostra, type RelatorioMetricas } from '../lib/validation/metrics';
import type { Amostra } from '../lib/validation/tipos';

const mostrarErros = process.argv.includes('--erros');

const p = (s = '') => console.log(s);
const barra = (t: string) => {
  p();
  p(`═══ ${t} ${'═'.repeat(Math.max(0, 66 - t.length))}`);
};

function rodar(amostras: Amostra[]): ResultadoAmostra[] {
  return amostras.map((a) => {
    const t0 = performance.now();
    const analise = analisar({ texto: a.texto, dataReuniao: a.data ?? '2026-08-14' });
    const latencia = performance.now() - t0;
    return {
      codigo: a.codigo,
      particao: a.particao,
      latencia_ms: Number(latencia.toFixed(2)),
      palavras: (a.texto.match(/[\p{L}\p{N}]+/gu) ?? []).length,
      analise,
      gold: a.gold,
    };
  });
}

function tabela(titulo: string, m: RelatorioMetricas) {
  barra(titulo);
  p(`amostras: ${m.amostras}`);
  p();
  p('campo                     precisão   recall      F1   suporte');
  p('─'.repeat(60));
  for (const [nome, v] of Object.entries(m.campos)) {
    p(
      `${nome.padEnd(24)} ${v.precision.toFixed(3).padStart(8)} ${v.recall.toFixed(3).padStart(8)} ${v.f1
        .toFixed(3)
        .padStart(7)} ${String(v.suporte).padStart(9)}`,
    );
  }

  p();
  p('acurácia');
  p('─'.repeat(60));
  for (const [nome, v] of Object.entries(m.acuracias)) {
    p(`${nome.padEnd(24)} ${v.taxa.toFixed(3).padStart(8)}   (${v.acertos}/${v.total})`);
  }

  p();
  p(`MAE interesse: ${m.mae.interesse} pontos · MAE talk ratio: ${m.mae.talk_ratio}`);
  p(`cobertura de evidência: ${(m.cobertura_evidencia * 100).toFixed(2)}%`);

  p();
  p('matriz de confusão — risco de churn (linha = gabarito, coluna = motor)');
  p('            baixo   medio    alto');
  for (const [esperado, linha] of Object.entries(m.matriz_churn)) {
    p(
      `  ${esperado.padEnd(8)} ${String(linha.baixo ?? 0).padStart(5)} ${String(linha.medio ?? 0).padStart(7)} ${String(
        linha.alto ?? 0,
      ).padStart(7)}`,
    );
  }

  const fp = m.falso_positivo_sem_sinal;
  p();
  p(`falso positivo nas ${fp.amostras} amostras sem sinal comercial:`);
  p(`  concorrentes ${fp.concorrentes} · objeções ${fp.objecoes} · churn ${fp.churn} · budget ${fp.budget}`);

  p();
  p(`latência p50 ${m.latencia.p50}ms · p95 ${m.latencia.p95}ms · média ${m.latencia.media}ms`);
  p(`throughput: ${m.throughput_por_min} análises/minuto nesta máquina`);
}

/* ------------------------------------------------------------------ */

barra('CORPUS');
const cob = coberturaCorpus();
p(`sintético: ${cob.total} amostras (${cob.dev} dev · ${cob.holdout} holdout) em ${cob.cenarios} cenários`);
p(`real: ${CORPUS_REAL.length} amostras — ${CORPUS_REAL_PENDENTE.observacao}`);
p();
p('cobertura de sinais no corpus sintético');
p('─'.repeat(60));
const alvos: [string, number, number][] = [
  ['com concorrente', cob.com_concorrente, 8],
  ['com objeção de preço', cob.com_objecao_preco, 8],
  ['com churn claro', cob.com_churn_claro, 6],
  ['com gatilho de upsell', cob.com_upsell, 10],
  ['com budget declarado', cob.com_budget, 6],
  ['sem sinal (mede falso positivo)', cob.sem_sinal, 4],
  ['oportunidade Techfin', cob.techfin, 3],
  ['oportunidade RD Station', cob.rd_station, 2],
];
for (const [nome, valor, alvo] of alvos) {
  p(`${nome.padEnd(34)} ${String(valor).padStart(3)} / mín ${alvo}   ${valor >= alvo ? 'ok' : 'ABAIXO'}`);
}

// Aquecimento: a primeira execução carrega e otimiza o código, e mediria errado.
rodar(CORPUS_SINTETICO.slice(0, 5));

const todos = rodar(CORPUS_SINTETICO);
const dev = todos.filter((r) => r.particao === 'dev');
const holdout = todos.filter((r) => r.particao === 'holdout');

const mDev = calcularMetricas(dev);
const mHold = calcularMetricas(holdout);
const mTodos = calcularMetricas(todos);

tabela('DEV — ajustável, eu leio os erros daqui', mDev);
tabela('HOLDOUT — lacrado, só métrica agregada', mHold);
tabela('CORPUS SINTÉTICO COMPLETO', mTodos);

barra('DEV vs HOLDOUT — teste de overfitting');
p('campo                       F1 dev   F1 hold    delta');
p('─'.repeat(60));
let somaDelta = 0;
let n = 0;
for (const nome of Object.keys(mDev.campos)) {
  const d = mDev.campos[nome]?.f1 ?? 0;
  const h = mHold.campos[nome]?.f1 ?? 0;
  const delta = Number((d - h).toFixed(3));
  somaDelta += delta;
  n++;
  const marca = delta > 0.15 ? '  <-- suspeito' : '';
  p(`${nome.padEnd(24)} ${d.toFixed(3).padStart(8)} ${h.toFixed(3).padStart(9)} ${delta.toFixed(3).padStart(8)}${marca}`);
}
p();
p(`delta médio: ${(somaDelta / n).toFixed(3)}`);
p(
  somaDelta / n > 0.1
    ? 'ATENÇÃO: dev bem acima do holdout sugere ajuste excessivo ao que eu li.'
    : 'Delta baixo: o motor generaliza para amostras que não foram usadas no ajuste.',
);

if (mostrarErros) {
  barra('ERROS DA PARTIÇÃO DEV (holdout não é aberto)');
  for (const r of dev) {
    const a = r.analise;
    const g = r.gold;
    const linhas: string[] = [];

    for (const esp of g.produtos) {
      const obt = a.totvs_products.find((p) => p.name.toLowerCase() === esp.nome.toLowerCase());
      if (!obt) linhas.push(`  produto NÃO ACHADO: ${esp.nome} (${esp.status})`);
      else if (obt.status !== esp.status) {
        linhas.push(`  status errado: ${esp.nome} → esperado ${esp.status}, veio ${obt.status}`);
      }
    }
    const extras = a.totvs_products.filter(
      (p) => !g.produtos.some((e) => e.nome.toLowerCase() === p.name.toLowerCase()),
    );
    for (const e of extras) linhas.push(`  produto A MAIS: ${e.name} (${e.status})`);

    const dorEsp = new Set(g.dores);
    const dorObt = new Set(a.problems.map((p) => p.category));
    for (const d of dorEsp) if (!dorObt.has(d)) linhas.push(`  dor NÃO ACHADA: ${d}`);
    for (const d of dorObt) if (!dorEsp.has(d)) linhas.push(`  dor A MAIS: ${d}`);

    const objEsp = new Set<string>(g.objecoes);
    const objObt = new Set<string>(a.objections.map((o) => o.category));
    for (const o of objEsp) if (!objObt.has(o)) linhas.push(`  objeção NÃO ACHADA: ${o}`);
    for (const o of objObt) if (!objEsp.has(o)) linhas.push(`  objeção A MAIS: ${o}`);

    const uniEsp = new Set<string>(g.unidades_oportunidade);
    const uniObt = new Set<string>(a.opportunities.map((o) => o.unit));
    for (const u of uniEsp) if (!uniObt.has(u)) linhas.push(`  unidade NÃO ACHADA: ${u}`);

    if (a.sentiment !== g.sentimento) linhas.push(`  sentimento: esperado ${g.sentimento}, veio ${a.sentiment}`);
    if (a.persona.decision_power !== g.poder_decisao) {
      linhas.push(`  poder: esperado ${g.poder_decisao}, veio ${a.persona.decision_power}`);
    }
    if (a.interest_score < g.interesse[0] || a.interest_score > g.interesse[1]) {
      linhas.push(`  interesse: esperado ${g.interesse[0]}-${g.interesse[1]}, veio ${a.interest_score}`);
    }
    const banda = a.churn_risk >= 67 ? 'alto' : a.churn_risk >= 34 ? 'medio' : 'baixo';
    if (banda !== g.churn_risco) {
      linhas.push(`  churn: esperado ${g.churn_risco}, veio ${banda} (${a.churn_risk})`);
    }
    if (g.budget !== null && !a.budget.some((b) => b.amount === g.budget)) {
      linhas.push(`  budget: esperado ${g.budget}, veio [${a.budget.map((b) => b.amount).join(', ')}]`);
    }

    if (linhas.length > 0) {
      p();
      p(`${r.codigo} (${r.palavras} palavras)`);
      for (const l of linhas) p(l);
    }
  }
}

barra('PROJEÇÃO DE ESCALA');
const porMin = mTodos.throughput_por_min;
p(`throughput medido: ${porMin} análises/minuto em 1 processo desta máquina`);
p(`10.000 reuniões/dia = ${(10000 / (porMin * 60)).toFixed(2)} horas-processo por dia`);
p(`custo de API por análise: R$ 0,00 — o motor é 100% determinístico`);
p();
