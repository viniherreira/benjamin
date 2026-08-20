import { PageHeader } from '@/components/ui';
import { FormIngestao } from './form-ingestao';

export const metadata = { title: 'Nova reunião' };

export default function NovaReuniaoPage() {
  return (
    <>
      <PageHeader
        titulo="Nova reunião"
        descricao="O InsightIQ é agnóstico à origem do texto: cole a transcrição, envie o áudio ou capture ao vivo. O núcleo de análise é o mesmo nos três caminhos."
      />
      <FormIngestao />
    </>
  );
}
