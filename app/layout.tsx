import type { Metadata } from 'next';
import { Inter, JetBrains_Mono } from 'next/font/google';
import { Shell } from '@/components/shell';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'InsightIQ — o ouro invisível de cada conversa',
    template: '%s · InsightIQ',
  },
  description:
    'Analisa transcrições de reuniões e extrai oportunidades de venda, riscos de churn e o ecossistema TOTVS do cliente.',
};

/**
 * Aplica o tema salvo antes da primeira pintura, para não piscar branco.
 * O padrão é escuro; o claro é opt-in e fica no localStorage.
 */
const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('insightiq-tema');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // O motor LLM só liga se houver chave. Sem ela, o sistema roda 100% em regras
  // e a interface diz isso — a regra 10.4 exige degradar com elegância e ser explícito.
  const motor = process.env.ANTHROPIC_API_KEY ? 'híbrido' : 'regras';

  return (
    <html lang="pt-BR" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className={`${inter.variable} ${jetbrains.variable} font-sans antialiased`}>
        <Shell motor={motor}>{children}</Shell>
      </body>
    </html>
  );
}
