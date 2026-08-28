import { MessagesSquare } from 'lucide-react';
import { BotaoLink, EmptyState, PageHeader } from '@/components/ui';
import { supabaseConfigurado, supabaseServer } from '@/lib/supabase/server';
import { SemBanco } from '@/components/sem-banco';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Reuniões' };

type LinhaReuniao = {
  id: string;
  title: string;
  meeting_date: string;
  meeting_type: string;
  status: string;
};

export default async function ReunioesPage() {
  if (!supabaseConfigurado()) {
    return (
      <>
        <PageHeader
          titulo="Reuniões"
          descricao="Todas as transcrições analisadas, com sentimento, interesse, talk ratio e confiabilidade do dado."
          acoes={
            <BotaoLink href="/reunioes/nova" variante="primario">
              Nova reunião
            </BotaoLink>
          }
        />
        <SemBanco oQueApareceAqui="Aqui fica a lista das transcrições analisadas, com título, cliente, data, tipo, sentimento, interesse, talk ratio e índice de confiabilidade." />
      </>
    );
  }

  const sb = supabaseServer();
  const { data, error } = await sb
    .from('meetings')
    .select('id, title, meeting_date, meeting_type, status')
    .order('meeting_date', { ascending: false })
    .limit(100);

  if (error) throw new Error(`Falha ao carregar reuniões: ${error.message}`);

  const reunioes = (data ?? []) as LinhaReuniao[];

  return (
    <>
      <PageHeader
        titulo="Reuniões"
        descricao="Todas as transcrições analisadas, com sentimento, interesse, talk ratio e confiabilidade do dado."
        acoes={
          <BotaoLink href="/reunioes/nova" variante="primario">
            Nova reunião
          </BotaoLink>
        }
      />

      {reunioes.length === 0 ? (
        <EmptyState
          icone={<MessagesSquare size={18} />}
          titulo="Nenhuma reunião na base"
          descricao="Cole a transcrição de uma reunião para o motor analisar. A lista mostra título, cliente, data, tipo, sentimento, interesse, talk ratio e índice de confiabilidade, com filtros e busca dentro do texto das transcrições."
          acao={
            <BotaoLink href="/reunioes/nova" variante="primario">
              Analisar uma transcrição
            </BotaoLink>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-[12.5px]">
            <thead className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-2.5 font-medium">Reunião</th>
                <th className="px-4 py-2.5 font-medium">Data</th>
                <th className="px-4 py-2.5 font-medium">Tipo</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {reunioes.map((r) => (
                <tr key={r.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <a href={`/reunioes/${r.id}`} className="text-ink hover:text-accent">
                      {r.title}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-ink-dim">
                    {r.meeting_date}
                  </td>
                  <td className="px-4 py-2.5 text-ink-dim">{r.meeting_type}</td>
                  <td className="px-4 py-2.5 font-mono text-ink-dim">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
