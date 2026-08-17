import { MessagesSquare } from 'lucide-react';
import { BotaoLink, Card, EmptyState, PageHeader, StatTile } from '@/components/ui';
import { contagensGerais } from '@/lib/supabase/consultas';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const c = await contagensGerais();
  const vazio = c.reunioes === 0;

  return (
    <>
      <PageHeader
        titulo="Dashboard"
        descricao="Suas reuniões, suas contas e o que precisa da sua atenção hoje."
        acoes={
          <BotaoLink href="/reunioes/nova" variante="primario">
            Analisar reunião
          </BotaoLink>
        }
      />

      {vazio ? (
        <EmptyState
          icone={<MessagesSquare size={18} />}
          titulo="Nenhuma reunião analisada ainda"
          descricao="Assim que você analisar a primeira transcrição, aparecem aqui seus indicadores da semana, as contas por health score, as tarefas atrasadas e os alertas dos seus clientes."
          acao={
            <BotaoLink href="/reunioes/nova" variante="primario">
              Analisar a primeira reunião
            </BotaoLink>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile rotulo="Reuniões" valor={String(c.reunioes)} detalhe="analisadas na base" />
          <StatTile rotulo="Clientes" valor={String(c.clientes)} detalhe="com histórico" />
          <StatTile
            rotulo="Alertas"
            valor={String(c.alertas)}
            detalhe="abertos"
            tom={c.alertas > 0 ? 'warn' : 'neutro'}
          />
          <StatTile rotulo="Tarefas" valor={String(c.tarefas)} detalhe="registradas" />
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card
          titulo="Conexão com o banco"
          legenda="Leitura real do Postgres — nenhum número desta tela é mockado"
        >
          <dl className="space-y-2 text-[12px]">
            {(
              [
                ['meetings', c.reunioes],
                ['customers', c.clientes],
                ['analyses', c.analises],
                ['alerts', c.alertas],
                ['action_items', c.tarefas],
              ] as const
            ).map(([tabela, valor]) => (
              <div key={tabela} className="flex items-center justify-between gap-4">
                <dt className="font-mono text-ink-dim">{tabela}</dt>
                <dd className="font-mono tabular-nums text-ink">{valor} linhas</dd>
              </div>
            ))}
          </dl>
        </Card>
      </div>
    </>
  );
}
