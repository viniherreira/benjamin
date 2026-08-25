import { NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseConfigurado, supabaseServer } from '@/lib/supabase/server';
import { garantirOrgEUsuaria } from '@/lib/supabase/persistencia';
import type { Json } from '@/lib/supabase/database.types';

/**
 * IH + IA — a correção humana vira dado.
 *
 * Um dos valores da TOTVS é "a soma das inteligências humana e artificial", e o
 * quadro da Entrega 1 diz que o produto NÃO substitui trabalho humano. Aqui isso
 * deixa de ser slide: a IA propõe, o vendedor confirma ou corrige, e cada
 * intervenção é registrada com o valor antes e depois.
 *
 * A taxa de correção por campo é exibida na tela de Validação — o sistema mede
 * a própria falibilidade em vez de esperar que ninguém pergunte.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Corpo = z.object({
  analysis_id: z.string().uuid('analysis_id precisa ser um UUID.'),
  field: z.string().trim().min(1).max(60),
  action: z.enum(['add', 'edit', 'remove', 'confirm']),
  before_value: z.unknown().optional(),
  after_value: z.unknown().optional(),
});

export async function POST(req: Request) {
  if (!supabaseConfigurado()) {
    return NextResponse.json({ erro: 'Banco não configurado.' }, { status: 503 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ erro: 'Corpo da requisição não é JSON válido.' }, { status: 400 });
  }

  const parsed = Corpo.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { erro: parsed.error.issues[0]?.message ?? 'Dados inválidos.' },
      { status: 422 },
    );
  }

  const { analysis_id, field, action, before_value, after_value } = parsed.data;

  try {
    const sb = supabaseServer();
    const ctx = await garantirOrgEUsuaria();

    const ins = await sb
      .from('corrections')
      .insert({
        analysis_id,
        user_id: ctx.userId,
        field,
        action,
        before_value: (before_value ?? null) as Json,
        after_value: (after_value ?? null) as Json,
      })
      .select('id')
      .single();

    if (ins.error) {
      // FK inexistente é erro do cliente, não do servidor.
      const ehFk = ins.error.message.includes('foreign key');
      return NextResponse.json({ erro: ins.error.message }, { status: ehFk ? 404 : 500 });
    }

    return NextResponse.json({ id: ins.data.id }, { status: 201 });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao registrar a correção.';
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
