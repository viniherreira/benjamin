import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/ui';
import { PlaceholderFase } from '@/components/placeholder-fase';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Briefing' };

export default async function BriefingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const sb = supabaseServer();
  const { data } = await sb.from('meetings').select('id, title, meeting_date').eq('id', id).maybeSingle();

  if (!data) notFound();

  const reuniao = data as { id: string; title: string; meeting_date: string };

  return (
    <>
      <PageHeader titulo={reuniao.title} descricao={`Reunião de ${reuniao.meeting_date}`} />
      <PlaceholderFase
        fase={3}
        conteudo={[
          'Briefing estruturado à esquerda, transcrição com destaque de evidência à direita.',
          'Clicar em qualquer item extraído rola a transcrição até o trecho e o destaca.',
          'Interesse, sentimento por aspecto, persona, necessidades, objeções, produtos TOTVS, concorrentes, budget.',
          'Métricas de conversa, cobertura BANT, índice de confiança e confiabilidade do dado.',
          'Exportar para CRM, reprocessar e editar qualquer campo — cada edição vira uma linha em corrections.',
        ]}
      />
    </>
  );
}
