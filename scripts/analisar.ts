/**
 * Roda o motor sobre um texto e imprime o briefing no terminal.
 *
 *   npx tsx scripts/analisar.ts                 → usa o exemplo canônico da TOTVS
 *   npx tsx scripts/analisar.ts caminho.txt     → usa um arquivo
 */
import { readFileSync } from 'node:fs';
import { analisar, EXEMPLO_CANONICO } from '../lib/analysis/index';

const arquivo = process.argv[2];
const texto = arquivo ? readFileSync(arquivo, 'utf8') : EXEMPLO_CANONICO;

const r = analisar({ texto, dataReuniao: new Date().toISOString().slice(0, 10) });

const linha = (t = '') => console.log(t);
const titulo = (t: string) => {
  linha();
  linha(`── ${t} ${'─'.repeat(Math.max(0, 62 - t.length))}`);
};

linha(`\nINSIGHTIQ · motor: ${r.engine} · ${r.latency_ms}ms`);

titulo('RESUMO');
linha(r.summary);

titulo('SCORES');
linha(`Interesse ${r.interest_score}/100 · Churn ${r.churn_risk}/100 · Confiança ${r.trust_score}/100`);
linha(`Sentimento: ${r.sentiment} (${r.sentiment_score})`);
linha(`BANT ${r.bant.score}/4${r.bant.missing.length ? ` · falta ${r.bant.missing.join(', ')}` : ''}`);

titulo('FATORES DO INTERESSE');
for (const f of r.score_factors) {
  const sinal = f.delta >= 0 ? '+' : '';
  linha(`  ${sinal}${f.delta}\t${f.label}`);
}
linha(`  =${r.score_factors.reduce((s, f) => s + f.delta, 0)}\t(soma confere com o score exibido)`);

if (r.churn_factors.length > 0) {
  titulo('FATORES DO CHURN');
  for (const f of r.churn_factors) linha(`  +${f.delta}\t${f.label}`);
}

titulo('PRODUTOS TOTVS');
for (const p of r.totvs_products) {
  linha(`  [${p.status}] ${p.name} (${p.unit}) · confiança ${p.confidence}`);
}

titulo('OPORTUNIDADES');
for (const o of r.opportunities) {
  linha(`  ${Math.round(o.probability * 100)}% ${o.product} — ${o.rationale}`);
}

titulo('CONCORRENTES');
for (const c of r.competitors) {
  linha(`  ${c.name} · ameaça ${c.threat} · ${c.active ? 'ATIVO' : 'histórico'} · ${c.context}`);
}

titulo('SENTIMENTO POR ASPECTO');
for (const a of r.aspect_sentiment) {
  linha(`  ${a.polarity.padEnd(9)} ${a.aspect} (${a.score})`);
}

titulo('PROBLEMAS');
for (const p of r.problems) linha(`  [${p.category}] ${p.text}`);

titulo('OBJEÇÕES');
for (const o of r.objections) linha(`  [${o.category}]${o.resolved ? ' (resolvida)' : ''} ${o.text}`);

titulo('BUDGET');
for (const b of r.budget) {
  linha(`  ${b.amount} BRL (${b.kind})${b.confidential ? ' · CONFIDENCIAL' : ''} — "${b.raw}"`);
}

titulo('PERSONA');
linha(`  ${r.persona.role ?? 'cargo não declarado'} · poder: ${r.persona.decision_power}`);

titulo('CONFIANÇA');
for (const s of r.trust_signals) linha(`  ${s.delta >= 0 ? '+' : ''}${s.delta}\t${s.label}`);

titulo('SINAIS');
for (const s of r.upsell_signals) linha(`  upsell +${s.weight}\t${s.text}`);
for (const s of r.churn_signals) linha(`  churn  -${s.weight}\t${s.text}`);

titulo('MÉTRICAS DE CONVERSA');
const m = r.conversation_metrics;
linha(
  m.talk_ratio_seller === null
    ? '  indisponíveis — transcrição sem marcação de falante'
    : `  talk ratio vendedor ${(m.talk_ratio_seller * 100).toFixed(0)}% · perguntas ${m.seller_questions} (${m.open_questions} abertas) · monólogo ${m.longest_monologue_words} palavras · interrupções ${m.interruptions}`,
);

titulo('QUALIDADE DA TRANSCRIÇÃO');
const q = r.transcript_quality;
linha(`  Confiabilidade ${q.reliability_index}/100 · ${q.word_count} palavras · ${q.turn_count} turnos · ${q.speaker_count} falantes`);
linha(`  diversidade léxica ${q.lexical_diversity} · muletas ${q.filler_density} · entidades mascaradas ${q.redacted_entities}`);
for (const w of q.warnings) linha(`  ! ${w}`);

titulo('VOZ DO CLIENTE');
for (const v of r.voice_of_customer) linha(`  [${v.type}]${v.target ? ` ${v.target}:` : ''} ${v.text}`);

titulo('EVIDÊNCIA (amostra)');
for (const p of r.totvs_products.slice(0, 3)) {
  linha(`  ${p.name} → [${p.evidence.start}, ${p.evidence.end}] "${p.evidence.quote.slice(0, 70)}..."`);
}

linha();
