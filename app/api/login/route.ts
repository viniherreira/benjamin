import { NextResponse } from 'next/server';
import {
  COOKIE_SESSAO,
  DURACAO_SESSAO,
  assinarSessao,
  senhaConfere,
} from '@/lib/auth/sessao';

/**
 * Entrada.
 *
 * Confere a senha compartilhada e emite o cookie de sessão assinado. Não
 * identifica usuário — ver o cabeçalho de lib/auth/sessao.ts sobre o que este
 * mecanismo é e o que ele não é.
 */

/** Atraso fixo em toda resposta negativa, para não virar oráculo de senha. */
const ATRASO_ERRO_MS = 400;

export async function POST(req: Request) {
  const segredo = process.env.BENJAMIN_SENHA;

  if (!segredo) {
    return NextResponse.json(
      { erro: 'A aplicação está sem senha configurada. Defina BENJAMIN_SENHA no ambiente.' },
      { status: 503 },
    );
  }

  let senha = '';
  try {
    const corpo = (await req.json()) as { senha?: unknown };
    senha = typeof corpo.senha === 'string' ? corpo.senha : '';
  } catch {
    senha = '';
  }

  if (!senhaConfere(senha, segredo)) {
    await new Promise((r) => setTimeout(r, ATRASO_ERRO_MS));
    return NextResponse.json({ erro: 'Senha incorreta.' }, { status: 401 });
  }

  const token = await assinarSessao(segredo, DURACAO_SESSAO);
  const resp = NextResponse.json({ ok: true });

  resp.cookies.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: DURACAO_SESSAO,
  });

  return resp;
}
