import { PageHeader } from '@/components/ui';
import { Importador } from './importador';

export const metadata = { title: 'Importar em lote' };

export default function ImportarEmLotePage() {
  return (
    <>
      <PageHeader
        titulo="Importar em lote"
        descricao="Solte uma pasta, um zip ou dezenas de arquivos de uma vez — transcrições em texto, legendas, planilhas ou o próprio áudio das reuniões. Tudo é revisado antes de processar, e reuniões de clientes diferentes são analisadas em paralelo."
      />
      <Importador />
    </>
  );
}
