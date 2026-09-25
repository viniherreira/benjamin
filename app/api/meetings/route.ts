import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buscarReuniaoIdentica, criarReuniaoComAnalise } from '@/lib/supabase/persistencia';
import { supabaseConfigurado } from '@/lib/supabase/server';

/**
 * Ingestão de reunião (UC01 → UC02): recebe a transcrição, roda o motor e
 * persiste reunião + transcrição + análise + tarefas + alertas. Devolve o id
 * para a UI redirecionar ao briefing.
 *
 * O motor é determinístico e roda em processo Node — nada de edge aqui.
 *
 * O importador em lote chama esta mesma rota, uma reunião por requisição: cada
 * chamada é uma invocação independente, e é isso que deixa cem reuniões
 * rodarem em paralelo sem um servidor de fila. Ele manda `idempotente: true`,
 * e aí uma reunião idêntica já analisada volta com 200 em vez de ser criada de
 * novo — reenviar um lote interrompido não duplica nada.
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
  texto: z
    .string()
    .trim()
    .min(20, 'A transcrição precisa ter ao menos 20 caracteres.')
    .max(1_500_000, 'Transcrição grande demais para uma reunião.'),
  origem: z.enum(['paste', 'batch']).default('paste'),
  idempotente: z.boolean().default(false),
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

  const { titulo, tipo, data, clienteNome, texto, origem, idempotente } = parsed.data;
  const dataReuniao = data ?? new Date().toISOString().slice(0, 10);

  try {
    if (idempotente) {
      const existente = await buscarReuniaoIdentica({ titulo, data: dataReuniao, texto });
      if (existente) return NextResponse.json({ id: existente, jaExistia: true }, { status: 200 });
    }
    const id = await criarReuniaoComAnalise({
      titulo,
      tipo,
      data: dataReuniao,
      clienteNome,
      texto,
      origem,
    });
    return NextResponse.json({ id, jaExistia: false }, { status: 201 });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao analisar a reunião.';
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
