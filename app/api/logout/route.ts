import { NextResponse } from 'next/server';
import { COOKIE_SESSAO } from '@/lib/auth/sessao';

/** Saída: apaga o cookie de sessão. */
export async function POST() {
  const resp = NextResponse.json({ ok: true });
  resp.cookies.set(COOKIE_SESSAO, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 0,
  });
  return resp;
}
