import { PageHeader } from '@/components/ui';
import { PlaceholderFase } from '@/components/placeholder-fase';

export const metadata = { title: 'Coaching' };

export default function CoachingPage() {
  return (
    <>
      <PageHeader
        titulo="Coaching"
        descricao="O vendedor está ouvindo mais do que falando? Ferramenta de desenvolvimento, nunca de punição."
      />
      <PlaceholderFase
        fase={6}
        conteudo={[
          'Talk-to-listen ratio por vendedor e por reunião, contra a faixa de referência configurada.',
          'Número de perguntas, proporção entre abertas e fechadas, e tempo até a primeira pergunta.',
          'Monólogo mais longo e taxa de interrupção.',
          'Cobertura BANT média e evolução de cada indicador no tempo.',
        ]}
      />
    </>
  );
}
