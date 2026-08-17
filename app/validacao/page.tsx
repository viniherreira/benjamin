import { PageHeader } from '@/components/ui';
import { PlaceholderFase } from '@/components/placeholder-fase';

export const metadata = { title: 'Validação' };

export default function ValidacaoPage() {
  return (
    <>
      <PageHeader
        titulo="Validação"
        descricao="Como os dados foram coletados, tratados e analisados — e quanto o motor acerta de verdade, inclusive onde erra."
      />
      <PlaceholderFase
        fase={7}
        conteudo={[
          'Coleta: protocolo do corpus real gravado pelo squad e justificativa do corpus sintético complementar.',
          'Tratamento: pipeline com números reais — normalização, diarização, anonimização LGPD e segmentação.',
          'Análise: o motor de regras, o contrato JSON e a regra de evidência obrigatória.',
          'Métricas ao vivo: botão que roda o motor sobre o corpus e mostra precisão, recall, F1 e latência.',
          'Corpus real e sintético reportados separadamente, com histórico das execuções anteriores.',
        ]}
      />
    </>
  );
}
