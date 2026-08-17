import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { PlaceholderFase } from '@/components/placeholder-fase';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Preparar reunião' };

export default async function PrepararPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sb = supabaseServer();
  const { data } = await sb.from('customers').select('id, name').eq('id', id).maybeSingle();

  if (!data) notFound();

  const cliente = data as { id: string; name: string };

  return (
    <>
      <PageHeader
        titulo={`Preparar reunião — ${cliente.name}`}
        descricao="Uma tela, para o vendedor ler cinco minutos antes da call. Copiável e imprimível."
      />
      <PlaceholderFase
        fase={4}
        conteudo={[
          'Última conversa, principal necessidade e principal objeção com contador de recorrência.',
          'Pendências dos dois lados, com destaque para o que está atrasado do nosso lado.',
          'Interesse e confiança atuais, com a variação desde a reunião anterior.',
          'Cobertura BANT e o que ainda falta descobrir.',
          'Ameaças ativas de concorrentes e recomendações priorizadas para a conversa.',
        ]}
      />
    </>
  );
}
