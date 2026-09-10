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
  const [tema, setTema] = useState<'dark' | 'light'>('light');

  useEffect(() => {
    const atual = document.documentElement.getAttribute('data-theme');
    if (atual === 'light' || atual === 'dark') setTema(atual);
  }, []);

  function alternar() {
    const proximo = tema === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', proximo);
    try {
      localStorage.setItem('benjamin-tema', proximo);
    } catch {
      // localStorage bloqueado: o tema volta ao padrão no próximo carregamento.
    }
    setTema(proximo);
  }

  return (
    <button
      type="button"
      onClick={alternar}
      className="inline-flex size-7 items-center justify-center rounded-lg border border-line text-ink-faint transition-all duration-300 hover:border-line-strong hover:text-accent"
      aria-label={tema === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
      title={tema === 'dark' ? 'Tema claro' : 'Tema escuro'}
    >
      {tema === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
    </button>
  );
}

/**
 * Botão de ação primária. É o único bloco de tinta chapada da interface — numa
 * tela feita de vidro translúcido, opacidade total é o destaque mais forte
 * disponível, e ele fica reservado para a única coisa que o usuário SEMPRE pode
 * fazer: trazer uma reunião nova para dentro.
 */
function BotaoNova({ compacto = false }: { compacto?: boolean }) {
  return (
    <Link
      href="/reunioes/nova"
      className={`group inline-flex items-center justify-center gap-1.5 rounded-lg bg-accent font-semibold text-canvas transition-all duration-300 hover:shadow-glow ${
        compacto ? 'px-2.5 py-1.5 text-[11px]' : 'w-full px-3 py-2 text-[12px]'
      }`}
    >
      <Plus size={compacto ? 13 : 14} className="transition-transform duration-300 group-hover:rotate-90" />
      {compacto ? 'Nova' : 'Nova reunião'}
    </Link>
  );
}

export function Shell({ children, motor }: { children: ReactNode; motor: string }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh">
      <aside className="no-print vidro-sutil sticky top-0 hidden h-dvh w-[236px] shrink-0 flex-col border-r border-line md:flex">
        <div className="flex items-center gap-2.5 px-4 py-5">
          <Logo size={28} />
          <div className="min-w-0">
            <Wordmark />
            {/*
              Sem truncate e sem caixa alta: o wordmark já gasta toda a largura
              da barra com tracking de 0.42em, e a tagline em caixa alta atrás
              dele cortava em "DE CAD…". Duas linhas em caixa baixa cabem, e
              uma promessa pela metade é pior que promessa nenhuma.
            */}
            <p className="mt-1.5 text-[10px] leading-[1.35] text-ink-faint">
              O ouro invisível de cada conversa
            </p>
          </div>
        </div>

        <div className="px-3 pb-4">
          <BotaoNova />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          {GRUPOS.map((grupo) => (
            <div key={grupo.titulo} className="mb-5">
              <p className="px-2 pb-2 text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-faint">
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
                        className={`relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] transition-all duration-300 ${
                          ativo
                            ? 'bg-accent-soft font-semibold text-accent'
                            : 'text-ink-dim hover:bg-surface-2 hover:text-ink'
                        }`}
                      >
                        {/* marcador na sangria: diz onde você está sem gastar cor */}
                        {ativo ? (
                          <span
                            aria-hidden
                            className="absolute -left-3 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r-full bg-accent"
                          />
                        ) : null}
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

        <div className="flex items-center justify-between gap-2 border-t border-line px-3 py-3">
          <span
            className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-ink-dim"
            title="Motor de análise ativo"
          >
            motor: {motor}
          </span>
          <AlternadorTema />
        </div>
      </aside>

      {/* Barra de navegação do mobile */}
      <header className="no-print vidro-sutil fixed inset-x-0 top-0 z-20 flex items-center justify-between border-b border-line px-4 py-2.5 md:hidden">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo size={24} />
          <Wordmark className="!text-[11px] !tracking-[0.34em]" />
        </Link>
        <div className="flex items-center gap-2">
          <BotaoNova compacto />
          <AlternadorTema />
        </div>
      </header>

      <main className="min-w-0 flex-1 px-4 pb-20 pt-20 md:px-10 md:pt-10">
        <div className="subir mx-auto max-w-[1200px]">{children}</div>
      </main>

      {/* Navegação inferior do mobile */}
      <nav className="no-print vidro-sutil fixed inset-x-0 bottom-0 z-20 flex items-center justify-around border-t border-line py-2 md:hidden">
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
                className={`flex flex-col items-center gap-1 px-2 py-1 text-[9.5px] transition-colors ${
                  ativo ? 'font-semibold text-accent' : 'text-ink-faint'
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
