import { NextResponse } from 'next/server';
import { ARCO_JOAO } from '@/lib/validation/corpus/arco-joao';
import { CORPUS_DEV, CORPUS_HOLDOUT } from '@/lib/validation/corpus-sintetico';
import { criarReuniaoComAnalise, definirCliente } from '@/lib/supabase/persistencia';
import { supabaseConfigurado, supabaseServer } from '@/lib/supabase/server';
import type { Amostra } from '@/lib/validation/tipos';

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

/**
 * O corpus descreve cenários com mais nuance do que a coluna `meeting_type`
 * aceita (ela tem CHECK). Este é o mapeamento do vocabulário do corpus para o
 * vocabulário do banco — sem inventar tipo que a migration não permite.
 */
const TIPO_DO_CENARIO: Record<string, string> = {
  primeiro_contato: 'primeiro_contato',
  descoberta: 'descoberta',
  demonstracao: 'demonstracao',
  negociacao: 'negociacao',
  proposta: 'proposta',
  follow_up: 'follow_up',
  renovacao: 'renovacao',
  customer_success_saudavel: 'customer_success',
  customer_success_insatisfeito: 'customer_success',
  upsell_modulo: 'negociacao',
  expansao: 'negociacao',
  alinhamento_tecnico: 'reuniao',
  administrativa: 'reuniao',
  institucional: 'reuniao',
  reuniao_sem_conclusao: 'reuniao',
};

const ROTULO_CENARIO: Record<string, string> = {
  primeiro_contato: 'Primeiro contato',
  descoberta: 'Descoberta',
  demonstracao: 'Demonstração',
  negociacao: 'Negociação',
  proposta: 'Proposta',
  follow_up: 'Follow-up',
  renovacao: 'Renovação',
  customer_success_saudavel: 'Customer Success',
  customer_success_insatisfeito: 'Customer Success — insatisfação',
  upsell_modulo: 'Upsell de módulo',
  expansao: 'Expansão de filiais',
  alinhamento_tecnico: 'Alinhamento técnico',
  administrativa: 'Reunião administrativa',
  institucional: 'Reunião institucional',
  reuniao_sem_conclusao: 'Reunião sem conclusão',
};

/**
 * Data de fallback para amostra sem data própria: distribui as reuniões nos
 * últimos meses em vez de empilhar todas em hoje, para as telas de evolução e
 * de recência terem uma linha do tempo plausível.
 */
function dataDaAmostra(a: Amostra, indice: number): string {
  if (a.data) return a.data;
  const d = new Date();
  d.setDate(d.getDate() - (7 + indice * 5));
  return d.toISOString().slice(0, 10);
}

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

    // Idempotência por reunião, não por lote: o seed pode ser chamado de novo
    // depois de crescer o corpus e só ingere o que ainda não está na base.
    const jaExistem = await sb.from('meetings').select('title').eq('source', 'corpus').limit(2000);
    if (jaExistem.error) {
      throw new Error(`Falha ao verificar reuniões: ${jaExistem.error.message}`);
    }
    const titulosNaBase = new Set((jaExistem.data ?? []).map((m) => m.title));

    // Ordem cronológica é obrigatória: a memória de cada reunião é construída
    // pelas anteriores.
    const emOrdem = [...ARCO_JOAO].sort((a, b) => (a.data ?? '').localeCompare(b.data ?? ''));

    const criadas: { codigo: string; id: string; titulo: string }[] = [];
    for (const amostra of emOrdem) {
      const titulo = TITULO[amostra.cenario] ?? amostra.cenario;
      if (titulosNaBase.has(titulo)) continue;
      titulosNaBase.add(titulo);
      const id = await criarReuniaoComAnalise({
        titulo,
        tipo: amostra.cenario as never,
        data: amostra.data ?? new Date().toISOString().slice(0, 10),
        clienteNome: CLIENTE,
        texto: amostra.texto,
        origem: 'corpus',
      });
      criadas.push({ codigo: amostra.codigo, id, titulo });
    }

    /*
     * Corpus sintético completo.
     *
     * O Radar de Dores e a tela de Coaching só existem com volume: uma dor não
     * forma cluster e um talk ratio não forma faixa de referência. São as mesmas
     * amostras que a validação mede, ingeridas como reuniões de verdade — a
     * origem 'corpus' deixa isso explícito na base e na UI.
     */
    const outras = [...CORPUS_DEV, ...CORPUS_HOLDOUT];
    let corpusCriado = 0;
    const falhas: { codigo: string; erro: string }[] = [];

    for (const [i, amostra] of outras.entries()) {
      const nome = amostra.cliente?.trim();
      if (!nome) continue; // sem conta, a reunião ficaria órfã na torre
      // O código da amostra entra no título por dois motivos: garante unicidade
      // (duas amostras podem ter o mesmo cliente e cenário) e liga a reunião
      // exibida na tela à amostra medida em scripts/validar.ts.
      const titulo = `${ROTULO_CENARIO[amostra.cenario] ?? amostra.cenario} — ${nome} · ${amostra.codigo}`;
      if (titulosNaBase.has(titulo)) continue;
      // Marcar antes de criar protege contra duplicar dentro da mesma execução.
      titulosNaBase.add(titulo);
      try {
        await criarReuniaoComAnalise({
          titulo,
          tipo: (TIPO_DO_CENARIO[amostra.cenario] ?? 'reuniao') as never,
          data: dataDaAmostra(amostra, i),
          clienteNome: nome,
          texto: amostra.texto,
          origem: 'corpus',
        });
        corpusCriado++;
      } catch (erro) {
        // Uma amostra problemática não pode abortar o seed inteiro; o que falhou
        // é reportado em vez de sumir.
        falhas.push({ codigo: amostra.codigo, erro: erro instanceof Error ? erro.message : 'desconhecido' });
      }
    }

    return NextResponse.json(
      { cliente_id: clienteId, arco: criadas, corpus: corpusCriado, falhas },
      { status: 201 },
    );
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao semear a base.';
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
