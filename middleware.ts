import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_SESSAO, verificarSessao } from '@/lib/auth/sessao';

/**
 * A porta da aplicação.
 *
 * Sem isto, qualquer um com a URL lê toda transcrição, todo budget e todo risco
 * de churn da base — e chama /api/transcribe, que gasta a chave da OpenAI do
 * dono. O banco já estava protegido de acesso direto por RLS, mas a aplicação
 * fala com ele pela `service_role`, que ignora RLS: quem passa pela aplicação
 * passa por tudo.
 *
 * FALHA FECHADA. Sem `BENJAMIN_SENHA` configurada em produção, ninguém entra —
 * inclusive quem fez o deploy. O modo aberto existe só em desenvolvimento, para
 * não exigir configuração de quem roda `npm run dev` na própria máquina; e
 * mesmo lá o console avisa.
 */

const LIVRE = [
  '/login',
  '/api/login',
  '/api/logout',
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
 * navegação do produto — um menu cujos itens todos voltam para o login. Server
 * component não lê a URL, então ela viaja por cabeçalho.
 */
const CABECALHO_CAMINHO = 'x-benjamin-caminho';

function seguir(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set(CABECALHO_CAMINHO, req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: h } });
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (LIVRE.some((p) => pathname.startsWith(p))) return seguir(req);

  const segredo = process.env.BENJAMIN_SENHA;

  if (!segredo) {
    if (process.env.NODE_ENV !== 'production') return seguir(req);
    return new NextResponse(
      'BENJAMIN_SENHA não está configurada. A aplicação guarda conversa de cliente e ' +
        'não sobe sem senha: defina a variável de ambiente e reinicie.',
      { status: 503, headers: { 'content-type': 'text/plain; charset=utf-8' } },
    );
  }

  const token = req.cookies.get(COOKIE_SESSAO)?.value ?? '';
  if (await verificarSessao(token, segredo)) return seguir(req);

  /*
   * Rota de API responde 401 em vez de redirecionar: um fetch que recebe o HTML
   * do login e tenta fazer JSON.parse dá um erro que não explica nada.
   */
  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ erro: 'Sessão ausente ou expirada.' }, { status: 401 });
  }

  const destino = req.nextUrl.clone();
  destino.pathname = '/login';
  destino.search = pathname === '/' ? '' : `?de=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(destino);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
};
