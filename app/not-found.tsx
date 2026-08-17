import { FileQuestion } from 'lucide-react';
import { BotaoLink, EmptyState } from '@/components/ui';

export default function NaoEncontrado() {
  return (
    <EmptyState
      icone={<FileQuestion size={18} />}
      titulo="Não encontramos essa página"
      descricao="O endereço não existe ou o registro foi removido do banco."
      acao={
        <BotaoLink href="/" variante="primario">
          Voltar ao dashboard
        </BotaoLink>
      }
    />
  );
}
