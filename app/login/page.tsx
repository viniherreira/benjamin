import { Entrada } from './entrada';

export const metadata = { title: 'Entrar' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; motivo?: string }>;
}) {
  const { de, motivo } = await searchParams;

  // O layout raiz não envolve esta rota no Shell — ver o comentário lá.
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <Entrada destino={de ?? '/'} motivo={motivo} />
    </div>
  );
}
