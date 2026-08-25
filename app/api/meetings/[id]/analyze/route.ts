import { NextResponse } from 'next/server';
import { reanalisarReuniao } from '@/lib/supabase/persistencia';
import { supabaseConfigurado } from '@/lib/supabase/server';

/**
 * Reprocessa uma reunião com a versão atual do motor.
 *
 * O motor evolui — léxico ganha expressão, regra fica mais precisa. A
 * transcrição continua a mesma, mas a leitura dela melhora, e sem isto o
 * briefing exibiria para sempre a interpretação do dia da ingestão.
 *
 * Não aceita texto novo: reprocessar é reler o mesmo dado bruto. Para analisar
 * outra transcrição, cria-se outra reunião.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: 'Banco não configurado.' }, { status: 503 });
  }

  const { id } = await params;

  try {
    await reanalisarReuniao(id);
    return NextResponse.json({ id, reprocessada: true });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao reprocessar a reunião.';
    const naoEncontrada = mensagem.includes('não encontrada');
    return NextResponse.json({ erro: mensagem }, { status: naoEncontrada ? 404 : 500 });
  }
}
