'use client';

import { useState } from 'react';
import { Loader2, Lock, TriangleAlert } from 'lucide-react';
import { Logo } from '@/components/logo';

export function Entrada({ destino, configurada }: { destino: string; configurada: boolean }) {
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    setEnviando(true);
    setErro(null);

    try {
      const r = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ senha }),
      });

      if (r.ok) {
        /*
         * `replace` e não `push`: a tela de entrada não deve ficar no histórico
         * para o botão "voltar" cair nela depois de autenticado.
         *
         * O destino vem do middleware e é sempre um caminho interno; a barra
         * inicial é conferida de novo aqui para que uma URL montada à mão não
         * consiga redirecionar para fora do domínio.
         */
        window.location.replace(destino.startsWith('/') ? destino : '/');
        return;
      }

      const j = (await r.json().catch(() => ({}))) as { erro?: string };
      setErro(j.erro ?? 'Não foi possível entrar.');
    } catch {
      setErro('Falha de rede ao tentar entrar.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="w-full max-w-[380px]">
      <div className="mb-6 flex flex-col items-center gap-3 text-center">
        <Logo />
        <p className="text-[12.5px] leading-relaxed text-ink-dim">
          Esta base guarda transcrição de conversa com cliente. O acesso é restrito.
        </p>
      </div>

      <form onSubmit={entrar} className="vidro rounded-xl p-5">
        <label htmlFor="senha" className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-dim">
          Senha de acesso
        </label>

        <div className="mt-2 flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 focus-within:border-line-strong">
          <Lock size={14} className="shrink-0 text-ink-faint" />
          <input
            id="senha"
            type="password"
            autoComplete="current-password"
            autoFocus
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            disabled={!configurada || enviando}
            className="w-full bg-transparent py-2.5 text-[13px] text-ink outline-none placeholder:text-ink-faint disabled:cursor-not-allowed"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={!configurada || enviando || senha.length === 0}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-[12.5px] font-semibold text-canvas transition-all duration-300 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:shadow-none"
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

        {!configurada ? (
          <p className="mt-3 flex items-start gap-1.5 text-[11.5px] leading-relaxed text-ink-dim">
            <TriangleAlert size={13} className="mt-0.5 shrink-0 text-warn" />
            Nenhuma senha configurada no ambiente. Defina{' '}
            <code className="rounded bg-surface-3 px-1 font-mono text-[10.5px]">BENJAMIN_SENHA</code>{' '}
            e reinicie o servidor.
          </p>
        ) : null}
      </form>

      <p className="mt-4 text-center text-[11px] leading-relaxed text-ink-faint">
        Senha única compartilhada. Ainda não é login por usuário — não identifica quem entrou nem
        separa organizações.
      </p>
    </div>
  );
}
