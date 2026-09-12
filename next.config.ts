import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // Regra 10.5: não avançar de fase com build quebrado.
    ignoreBuildErrors: false,
  },
  // Existe um package-lock.json solto no diretório do usuário; sem isto o Next
  // infere a raiz do workspace lá fora e avisa a cada build.
  outputFileTracingRoot: process.cwd(),

  /*
   * Cabeçalhos de segurança.
   *
   * O produto exibe transcrição de conversa comercial. Dois riscos concretos
   * que estes cabeçalhos fecham:
   *
   *  - clickjacking: sem `frame-ancestors`, um site qualquer embute o briefing
   *    num iframe invisível e captura clique de quem já está autenticado.
   *  - vazamento por referer: sem `Referrer-Policy`, o caminho da página — que
   *    contém o id da reunião — vai junto em toda requisição para fora.
   *
   * Não há CSP de script aqui de propósito: o Next injeta script inline e uma
   * CSP escrita sem nonce quebraria a aplicação em vez de protegê-la. Fica
   * declarado como pendência em vez de fingir que está coberto.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), microphone=(self)' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
