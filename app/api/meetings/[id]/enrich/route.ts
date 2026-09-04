import { NextResponse } from 'next/server';
import { carregarBriefing } from '@/lib/supabase/persistencia';
import { supabaseConfigurado } from '@/lib/supabase/server';
import { enriquecer } from '@/lib/analysis/llm';

/**
 * Enriquecimento por LLM de uma reunião já analisada.
 *
 * É sob demanda de propósito. O motor determinístico roda em toda ingestão a
 * R$ 0,00 e 3,7 ms de p95 — é ele que sustenta a resposta às 10.000 reuniões
 * por dia. Chamar o modelo em todo volume jogaria fora exatamente esse
 * argumento; aqui ele entra só onde alguém decidiu que vale.
 *
 * Nada do que sai daqui é gravado nem substitui campo do briefing: a resposta
 * volta para a tela rotulada como gerada, ao lado do resultado das regras.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const STATUS: Record<string, number> = {
  sem_chave: 503,
  sem_texto: 422,
  limite_excedido: 429,
  provedor: 502,
  resposta_invalida: 502,
};

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: 'Banco não configurado.' }, { status: 503 });
  }

  const { id } = await params;

  const dados = await carregarBriefing(id);
  if (!dados) {
    return NextResponse.json({ erro: 'Reunião não encontrada.' }, { status: 404 });
  }

  // Enriquecer pressupõe o que enriquecer. Sem análise determinística não há
  // base — e pedir ao modelo que extraia do zero criaria uma segunda verdade
  // para campos que já têm dono.
  if (!dados.analise) {
    return NextResponse.json(
      { erro: 'Esta reunião ainda não foi analisada. Rode a análise antes de enriquecer.' },
      { status: 422 },
    );
  }

  const r = await enriquecer({ texto: dados.transcricao, analise: dados.analise });

  if (!r.ok) {
    return NextResponse.json(
      { erro: r.detalhe, motivo: r.motivo },
      { status: STATUS[r.motivo] ?? 500 },
    );
  }

  return NextResponse.json(r.dados);
}
