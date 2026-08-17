import { PageHeader } from '@/components/ui';
import { PlaceholderFase } from '@/components/placeholder-fase';

export const metadata = { title: 'Torre de controle' };

export default function TorrePage() {
  return (
    <>
      <PageHeader
        titulo="Torre de controle"
        descricao="A visão do Diretor Comercial: onde está o dinheiro que ele ainda não viu."
      />
      <PlaceholderFase
        fase={5}
        conteudo={[
          'Receita em risco, pipeline identificado e upsell não trabalhado — todos em R$.',
          'Contas em risco ranqueadas por valor de contrato, não por ordem alfabética.',
          'Oportunidades separadas por unidade de negócio: Gestão, RD Station e Techfin.',
          'Alertas de alta severidade endereçados à diretoria.',
          'Throughput do sistema e custo por análise, para sustentar as 10.000 reuniões/dia.',
        ]}
      />
    </>
  );
}
