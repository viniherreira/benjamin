import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_CHAVE_PUBLICA, SUPABASE_URL } from '@/lib/auth/supabase-publico';

/**
 * A porta da aplicação — login por usuário, só para convidados.
 *
 * O produto guarda transcrição de conversa comercial com cliente identificado.
 * Toda rota exige sessão válida do Supabase Auth E um convite: linha em
 * `app_users` com o mesmo e-mail. Ter conta no Auth não basta — se o cadastro
 * público estiver aberto no projeto, quem se cadastrar sozinho ainda é barrado
 * aqui.
 *
 * A checagem do convite usa a chave pública e o JWT do próprio usuário. A
 * policy `app_users_select_proprio` deixa cada um ler só a própria linha, então
 * a consulta volta vazia para quem não foi convidado.
 *
 * Substitui a senha compartilhada (BENJAMIN_SENHA), que não identificava ninguém.
 */

const LIVRE = [
  '/login',
  '/_next',
  '/favicon',
  '/icon',
  '/apple-icon',
  '/opengraph-image',
  '/robots.txt',
  '/sitemap.xml',
];

/**
 * O layout raiz precisa saber o caminho para não envolver a tela de entrada na
 * navegação do produto. Server component não lê a URL, então ela viaja por
 * cabeçalho.
 */
const CABECALHO_CAMINHO = 'x-benjamin-caminho';

function seguir(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set(CABECALHO_CAMINHO, req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: h } });
}

function barrar(req: NextRequest, motivo?: 'convite') {
  const { pathname } = req.nextUrl;

  // API responde 401: um fetch que recebe o HTML do login quebra num JSON.parse.
  if (pathname.startsWith('/api/')) {
    return NextResponse.json(
      { erro: motivo === 'convite' ? 'Usuário sem convite.' : 'Sessão ausente ou expirada.' },
      { status: 401 },
    );
  }

  const destino = req.nextUrl.clone();
  destino.pathname = '/login';
  const params = new URLSearchParams();
  if (pathname !== '/') params.set('de', pathname);
  if (motivo) params.set('motivo', motivo);
  destino.search = params.toString() ? `?${params}` : '';
  return NextResponse.redirect(destino);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (LIVRE.some((p) => pathname.startsWith(p))) return seguir(req);

  let resposta = seguir(req);

  // O Supabase renova o token de acesso pelo cookie; a resposta precisa
  // devolver o cookie renovado, senão a sessão expira no meio do uso.
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_CHAVE_PUBLICA, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (lista) => {
        lista.forEach(({ name, value }) => req.cookies.set(name, value));
        resposta = seguir(req);
        lista.forEach(({ name, value, options }) => resposta.cookies.set(name, value, options));
      },
    },
  });

  // getUser valida o token no servidor do Auth; getSession só leria o cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return barrar(req);

  const { data: convite } = await supabase.from('app_users').select('id').limit(1).maybeSingle();
  if (!convite) return barrar(req, 'convite');

  return resposta;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
