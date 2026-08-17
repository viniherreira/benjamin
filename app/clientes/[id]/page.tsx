import { notFound } from 'next/navigation';
import { PageHeader, BotaoLink } from '@/components/ui';
import { PlaceholderFase } from '@/components/placeholder-fase';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Cliente' };

export default async function ClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sb = supabaseServer();
  const { data } = await sb.from('customers').select('id, name, segment').eq('id', id).maybeSingle();

  if (!data) notFound();

  const cliente = data as { id: string; name: string; segment: string | null };

  return (
    <>
      <PageHeader
        titulo={cliente.name}
        descricao={cliente.segment ?? 'Memória consolidada da conta'}
        acoes={
          <BotaoLink href={`/clientes/${cliente.id}/preparar`} variante="primario">
            Preparar próxima reunião
          </BotaoLink>
        }
      />
      <PlaceholderFase
        fase={4}
        conteudo={[
          'Health score grande com os fatores que o compõem.',
          'Evolução do interesse e da confiança ao longo das reuniões.',
          'Stack TOTVS: o que está em uso e o que é oportunidade, por unidade de negócio.',
          'Necessidades em aberto com contador de menções e objeções recorrentes destacadas.',
          'Linha do tempo, decisões e tarefas dos dois lados, com atraso em destaque.',
        ]}
      />
    </>
  );
}
