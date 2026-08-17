import { PageHeader } from '@/components/ui';
import { PlaceholderFase } from '@/components/placeholder-fase';

export const metadata = { title: 'Nova reunião' };

export default function NovaReuniaoPage() {
  return (
    <>
      <PageHeader
        titulo="Nova reunião"
        descricao="O InsightIQ é agnóstico à origem do texto: cole a transcrição, envie o áudio ou capture ao vivo. O núcleo de análise é o mesmo nos três caminhos."
      />
      <PlaceholderFase
        fase={3}
        conteudo={[
          'Aba "Colar texto" — entrada padrão, com botão que carrega o exemplo canônico da TOTVS.',
          'Aba "Upload de áudio" (beta) — adaptador de transcrição plugável.',
          'Aba "Gravar ao vivo" (beta) — Web Speech API em pt-BR, texto editável antes de analisar.',
          'Progresso em etapas nomeadas: Normalizando, Diarizando, Anonimizando, Analisando, Consolidando memória.',
        ]}
      />
    </>
  );
}
