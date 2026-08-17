import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: {
    // Regra 10.5: não avançar de fase com build quebrado.
    ignoreBuildErrors: false,
  },
  // Existe um package-lock.json solto no diretório do usuário; sem isto o Next
  // infere a raiz do workspace lá fora e avisa a cada build.
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
