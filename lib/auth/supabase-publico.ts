/**
 * Credenciais PÚBLICAS do Supabase para autenticação.
 *
 * URL e chave publicável são públicas por desenho: vão para o navegador de
 * qualquer visitante. O que protege os dados é o RLS e a service_role nunca
 * sair do servidor — não o sigilo destes dois valores.
 *
 * Por isso elas têm valor padrão no código: o login funciona mesmo num deploy
 * que não recebeu variável de ambiente nova. A variável, se existir, vence.
 */
export const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://xnesguzipbxbpbfgiyzj.supabase.co';

export const SUPABASE_CHAVE_PUBLICA =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? 'sb_publishable_e8HVhgajxiiRXfh8ypq9Lw_8HIpO7Qw';
