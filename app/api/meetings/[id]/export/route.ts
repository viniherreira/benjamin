import { NextResponse } from 'next/server';
import { carregarBriefing } from '@/lib/supabase/persistencia';
import { supabaseConfigurado } from '@/lib/supabase/server';

/**
 * UC09 — exportação para CRM.
 *
 * O quadro da Entrega 1 diz que a v1 NÃO integra a um CRM. O que este endpoint
 * faz é produzir o payload com os campos já mapeados, em JSON ou CSV: é a peça
 * que uma integração consumiria, entregue de forma que o vendedor consiga usar
 * hoje (baixar, colar, importar) sem prometer uma integração que não existe.
 *
 *   GET /api/meetings/:id/export            → JSON
 *   GET /api/meetings/:id/export?formato=csv → CSV (uma linha por reunião)
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Campos achatados, no formato que um CRM espera receber. */
function paraLinhaCrm(dados: NonNullable<Awaited<ReturnType<typeof carregarBriefing>>>) {
  const a = dados.analise;
  const r = dados.reuniao;

  return {
    reuniao_id: r.id,
    titulo: r.title,
    cliente: r.cliente ?? '',
    data: r.meeting_date,
    tipo: r.meeting_type,
    duracao_min: r.duration_min ?? '',
    resumo: a?.summary ?? '',
    sentimento: a?.sentiment ?? '',
    interesse: a?.interest_score ?? '',
    risco_churn: a?.churn_risk ?? '',
    confianca: a?.trust_score ?? '',
    bant_score: a?.bant?.score ?? '',
    bant_faltando: a?.bant?.missing.join('; ') ?? '',
    persona_cargo: a?.persona?.role ?? '',
    persona_poder: a?.persona?.decision_power ?? '',
    produtos_totvs: a?.totvs_products.map((p) => `${p.name} (${p.status})`).join('; ') ?? '',
    oportunidades:
      a?.opportunities.map((o) => `${o.product} [${Math.round(o.probability * 100)}%]`).join('; ') ?? '',
    concorrentes:
      a?.competitors.map((c) => `${c.name}${c.active ? ' (ativo)' : ' (histórico)'}`).join('; ') ?? '',
    objecoes: a?.objections.map((o) => `${o.category}: ${o.text}`).join('; ') ?? '',
    necessidades: a?.customer_needs.map((n) => n.text).join('; ') ?? '',
    proximos_passos: a?.next_steps.map((n) => n.text).join('; ') ?? '',
    tarefas:
      a?.action_items
        .map((t) => `${t.description}${t.due_date ? ` [${t.due_date}]` : ''} (${t.side})`)
        .join('; ') ?? '',
    budget: a?.budget.map((b) => (b.amount != null ? `R$ ${b.amount}` : b.raw)).join('; ') ?? '',
    talk_ratio_vendedor: a?.conversation_metrics.talk_ratio_seller ?? '',
    confiabilidade_transcricao: a?.transcript_quality.reliability_index ?? '',
    motor: a?.engine ?? '',
    latencia_ms: a?.latency_ms ?? '',
  };
}

/** CSV RFC 4180: aspas duplicadas e campo entre aspas quando necessário. */
function csvEscape(valor: unknown): string {
  const s = String(valor ?? '');
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: 'Banco não configurado.' }, { status: 503 });
  }

  const { id } = await params;
  const formato = new URL(req.url).searchParams.get('formato') ?? 'json';

  let dados: Awaited<ReturnType<typeof carregarBriefing>>;
  try {
    dados = await carregarBriefing(id);
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao carregar a reunião.';
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }

  if (!dados) {
    return NextResponse.json({ erro: 'Reunião não encontrada.' }, { status: 404 });
  }
  if (!dados.analise) {
    return NextResponse.json(
      { erro: 'Esta reunião ainda não tem análise — não há o que exportar.' },
      { status: 409 },
    );
  }

  const linha = paraLinhaCrm(dados);
  const base = `insightiq-${dados.reuniao.meeting_date}-${id.slice(0, 8)}`;

  if (formato === 'csv') {
    const cabecalho = Object.keys(linha).join(',');
    const valores = Object.values(linha).map(csvEscape).join(',');
    // BOM para o Excel em pt-BR abrir o arquivo em UTF-8 sem quebrar acentos.
    const corpo = `﻿${cabecalho}\n${valores}\n`;

    return new NextResponse(corpo, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${base}.csv"`,
      },
    });
  }

  return NextResponse.json(
    {
      gerado_em: new Date().toISOString(),
      origem: 'InsightIQ',
      campos_crm: linha,
      // A evidência vai junto: é o que permite auditar cada campo no CRM.
      evidencias: dados.analise.totvs_products
        .map((p) => ({ campo: 'produto', valor: p.name, citacao: p.evidence.quote }))
        .concat(
          dados.analise.competitors.map((c) => ({
            campo: 'concorrente',
            valor: c.name,
            citacao: c.evidence.quote,
          })),
          dados.analise.objections.map((o) => ({
            campo: 'objecao',
            valor: o.category,
            citacao: o.evidence.quote,
          })),
        ),
    },
    {
      headers: { 'Content-Disposition': `attachment; filename="${base}.json"` },
    },
  );
}
