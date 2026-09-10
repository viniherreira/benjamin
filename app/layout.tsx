import type { Metadata } from 'next';
import { Instrument_Sans, JetBrains_Mono } from 'next/font/google';
import { Shell } from '@/components/shell';
import './globals.css';

/*
  Instrument Sans no lugar do Inter. O Inter é a fonte padrão de todo painel de
  SaaS existente — correta e sem rosto. A Instrument tem terminais mais secos e
  um "a" de dois andares mais estreito, que aguenta o tracking largo do wordmark
  sem virar caricatura. O mono continua: este é um produto de números, e número
  fora de tabular-nums dança na tela quando o valor muda.
*/
const instrument = Instrument_Sans({
  subsets: ['latin'],
  variable: '--font-instrument',
  display: 'swap',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Benjamin — o ouro invisível de cada conversa',
    template: '%s · Benjamin',
  },
  description:
    'Analisa transcrições de reuniões e extrai oportunidades de venda, riscos de churn e o ecossistema TOTVS do cliente.',
};

/**
 * Aplica o tema salvo antes da primeira pintura, para não piscar.
 * O padrão agora é o claro — o vidro precisa de luz atrás dele — e o escuro é
 * opt-in, guardado no localStorage.
 */
const SCRIPT_TEMA = `(function(){try{var t=localStorage.getItem('benjamin-tema');if(t==='light'||t==='dark'){document.documentElement.setAttribute('data-theme',t)}}catch(e){}})()`;

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
    <html lang="pt-BR" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className={`${instrument.variable} ${jetbrains.variable} font-sans antialiased`}>
        <Shell motor={motor}>{children}</Shell>
      </body>
    </html>
  );
}
