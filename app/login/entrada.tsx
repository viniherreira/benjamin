'use client';

import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { Loader2, Lock, Mail, TriangleAlert } from 'lucide-react';
import { Logo } from '@/components/logo';
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from '@/lib/auth/supabase-publico';

export function Entrada({ destino, motivo }: { destino: string; motivo?: string }) {
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(
    motivo === 'convite'
      ? 'Esta conta não tem convite para o Benjamin. Peça acesso a quem administra a base.'
      : null,
  );
  const [enviando, setEnviando] = useState(false);

  // Quem chega barrado por falta de convite ainda tem sessão no Auth; encerra
  // para não ficar preso num ciclo login → middleware → login.
  useEffect(() => {
    if (motivo === 'convite') {
      void createBrowserClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA).auth.signOut();
    }
  }, [motivo]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro(null);

    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });

    if (error) {
      // Mensagem única para e-mail inexistente e senha errada: diferenciar diria
      // a quem tenta adivinhar quais e-mails têm conta.
      setErro('E-mail ou senha incorretos.');
      setEnviando(false);
      return;
    }

    // `replace` para a tela de entrada não ficar no histórico. O destino vem do
    // middleware; a barra inicial é conferida para não redirecionar para fora.
    window.location.replace(destino.startsWith('/') && !destino.startsWith('//') ? destino : '/');
  }

  const campo =
    'mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 focus-within:border-line-strong';
  const input =
    'w-full bg-transparent py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed';
  const rotulo = 'block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-dim';

  return (
    <div className="w-full max-w-[380px]">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Logo />
        <p className="text-[12.5px] leading-relaxed text-ink-dim">
          Esta base guarda transcrição de conversa com cliente. O acesso é só por convite.
        </p>
      </div>

      <form onSubmit={entrar} className="vidro rounded-xl p-5">
        <label htmlFor="email" className={rotulo}>
          E-mail
        </label>
        <div className={campo}>
          <Mail size={14} className="shrink-0 text-ink-faint" />
          <input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={enviando}
            className={input}
            placeholder="voce@totvs.com.br"
          />
        </div>

        <label htmlFor="senha" className={`${rotulo} mt-4`}>
          Senha
        </label>
        <div className={campo}>
          <Lock size={14} className="shrink-0 text-ink-faint" />
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            required
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={enviando}
            className={input}
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={enviando || !email || !senha}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-[12.5px] font-semibold text-canvas transition-all duration-300 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
        >
          {enviando ? <Loader2 size={14} className="animate-spin" /> : null}
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        {erro ? (
          <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-snug text-risk">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            {erro}
          </p>
        ) : null}
      </form>
    </div>
  );
}
