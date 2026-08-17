import { supabaseServer } from './server';
import type { Database } from './database.types';

export type NomeTabela = keyof Database['public']['Tables'];

/** Contagem exata de linhas, sem trazer os dados. Usada pelos painéis. */
export async function contar(tabela: NomeTabela): Promise<number> {
  const sb = supabaseServer();
  const { count, error } = await sb.from(tabela).select('*', { count: 'exact', head: true });
  if (error) throw new Error(`Falha ao contar ${tabela}: ${error.message}`);
  return count ?? 0;
}

export type Contagens = {
  reunioes: number;
  clientes: number;
  alertas: number;
  tarefas: number;
  analises: number;
};

export async function contagensGerais(): Promise<Contagens> {
  const [reunioes, clientes, alertas, tarefas, analises] = await Promise.all([
    contar('meetings'),
    contar('customers'),
    contar('alerts'),
    contar('action_items'),
    contar('analyses'),
  ]);
  return { reunioes, clientes, alertas, tarefas, analises };
}
