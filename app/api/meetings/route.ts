import { NextResponse } from 'next/server';
import { z } from 'zod';
import { criarReuniaoComAnalise } from '@/lib/supabase/persistencia';
import { supabaseConfigurado } from '@/lib/supabase/server';

/**
 * Ingestão de reunião (UC01 → UC02): recebe a transcrição, roda o motor e
 * persiste reunião + transcrição + análise + tarefas + alertas. Devolve o id
 * para a UI redirecionar ao briefing.
 *
 * O motor é determinístico e roda em processo Node — nada de edge aqui.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TIPOS = [
  'primeiro_contato',
  'descoberta',
  'demonstracao',
  'negociacao',
  'proposta',
  'follow_up',
  'customer_success',
  'renovacao',
  'reuniao',
] as const;

const Corpo = z.object({
  titulo: z.string().trim().min(1, 'Dê um título à reunião.').max(160),
  tipo: z.enum(TIPOS).default('reuniao'),
  data: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data deve estar em AAAA-MM-DD.')
    .optional(),
  clienteNome: z.string().trim().max(120).optional(),
  texto: z.string().trim().min(20, 'A transcrição precisa ter ao menos 20 caracteres.'),
});

export async function POST(req: Request) {
  if (!supabaseConfigurado()) {
    return NextResponse.json(
      {
        erro:
          'Banco não configurado. Defina NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local e reinicie o servidor.',
      },
      { status: 503 },
    );
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

  const { titulo, tipo, data, clienteNome, texto } = parsed.data;

  try {
    const id = await criarReuniaoComAnalise({
      titulo,
      tipo,
      data: data ?? new Date().toISOString().slice(0, 10),
      clienteNome,
      texto,
    });
    return NextResponse.json({ id }, { status: 201 });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao analisar a reunião.';
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
