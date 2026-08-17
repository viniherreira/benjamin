import { PageHeader } from '@/components/ui';
import { PlaceholderFase } from '@/components/placeholder-fase';

export const metadata = { title: 'Radar de dores' };

export default function RadarPage() {
  return (
    <>
      <PageHeader
        titulo="Radar de dores"
        descricao="Quais dores estão surgindo com mais frequência em toda a base. Nenhuma reunião isolada responde isso — só o cruzamento de todas elas."
      />
      <PlaceholderFase
        fase={6}
        conteudo={[
          'Dores de todas as reuniões, clusterizadas por tópico canônico e ranqueadas por frequência.',
          'Filtros por segmento, porte, período e unidade de negócio.',
          'Cada dor abre a lista de clientes que a mencionaram e as citações literais.',
          'Gráfico de evolução: quais dores estão crescendo e quais estão sumindo.',
        ]}
      />
    </>
  );
}
