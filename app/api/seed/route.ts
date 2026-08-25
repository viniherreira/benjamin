import { NextResponse } from 'next/server';
import { ARCO_JOAO } from '@/lib/validation/corpus/arco-joao';
import { criarReuniaoComAnalise, definirCliente } from '@/lib/supabase/persistencia';
import { supabaseConfigurado, supabaseServer } from '@/lib/supabase/server';

/**
 * Popula a base com o arco narrativo de 5 reuniões da Metalúrgica Vale Verde.
 *
 * O texto vem de `lib/validation/corpus/arco-joao.ts` — o MESMO usado na
 * validação. Nada é escrito só para a demonstração: se a métrica reportada
 * cobre estas reuniões, a tela mostra exatamente aquilo que foi medido.
 *
 * As reuniões são ingeridas em ordem cronológica, uma a uma, porque cada
 * análise recebe como contexto a memória construída pelas anteriores. É assim
 * que a plataforma conclui sozinha que preço virou objeção recorrente.
 *
 * Idempotente: se o cliente já tem reuniões, não duplica nada.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const CLIENTE = 'Metalúrgica Vale Verde';

const TITULO: Record<string, string> = {
  descoberta: 'Descoberta — dor de folha manual no RH',
  demonstracao: 'Demonstração — RM integrado ao Protheus',
  negociacao: 'Negociação — proposta faseada e entrada da Senior',
  follow_up: 'Follow-up — preço pela terceira vez e desconfiança técnica',
  proposta: 'Proposta — ROI para o CFO e data de decisão',
};

export async function POST() {
  if (!supabaseConfigurado()) {
    return NextResponse.json(
      { erro: 'Banco não configurado. Defina as variáveis de ambiente do Supabase.' },
      { status: 503 },
    );
  }

  try {
    const sb = supabaseServer();

    // Parâmetros de negócio do cliente. Declarados aqui, exibidos como
    // premissa na UI — é a base do cálculo de receita em risco.
    const clienteId = await definirCliente(CLIENTE, {
      segmento: 'Indústria / Metalurgia',
      porte: 'Médio porte',
      estagio: 'negociacao',
      valorContrato: 180_000,
    });

    const existentes = await sb
      .from('meetings')
      .select('id', { count: 'exact', head: true })
      .eq('customer_id', clienteId);
    if (existentes.error) {
      throw new Error(`Falha ao verificar reuniões: ${existentes.error.message}`);
    }
    if ((existentes.count ?? 0) > 0) {
      return NextResponse.json({
        ja_semeado: true,
        cliente_id: clienteId,
        reunioes: existentes.count,
        mensagem: 'O arco já está na base. Nada foi duplicado.',
      });
    }

    // Ordem cronológica é obrigatória: a memória de cada reunião é construída
    // pelas anteriores.
    const emOrdem = [...ARCO_JOAO].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''));

    const criadas: { codigo: string; id: string; titulo: string }[] = [];
    for (const amostra of emOrdem) {
      const id = await criarReuniaoComAnalise({
        titulo: TITULO[amostra.cenario] ?? amostra.cenario,
        tipo: amostra.cenario as never,
        data: amostra.data ?? new Date().toISOString().slice(0, 10),
        clienteNome: CLIENTE,
        texto: amostra.texto,
        origem: 'corpus',
      });
      criadas.push({ codigo: amostra.codigo, id, titulo: TITULO[amostra.cenario] ?? amostra.cenario });
    }

    return NextResponse.json({ cliente_id: clienteId, criadas }, { status: 201 });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao semear a base.';
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
