import { Building2 } from 'lucide-react';
import { BotaoLink, EmptyState, PageHeader } from '@/components/ui';
import { supabaseServer } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Clientes' };

type LinhaCliente = {
  id: string;
  name: string;
  stage: string;
  health_score: number;
  health_band: string;
};

export default async function ClientesPage() {
  const sb = supabaseServer();
  const { data, error } = await sb
    .from('customers')
    .select('id, name, stage, health_score, health_band')
    .order('health_score', { ascending: true })
    .limit(100);

  if (error) throw new Error(`Falha ao carregar clientes: ${error.message}`);

  const clientes = (data ?? []) as LinhaCliente[];

  return (
    <>
      <PageHeader
        titulo="Clientes"
        descricao="A memória de cada conta: health score, estágio, objeções em aberto e valor de contrato."
      />

      {clientes.length === 0 ? (
        <EmptyState
          icone={<Building2 size={18} />}
          titulo="Nenhum cliente na base"
          descricao="Os clientes nascem da primeira reunião analisada. A lista traz health score colorido, estágio no funil, número de reuniões, último contato, objeções abertas e o valor de contrato de cada conta."
          acao={
            <BotaoLink href="/reunioes/nova" variante="primario">
              Analisar uma reunião
            </BotaoLink>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-[12.5px]">
            <thead className="border-b border-line text-left text-[11px] uppercase tracking-wide text-ink-faint">
              <tr>
                <th className="px-4 py-2.5 font-medium">Cliente</th>
                <th className="px-4 py-2.5 font-medium">Estágio</th>
                <th className="px-4 py-2.5 font-medium">Health</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.id} className="border-b border-line/60 last:border-0 hover:bg-surface-2">
                  <td className="px-4 py-2.5">
                    <a href={`/clientes/${c.id}`} className="text-ink hover:text-accent">
                      {c.name}
                    </a>
                  </td>
                  <td className="px-4 py-2.5 text-ink-dim">{c.stage}</td>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-ink-dim">
                    {c.health_score}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
