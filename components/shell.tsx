'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';
import {
  Bell,
  Building2,
  FlaskConical,
  GraduationCap,
  LayoutDashboard,
  MessagesSquare,
  Moon,
  Plus,
  Radar,
  RadioTower,
  Sun,
  type LucideIcon,
} from 'lucide-react';
import { Logo, Wordmark } from './logo';

type Item = { href: string; rotulo: string; icone: LucideIcon };
type Grupo = { titulo: string; itens: Item[] };

const GRUPOS: Grupo[] = [
  {
    titulo: 'Operação',
    itens: [
      { href: '/', rotulo: 'Dashboard', icone: LayoutDashboard },
      { href: '/reunioes', rotulo: 'Reuniões', icone: MessagesSquare },
      { href: '/clientes', rotulo: 'Clientes', icone: Building2 },
    ],
  },
  {
    titulo: 'Inteligência',
    itens: [
      { href: '/radar', rotulo: 'Radar de dores', icone: Radar },
      { href: '/coaching', rotulo: 'Coaching', icone: GraduationCap },
      { href: '/alertas', rotulo: 'Alertas', icone: Bell },
    ],
  },
  {
    titulo: 'Gestão',
    itens: [{ href: '/torre', rotulo: 'Torre de controle', icone: RadioTower }],
  },
  {
    titulo: 'Sistema',
    itens: [{ href: '/validacao', rotulo: 'Validação', icone: FlaskConical }],
  },
];

function ehAtivo(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

function AlternadorTema() {
  const [tema, setTema] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    const atual = document.documentElement.getAttribute('data-theme');
    if (atual === 'light' || atual === 'dark') setTema(atual);
  }, []);

  function alternar() {
    const proximo = tema === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', proximo);
    try {
      localStorage.setItem('insightiq-tema', proximo);
    } catch {
      // localStorage bloqueado: o tema volta ao padrão no próximo carregamento.
    }
    setTema(proximo);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className="inline-flex size-7 items-center justify-center rounded-md border border-line text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
      aria-label={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
    >
      {tema === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}

export function Shell({ children, motor }: { children: ReactNode; motor: string }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh">
      <aside className="sticky top-0 hidden h-dvh w-[228px] shrink-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <Logo size={26} />
          <div className="min-w-0">
            <Wordmark />
            <p className="truncate text-[10px] leading-tight text-gold">
              O ouro invisível de cada conversa
            </p>
          </div>
        </div>

        <div className="px-3 pb-3">
          <Link
            href="/reunioes/nova"
            className="flex w-full items-center justify-center gap-1.5 rounded-md bg-accent px-3 py-2 text-[12px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            <Plus size={14} />
            Nova reunião
          </Link>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo} className="mb-4">
              <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                {grupo.titulo}
              </p>
              <ul className="space-y-0.5">
                {grupo.itens.map((item) => {
                  const ativo = ehAtivo(pathname, item.href);
                  const Icone = item.icone;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={ativo ? 'page' : undefined}
                        className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[12.5px] transition-colors ${
                          ativo
                            ? 'bg-accent-soft font-medium text-accent'
                            : 'text-ink-dim hover:bg-surface-2 hover:text-ink'
                        }`}
                      >
                        <Icone size={15} className="shrink-0" />
                        {item.rotulo}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-2.5">
          <span
            className="inline-flex items-center gap-1 rounded border border-ai/30 bg-ai-soft px-1.5 py-0.5 font-mono text-[10px] text-ai"
            title="Motor de análise ativo"
          >
            motor: {motor}
          </span>
          <AlternadorTema />
        </div>
      </aside>

      {/* Barra de navegação do mobile */}
      <header className="fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-line bg-surface px-4 py-2.5 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Logo size={22} />
          <Wordmark />
        </Link>
        <div className="flex items-center gap-2">
          <Link
            href="/reunioes/nova"
            className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 text-[11px] font-semibold text-canvas"
          >
            <Plus size={13} />
            Nova
          </Link>
          <AlternadorTema />
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-16 pt-16 md:px-8 md:pt-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>

      {/* Navegação inferior do mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-line bg-surface py-1.5 md:hidden">
        {GRUPOS.flatMap((g) => g.itens)
          .slice(0, 5)
          .map((item) => {
            const ativo = ehAtivo(pathname, item.href);
            const Icone = item.icone;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={ativo ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 px-2 py-1 text-[9.5px] ${
                  ativo ? 'text-accent' : 'text-ink-faint'
                }`}
              >
                <Icone size={17} />
                {item.rotulo}
              </Link>
            );
          })}
      </nav>
    </div>
  );
}
