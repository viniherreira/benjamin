import { gold, type Amostra } from '../tipos';

/**
 * ARCO NARRATIVO — Metalúrgica Vale Verde, 5 reuniões consecutivas.
 *
 * Ana Torres (executiva de contas TOTVS) e João Silva (gestor operacional,
 * cliente). É a melhor sequência de demonstração possível: a objeção de preço
 * aparece na R2, volta na R3, volta na R4 — e a plataforma precisa concluir
 * sozinha que "preço é objeção recorrente, 3 das 4 últimas reuniões, ainda não
 * endereçada". Nenhuma reunião isolada diz isso.
 *
 * Todas em dev: são as amostras que eu leio para ajustar. As de holdout ficam
 * em cenarios.ts e nunca são inspecionadas individualmente.
 */
export const ARCO_JOAO: Amostra[] = [
  {
    codigo: 'ARC-01',
    cenario: 'descoberta',
    particao: 'dev',
    cliente: 'Metalúrgica Vale Verde',
    persona: 'João Silva — gestor operacional',
    data: '2026-05-12',
    texto: `Ana Torres: Bom dia, João, tudo certo? Consegue me ouvir bem?
João Silva: Bom dia, Ana. Consigo sim, tô te ouvindo.
Ana Torres: Ótimo. Olha, antes de eu falar qualquer coisa sobre a TOTVS, eu queria entender melhor a operação de vocês. Me conta: como está hoje o dia a dia do backoffice?
João Silva: Então, o backoffice tá tranquilo. A gente roda o Protheus há uns seis anos, financeiro, fiscal, estoque, tudo ali dentro. Isso funciona bem, não tenho o que reclamar.
Ana Torres: Que bom ouvir isso. E onde é que aperta?
João Silva: RH. O RH é o nosso ponto cego. A folha é feita praticamente na mão, com planilha. Três pessoas, três dias todo mês, e sempre sai erro. Mês passado a gente pagou hora extra errada pra doze funcionários e teve que fazer acerto no mês seguinte.
Ana Torres: Entendi. E esse retrabalho, quanto ele custa pra vocês?
João Silva: Olha, em dinheiro eu não sei te dizer. Mas em desgaste... o pessoal do RH tá esgotado. A Cláudia, que é a coordenadora lá, já veio falar comigo duas vezes esse ano que não aguenta mais.
Ana Torres: E vocês já pensaram em resolver isso de alguma forma?
João Silva: A gente precisa resolver esse ano, com certeza. Mas ainda não olhei nada, pra ser sincero. Tô sabendo que existe um módulo de vocês, mas não conheço.
Ana Torres: Existe sim, é a linha RM. Ele cobre folha, ponto, eSocial, admissão, tudo isso. E como você já tem Protheus, a integração é nativa.
João Silva: É integrado mesmo? Porque eu já ouvi essa história antes com outro fornecedor.
Ana Torres: É, e eu prefiro te mostrar do que te contar. Posso preparar uma demonstração com os dois rodando conectados?
João Silva: Pode. Mas olha, não adianta ser bonito na tela e depois na prática dar trabalho.
Ana Torres: Justo. Vou montar com um cenário parecido com o de vocês. Fico de te mandar duas opções de data até quinta.
João Silva: Beleza, tô no aguardo então.`,
    gold: gold({
      produtos: [
        { nome: 'TOTVS Protheus', status: 'em_uso' },
        { nome: 'TOTVS RM', status: 'oportunidade' },
        { nome: 'Folha de Pagamento', status: 'oportunidade' },
        { nome: 'Ponto Eletrônico', status: 'oportunidade' },
        { nome: 'eSocial', status: 'oportunidade' },
      ],
      // "É integrado mesmo? Porque eu já ouvi essa história antes" é objeção
      // técnica — sub-anotada na primeira passada.
      objecoes: ['tecnica'],
      // Regra do motor: uma dor por sentença, e o domínio ganha do genérico.
      // "A folha é feita na mão, com planilha" conta como RH — processo manual
      // é a forma da dor, não o domínio dela. Anotado conforme essa regra.
      dores: ['rh'],
      unidades_oportunidade: ['gestao'],
      upsell_claro: true,
      sentimento: 'misto',
      poder_decisao: 'desconhecido',
      interesse: [55, 75],
      churn_risco: 'baixo',
      talk_ratio_vendedor: [0.35, 0.55],
    }),
  },

  {
    codigo: 'ARC-02',
    cenario: 'demonstracao',
    particao: 'dev',
    cliente: 'Metalúrgica Vale Verde',
    persona: 'João Silva — gestor operacional',
    data: '2026-06-03',
    texto: `Ana Torres: João, bom te ver. Deixa eu compartilhar a tela aqui. Tá aparecendo?
João Silva: Tá sim.
Ana Torres: Então, o que você tá vendo é o RM com o Protheus conectado. Repara que eu cadastro o funcionário uma vez só, aqui, e o dado já aparece do outro lado. Não tem redigitação, não tem exportação de planilha no meio. Deixa eu te mostrar o fechamento também. Aqui a gente roda o cálculo da folha, e ó, ele já traz as horas extras direto do ponto eletrônico. O que era três dias de trabalho vira uma tarde. E aqui em cima você tem o painel de conferência, que aponta divergência antes de fechar, então aquele caso das doze horas extras erradas o sistema teria pego.
João Silva: Isso aí é interessante.
Ana Torres: E tem mais, ó. O eSocial sai daqui direto, sem digitar nada em portal do governo. Isso sozinho já economiza um dia por mês do time.
João Silva: Tá. Deixa eu perguntar uma coisa. Isso tudo custa quanto?
Ana Torres: Depende do número de funcionários e dos módulos. Pra faixa de vocês, o investimento inicial fica na casa de setenta e cinco mil, mais a mensalidade.
João Silva: Setenta e cinco mil? Ana, isso tá caro. Bem caro, sinceramente.
Ana Torres: Entendo. Vale lembrar que aí está incluída a implantação e o treinamento do time.
João Silva: Sim, mas mesmo assim. A gente tem um teto aqui e isso passa dele.
Ana Torres: Posso montar uma proposta com escopo faseado, começando só pela folha e o ponto, e o resto no ano que vem?
João Silva: Aí muda de figura. Manda essa versão que eu olho com carinho.
Ana Torres: Fechado. Te mando até terça.`,
    gold: gold({
      produtos: [
        { nome: 'TOTVS Protheus', status: 'em_uso' },
        { nome: 'TOTVS RM', status: 'avaliando' },
        { nome: 'Folha de Pagamento', status: 'oportunidade' },
        { nome: 'Ponto Eletrônico', status: 'oportunidade' },
        { nome: 'eSocial', status: 'oportunidade' },
      ],
      objecoes: ['preco'],
      // Anotação corrigida: nesta reunião quem fala de RH é a vendedora, na
      // demonstração. O cliente não enuncia a dor aqui — e dor é do cliente.
      dores: [],
      unidades_oportunidade: ['gestao'],
      upsell_claro: true,
      budget: 75000,
      sentimento: 'misto',
      poder_decisao: 'desconhecido',
      interesse: [55, 80],
      churn_risco: 'baixo',
      talk_ratio_vendedor: [0.6, 0.85],
    }),
  },

  {
    codigo: 'ARC-03',
    cenario: 'negociacao',
    particao: 'dev',
    cliente: 'Metalúrgica Vale Verde',
    persona: 'João Silva — gestor operacional',
    data: '2026-06-24',
    texto: `Ana Torres: João, você conseguiu olhar a proposta faseada?
João Silva: Olhei. Melhorou, mas continua acima do que eu tenho aqui. Sessenta mil ainda é um número grande pra aprovar internamente.
Ana Torres: Qual seria um número que passa?
João Silva: Sinceramente? Uns cinquenta. E olha que eu tô esticando.
Ana Torres: Consigo levar isso pro meu gestor, mas vou precisar defender. O que muda pra vocês entre sessenta e cinquenta?
João Silva: Muda que em cinquenta eu aprovo sem passar por comitê. Acima disso vira processo, vai pro financeiro, demora dois meses.
Ana Torres: Isso é bom saber. Deixa eu ver o que consigo.
João Silva: E olha, Ana, vou ser honesto com você. O pessoal do RH pediu pra ver outra opção também. Marcaram uma conversa com a Senior semana que vem.
Ana Torres: Entendi. Você sabe o que chamou atenção deles?
João Silva: Acho que foi mais indicação de um conhecido da Cláudia. Não é nada decidido, tá? Só que eu não posso barrar a equipe de olhar o mercado.
Ana Torres: Claro, faz todo sentido. Só te peço uma coisa: quando você comparar, compara a integração também, não só o preço da folha. É aí que a conta muda.
João Silva: Vou levar isso em consideração.
Ana Torres: Vou te mandar um comparativo de escopo até sexta pra te ajudar nessa conversa.
João Silva: Pode mandar.`,
    gold: gold({
      produtos: [{ nome: 'Folha de Pagamento', status: 'oportunidade' }],
      concorrentes: [{ nome: 'Senior Sistemas', ativo: true }],
      objecoes: ['preco', 'autoridade'],
      dores: [],
      unidades_oportunidade: ['gestao'],
      upsell_claro: true,
      budget: 50000,
      sentimento: 'neutro',
      poder_decisao: 'influenciador',
      interesse: [40, 65],
      churn_risco: 'medio',
      talk_ratio_vendedor: [0.35, 0.6],
    }),
  },

  {
    codigo: 'ARC-04',
    cenario: 'follow_up',
    particao: 'dev',
    cliente: 'Metalúrgica Vale Verde',
    persona: 'João Silva — gestor operacional',
    data: '2026-07-15',
    texto: `Ana Torres: E aí João, como foi a conversa com a Senior?
João Silva: Foi. O pessoal viu uma demo e gostou, principalmente da tela de ponto, acharam mais simples que a de vocês.
Ana Torres: Entendo. E o preço deles?
João Silva: Mais barato. Uns quinze por cento abaixo. É isso que tá pegando aqui, Ana, o preço de vocês continua sendo o ponto.
Ana Torres: É a terceira vez que a gente conversa sobre preço, e eu quero resolver isso de vez. Consegui aprovação pra chegar nos cinquenta e dois.
João Silva: Cinquenta e dois já dá pra trabalhar. Ah, e por favor, não comenta esse valor de cinquenta mil que eu te falei com o meu CFO ainda, ele tá focado no ROI do semestre e eu quero levar isso fechado.
Ana Torres: Fica entre a gente, sem problema.
João Silva: Mas olha, tem outra coisa. Aquela documentação da API que você ficou de mandar, não chegou.
Ana Torres: Você tem razão, falhei nisso. Mando hoje ainda.
João Silva: É que o meu time técnico quer olhar antes. Porque essa história de integração nativa... o RM é integrado mesmo, né? Né? Porque se na hora H der trabalho, eu que vou levar bronca aqui dentro.
Ana Torres: É integrado, e eu vou te provar. Além da documentação, posso trazer o arquiteto numa call de trinta minutos com seu time.
João Silva: Isso ajuda.
Ana Torres: Marco pra quinta que vem?
João Silva: Pode marcar.`,
    gold: gold({
      produtos: [{ nome: 'TOTVS RM', status: 'avaliando' }],
      concorrentes: [{ nome: 'Senior Sistemas', ativo: true }],
      objecoes: ['preco', 'tecnica', 'concorrencia'],
      dores: [],
      unidades_oportunidade: ['gestao'],
      upsell_claro: true,
      budget: 50000,
      sentimento: 'misto',
      poder_decisao: 'influenciador',
      interesse: [40, 65],
      churn_risco: 'medio',
      talk_ratio_vendedor: [0.3, 0.55],
    }),
  },

  {
    codigo: 'ARC-05',
    cenario: 'proposta',
    particao: 'dev',
    cliente: 'Metalúrgica Vale Verde',
    persona: 'João Silva — gestor operacional',
    data: '2026-08-06',
    texto: `Ana Torres: João, a call com o arquiteto resolveu a dúvida do seu time?
João Silva: Resolveu bastante. O Rafael, que é o nosso analista, saiu convencido. Disse que a camada de integração é sólida e que a documentação tá boa.
Ana Torres: Fico feliz. E do lado comercial, como estamos?
João Silva: Do meu lado, tá aprovado. Cinquenta e dois passa. Agora depende do CFO.
Ana Torres: O que ele precisa ver pra dizer sim?
João Silva: ROI. Ele é bem direto: quer saber em quanto tempo isso se paga. Se você me der esse número com uma conta que se sustente, eu levo pra ele.
Ana Torres: Consigo montar. Com três pessoas por três dias todo mês, mais o custo dos acertos de folha, a conta fecha em torno de catorze meses. Vou te mandar a planilha aberta pra ele poder auditar.
João Silva: Perfeito, é assim que ele gosta.
Ana Torres: Quando ele decide?
João Silva: Reunião de diretoria é dia vinte e oito. Se eu tiver o material até dia vinte, entra na pauta.
Ana Torres: Te mando até dia dezoito então, com folga.
João Silva: Combinado. E Ana, obrigado pela paciência com esse processo, viu. Foi longo mas você não empurrou nada goela abaixo.
Ana Torres: Imagina, João. A gente quer que dê certo depois da assinatura também.`,
    gold: gold({
      produtos: [{ nome: 'TOTVS RM', status: 'avaliando' }],
      objecoes: ['autoridade'],
      dores: [],
      unidades_oportunidade: ['gestao'],
      upsell_claro: true,
      budget: null,
      sentimento: 'positivo',
      poder_decisao: 'influenciador',
      interesse: [70, 92],
      churn_risco: 'baixo',
      talk_ratio_vendedor: [0.4, 0.6],
    }),
  },
];
