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
  // O motor de ANÁLISE é sempre determinístico — toda extração que carrega
  // evidência sai de regras, com ou sem chave de LLM. O que a chave liga é o
  // enriquecimento opcional, sob demanda, por reunião.
  //
  // Antes esta linha exibia "híbrido" só por existir uma chave no ambiente,
  // enquanto nada de LLM rodava. Rótulo que não corresponde ao que executou é
  // exatamente o tipo de coisa que este produto se propõe a não fazer.
  const motor = 'regras';

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
