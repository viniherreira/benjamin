import { DatabaseZap } from 'lucide-react';
import { EmptyState } from './ui';

/**
 * Estado de ambiente sem banco configurado.
 *
 * Toda tela que lê do Postgres precisa de uma resposta para "e quando as
 * variáveis não estão no ambiente?". A regra 10.5 proíbe simulação: sem banco
 * não há de onde ler, e preencher a tela com número inventado contaminaria
 * exatamente o que o produto promete — que todo valor exibido veio de execução
 * real ou do banco.
 *
 * Então a tela diz o que falta, o que apareceria ali e como fazer aparecer.
 * As rotas de API já respondem assim; isto é o equivalente na interface.
 */
export function SemBanco({ oQueApareceAqui }: { oQueApareceAqui: string }) {
  return (
    <EmptyState
      icone={<DatabaseZap size={17} />}
      titulo="Banco de dados não configurado"
      descricao={`${oQueApareceAqui} Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no .env.local — copie o .env.local.example, preencha as duas e reinicie o servidor. Com o banco de pé, POST /api/seed popula a base com o corpus versionado.`}
    />
  );
}
