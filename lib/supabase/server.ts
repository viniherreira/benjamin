import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

/**
 * Cliente Supabase de servidor.
 *
 * Regra inegociável do projeto (spec 5.2): o banco só é acessado pelo servidor.
 * A service_role key nunca vai para o bundle do cliente — por isso a variável
 * NÃO tem o prefixo NEXT_PUBLIC_ e este módulo carrega uma guarda em runtime.
 *
 * Com RLS habilitado e sem policy pública em nenhuma tabela, a anon key não lê
 * nem escreve nada. A service_role ignora RLS, então todo acesso legítimo passa
 * obrigatoriamente por aqui.
 */

let cached: SupabaseClient<Database> | null = null;

export function supabaseServer(): SupabaseClient<Database> {
  if (typeof window !== 'undefined') {
    throw new Error(
      'supabaseServer() foi chamado no cliente. O acesso ao banco é exclusivo do servidor.',
    );
  }

  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente. ' +
        'Configure o .env.local antes de subir a aplicação.',
    );
  }

  cached = createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'public' },
  });

  return cached;
}

/** Diz se o ambiente está configurado, sem lançar — usado pelos estados vazios da UI. */
export function supabaseConfigurado(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
