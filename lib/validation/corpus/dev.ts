import { gold, type Amostra } from '../tipos';

/**
 * PARTIÇÃO DEV — amostras que eu leio para ajustar léxicos e pesos.
 *
 * Escritas a partir dos cenários e das personas, antes dos extratores existirem
 * na forma final. O gabarito foi anotado lendo o texto, não a saída do motor.
 */
export const CORPUS_DEV: Amostra[] = [
  {
    codigo: 'DEV-01',
    cenario: 'primeiro_contato',
    particao: 'dev',
    cliente: 'Transportes Bandeirante',
    texto: `Ana: Marcos, obrigada pelo tempo. Sei que foi em cima da hora.
Marcos: Imagina. Tenho uns vinte minutos, depois tenho outra.
Ana: Suficiente. Me conta um pouco: como vocês controlam a operação hoje?
Marcos: A gente tem um sistema próprio, feito por um cara que trabalhou aqui anos atrás. Funciona, mas ninguém mais mexe naquilo. Se der pau, tá todo mundo na mão.
Ana: E isso preocupa vocês?
Marcos: Preocupa, claro. Mas não é a prioridade do trimestre, sendo honesto. A gente tá com foco em abrir a filial de Ribeirão.
Ana: Entendi. E quando essa filial abre?
Marcos: Começo do ano que vem, se tudo der certo.
Ana: Faz sentido. Talvez valha a gente conversar mais perto disso, porque abrir filial com sistema que ninguém mantém costuma virar problema em dobro.
Marcos: É, isso é verdade. Me manda um material pra eu ir olhando, sem compromisso.
Ana: Mando sim. E posso te procurar em outubro pra ver como ficou o planejamento?
Marcos: Pode, tranquilo.`,
    // Anotação corrigida: "sistema que ninguém mantém" é risco de legado, não
    // dor de integração. Erro meu na primeira passada de anotação.
    gold: gold({
      dores: [],
      poder_decisao: 'desconhecido',
      sentimento: 'neutro',
      interesse: [35, 60],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'DEV-02',
    cenario: 'customer_success_insatisfeito',
    particao: 'dev',
    cliente: 'Alimentos Serra Azul',
    texto: `Carla (CSM): Roberto, obrigada por aceitar a call. Sei que a semana foi difícil.
Roberto: Difícil é apelido, Carla. Olha, vou ser bem direto porque não adianta a gente ficar dourando pílula.
Carla: Por favor.
Roberto: A gente abriu chamado dia primeiro. Estamos dia dezenove. Ninguém resolveu. É a terceira vez esse ano que acontece a mesma coisa no fiscal, o SPED não fecha e a gente descobre no dia do vencimento.
Carla: Isso não deveria ter acontecido.
Roberto: Não deveria, mas aconteceu. E o suporte demora demais. A gente perdeu a paciência, sinceramente. Eu já tô revendo o contrato aqui com o jurídico.
Carla: Roberto, eu quero endereçar isso. O que precisa acontecer pra você não seguir por esse caminho?
Roberto: Primeiro, resolver o chamado. Segundo, alguém me explicar por que a mesma falha volta. Terceiro, e isso é o mais importante, eu quero um canal que responda em vinte e quatro horas, não em vinte dias.
Carla: Vou escalar internamente hoje e te trago um plano com nome e prazo até amanhã.
Roberto: Olha, eu quero acreditar. Mas o meu diretor já pediu pra eu cotar com a Sankhya. Não decidi nada, mas a conversa existe.
Carla: Entendo. Me dá até amanhã.
Roberto: Até amanhã, então.`,
    gold: gold({
      concorrentes: [{ nome: 'Sankhya', ativo: true }],
      dores: ['suporte', 'fiscal'],
      churn_claro: true,
      sentimento: 'negativo',
      poder_decisao: 'influenciador',
      interesse: [0, 30],
      churn_risco: 'alto',
      talk_ratio_vendedor: [0.2, 0.45],
    }),
  },

  {
    codigo: 'DEV-03',
    cenario: 'renovacao',
    particao: 'dev',
    cliente: 'Distribuidora Norte Forte',
    texto: `Carla: Patrícia, a renovação vence em sessenta dias. Queria entender como vocês estão vendo.
Patrícia: Carla, eu não vou renovar nas condições atuais. Vou te falar por quê.
Carla: Pode falar.
Patrícia: Primeiro, a gente paga por oitenta licenças e usa cinquenta e duas. Isso eu já pedi pra reduzir três vezes e ninguém mexeu. Segundo, o sistema tá lento demais. Fechar pedido leva quase um minuto, e no nosso volume isso trava a operação.
Carla: A lentidão é em qual módulo?
Patrícia: Faturamento. Todo dia, das dez ao meio-dia, que é o pico.
Carla: Isso tem cara de dimensionamento de ambiente, e é uma coisa que a gente consegue atacar.
Patrícia: Pode ser. Mas eu já tô conversando com a Sankhya e com a Omie. A Omie inclusive já mandou proposta.
Carla: Entendi. Patrícia, me dá uma chance de trazer duas coisas: um plano técnico pra lentidão e uma revisão de licenciamento que reflita o uso real.
Patrícia: Se vier rápido, eu olho. Mas não me venha com "vamos avaliar", tá? Eu quero data.
Carla: Semana que vem, quarta, com os dois documentos.
Patrícia: Anotado.`,
    gold: gold({
      concorrentes: [
        { nome: 'Sankhya', ativo: true },
        { nome: 'Omie', ativo: true },
      ],
      objecoes: ['preco'],
      dores: ['performance', 'custo'],
      churn_claro: true,
      sentimento: 'negativo',
      poder_decisao: 'decisor',
      interesse: [0, 30],
      churn_risco: 'alto',
      talk_ratio_vendedor: [0.25, 0.5],
    }),
  },

  {
    codigo: 'DEV-04',
    cenario: 'expansao',
    particao: 'dev',
    cliente: 'Rede Ponto Certo',
    texto: `Ana: Fernanda, entendi que vocês estão abrindo lojas. Me atualiza?
Fernanda: Isso. Fechamos o ano com dezoito, e o plano é chegar a vinte e seis até dezembro do ano que vem.
Ana: Excelente. E o sistema acompanha esse crescimento?
Fernanda: É por isso que te chamei. Hoje cada loja nova leva umas três semanas pra entrar no ar, e isso não escala. Eu preciso de mais licenças e preciso de um processo de abertura mais rápido.
Ana: Consigo trabalhar nos dois. Sobre licenças, a gente tem pacote de expansão que já prevê crescimento, sai bem melhor que comprar avulso.
Fernanda: Qual o investimento?
Ana: Pra oito lojas adicionais, com o pacote, fica em torno de cento e vinte mil no ano.
Fernanda: Cento e vinte é aceitável dentro do que a diretoria aprovou pra expansão. Eu tenho autonomia até cento e cinquenta.
Ana: Ótimo. E sobre o tempo de abertura, tem um caminho de template de loja que derruba pra cinco dias.
Fernanda: Cinco dias muda a minha vida. Manda a proposta com as duas coisas juntas.
Ana: Mando até sexta.
Fernanda: E já agenda a apresentação pro comitê dia dez.
Ana: Agendo.`,
    // Anotação corrigida: demora para abrir loja é dor de implantação/processo,
    // não de integração entre sistemas.
    gold: gold({
      objecoes: [],
      dores: [],
      unidades_oportunidade: ['gestao'],
      upsell_claro: true,
      budget: 120000,
      sentimento: 'positivo',
      poder_decisao: 'decisor',
      interesse: [78, 100],
      churn_risco: 'baixo',
      talk_ratio_vendedor: [0.35, 0.6],
    }),
  },

  {
    codigo: 'DEV-05',
    cenario: 'descoberta',
    particao: 'dev',
    cliente: 'Indústria Camargo',
    texto: `Ana: Seu Antônio, como está o financeiro de vocês esse ano?
Antônio: Apertado, minha filha. Apertado. O problema aqui não é vender, é receber.
Ana: Como assim?
Antônio: A gente vende pra rede grande, e rede grande paga em noventa, cento e vinte dias. Só que meu fornecedor de matéria-prima quer receber em trinta. Então eu fico no meio, segurando o caixa.
Ana: E como vocês cobrem esse buraco hoje?
Antônio: Antecipando duplicata no banco, e o banco cobra caro. Muito caro. Esse ano já torrei uns oitenta mil só em juros de antecipação.
Ana: Isso é exatamente o tipo de problema que a nossa área de Techfin resolve. A antecipação sai de dentro do próprio sistema de gestão, com taxa bem menor que a de banco, porque a gente já enxerga o recebível.
Antônio: Isso existe mesmo?
Ana: Existe. Chama TOTVS Antecipa. E como vocês já usam o Protheus, o recebível já tá cadastrado, não precisa mandar documento pra lugar nenhum.
Antônio: Rapaz. Isso aí me interessa muito mais que qualquer coisa de estoque.
Ana: Posso te trazer uma simulação com os seus números reais na próxima semana?
Antônio: Traz. E traz a taxa, viu, porque é ela que vai decidir.`,
    gold: gold({
      produtos: [
        { nome: 'TOTVS Protheus', status: 'em_uso' },
        { nome: 'TOTVS Antecipa', status: 'oportunidade' },
      ],
      dores: ['financeiro'],
      unidades_oportunidade: ['techfin'],
      upsell_claro: true,
      sentimento: 'misto',
      poder_decisao: 'decisor',
      interesse: [70, 92],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'DEV-06',
    cenario: 'descoberta',
    particao: 'dev',
    cliente: 'Softlar Móveis',
    texto: `Ana: Juliana, você comentou que o problema não é o ERP. Me explica melhor.
Juliana: O ERP tá ok. O Protheus faz o que tem que fazer. Meu problema é antes: eu não tenho previsibilidade de pipeline nenhuma.
Ana: Como assim?
Juliana: Meu time comercial tem oito vendedores. Eu só descubro que o mês vai ser ruim no dia vinte e cinco. Não tenho funil, não tenho nada estruturado. E o marketing não gera lead qualificado, gera volume que não converte.
Ana: E hoje vocês usam alguma ferramenta pra isso?
Juliana: Planilha e um CRM gratuito que ninguém preenche direito.
Ana: Juliana, isso é RD Station, não é ERP. É outra unidade nossa, e ela resolve exatamente esses dois pontos: o funil com previsibilidade e a nutrição de lead antes de chegar no vendedor.
Juliana: Eu nem sabia que a TOTVS tinha isso.
Ana: Tem, e integra com o Protheus, então o pedido fechado no CRM vira pedido no ERP sem redigitação.
Juliana: Isso resolveria uma dor grande aqui. Quanto custa?
Ana: Depende do número de usuários e do volume de contatos. Pra oito vendedores fica bem acessível, mas prefiro te mandar o número certo.
Juliana: Manda. E se der, marca uma demo com o meu gerente comercial junto.
Ana: Marco pra semana que vem.`,
    gold: gold({
      produtos: [
        { nome: 'TOTVS Protheus', status: 'em_uso' },
        { nome: 'RD Station', status: 'oportunidade' },
      ],
      dores: ['relatorios'],
      unidades_oportunidade: ['rd_station'],
      upsell_claro: true,
      sentimento: 'misto',
      poder_decisao: 'influenciador',
      interesse: [68, 90],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'DEV-07',
    cenario: 'reuniao_sem_conclusao',
    particao: 'dev',
    cliente: 'Confecções Duarte',
    texto: `Ana: Ricardo, você teve chance de olhar o material?
Ricardo: Olhei por cima.
Ana: E o que achou?
Ricardo: É, tem umas coisas interessantes ali.
Ana: Alguma dúvida que eu possa esclarecer agora?
Ricardo: Não, assim, no momento não.
Ana: Entendi. Ricardo, pra eu te ajudar melhor: o que precisaria acontecer pra isso virar prioridade aí dentro?
Ricardo: Olha, é que a gente tá num momento meio corrido. Tem muita coisa acontecendo.
Ana: Faz sentido. Consigo te propor uma conversa de trinta minutos com o pessoal da produção pra entender o cenário deles?
Ricardo: Deixa eu ver aqui como é que tá a agenda deles e te aviso.
Ana: Posso te procurar na semana que vem?
Ricardo: Pode. Vou ver e te aviso.`,
    gold: gold({
      dores: [],
      sentimento: 'neutro',
      poder_decisao: 'desconhecido',
      interesse: [0, 40],
      churn_risco: 'baixo',
      talk_ratio_vendedor: [0.5, 0.8],
    }),
  },

  {
    codigo: 'DEV-08',
    cenario: 'customer_success_saudavel',
    particao: 'dev',
    cliente: 'Farmácias Vida Nova',
    texto: `Carla: Bruno, é nossa revisão trimestral. Como foram esses três meses?
Bruno: Tranquilos, Carla. Sem sobressalto.
Carla: Algum chamado que ficou mal resolvido?
Bruno: Teve um em maio, de relatório, mas resolveram no mesmo dia. Nada demais.
Carla: E a adoção dos módulos novos que a gente liberou?
Bruno: O time tá usando. A Simone, do fiscal, adorou o painel novo. Disse que economiza uma manhã por semana.
Carla: Que bom. Tem alguma coisa que a gente poderia fazer melhor?
Bruno: Sinceramente? Nada urgente. Se eu fosse escolher, seria treinamento pros novatos, porque entrou gente nova e eles aprendem no boca a boca.
Carla: Isso eu consigo resolver. Temos trilha de onboarding gravada, te mando o acesso hoje.
Bruno: Perfeito, obrigado.
Carla: Marcamos a próxima revisão pra outubro?
Bruno: Marca sim.`,
    gold: gold({
      dores: [],
      sentimento: 'positivo',
      poder_decisao: 'desconhecido',
      interesse: [45, 75],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'DEV-09',
    cenario: 'descoberta',
    particao: 'dev',
    cliente: 'Metalpar Componentes',
    texto: `Ana: Sérgio, vocês já trabalharam com algum ERP grande antes?
Sérgio: Eu já. Na empresa anterior a gente usava SAP. Aqui não, aqui sempre foi TOTVS.
Ana: E como é a comparação, na sua cabeça?
Sérgio: São bichos diferentes. O SAP era mais pesado. Mas não é o caso aqui, isso ficou pra trás.
Ana: Entendido. E sobre investimento, existe alguma restrição pro projeto desse ano?
Sérgio: Não, preço não é problema pra gente. Não achamos caro, viu. O que pega mesmo é prazo. A gente precisa disso rodando antes da virada do exercício, senão perde a janela.
Ana: Então o crítico é o cronograma.
Sérgio: Exatamente. Se você me disser que implanta em noventa dias, eu assino amanhã. Se falar em seis meses, não serve.
Ana: Deixa eu levantar com o time de projetos e te trago um cronograma realista, não um cronograma bonito.
Sérgio: É assim que eu gosto.
Ana: Te retorno até quarta com as datas.
Sérgio: Fico no aguardo.`,
    gold: gold({
      concorrentes: [{ nome: 'SAP', ativo: false }],
      objecoes: ['prazo'],
      dores: [],
      upsell_claro: true,
      sentimento: 'neutro',
      poder_decisao: 'desconhecido',
      interesse: [60, 85],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'DEV-10',
    cenario: 'administrativa',
    particao: 'dev',
    cliente: 'Grupo Ipê',
    texto: `Ana: Oi Débora, essa é rapidinha só pra alinhar a agenda.
Débora: Oi Ana, pode falar.
Ana: A apresentação ficou pro dia doze, das dez às onze e meia. A sala é a do quinto andar.
Débora: Doze às dez, anotado. Vai ter café?
Ana: Vai ter café e vai ter almoço depois, se o pessoal puder ficar.
Débora: Ah, ótimo. Quantas pessoas vocês trazem?
Ana: Três: eu, o consultor de produto e o arquiteto.
Débora: Beleza. Vou reservar a sala grande então.
Ana: Perfeito. Preciso de acesso à rede de visitantes?
Débora: Precisa. Me manda os nomes completos até dia dez que eu cadastro na portaria.
Ana: Mando amanhã.
Débora: Então tá certo. Até dia doze.`,
    gold: gold({
      dores: [],
      sentimento: 'neutro',
      poder_decisao: 'desconhecido',
      interesse: [40, 70],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'DEV-11',
    cenario: 'upsell_modulo',
    particao: 'dev',
    cliente: 'Cerâmica São Bento',
    texto: `Ana: Paulo, vocês estão com o Protheus no financeiro e no estoque. E o fiscal?
Paulo: Fiscal é terceirizado, um escritório de contabilidade cuida.
Ana: E funciona?
Paulo: Funciona, mas é lento. Todo mês tem aquela dança de mandar arquivo, eles apontam erro, a gente corrige, manda de novo. E a apuração de imposto sai sempre em cima do prazo.
Ana: Se isso estivesse dentro do Protheus, o dado nasceria certo na origem e a apuração seria automática.
Paulo: Eu imagino que sim. Mas quanto tempo leva pra implantar isso?
Ana: Módulo fiscal em empresa que já tem Protheus roda em sessenta dias.
Paulo: Sessenta dias é muito. A gente precisa disso pra ontem, porque a Receita apertou a fiscalização no nosso setor.
Ana: Consigo fazer uma implantação em fases: a parte de nota fiscal e SPED em trinta dias, o resto depois.
Paulo: Aí sim. Manda uma proposta com esse escopo em fases que eu levo pro sócio.
Ana: Mando até segunda.
Paulo: E coloca o valor separado por fase, por favor.`,
    gold: gold({
      produtos: [{ nome: 'TOTVS Protheus', status: 'em_uso' }],
      objecoes: ['prazo'],
      dores: ['fiscal'],
      unidades_oportunidade: ['gestao'],
      upsell_claro: true,
      sentimento: 'misto',
      poder_decisao: 'influenciador',
      interesse: [65, 88],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'DEV-12',
    cenario: 'demonstracao',
    particao: 'dev',
    cliente: 'AgroPlan Sementes',
    texto: `Ana: Então, deixa eu te mostrar como funciona. Esse é o painel principal, onde você tem a visão da safra inteira. Aqui do lado esquerdo ficam os talhões, e cada um deles carrega o histórico completo: o que foi plantado, quando, qual insumo entrou, qual foi a produtividade. Isso alimenta automaticamente o custo por hectare, que aparece aqui embaixo. Repara que eu não digitei nada, tudo veio da apontamento de campo. Agora, se eu clicar aqui, eu abro a rastreabilidade do lote, que é o que a auditoria pede. Antes isso era planilha, e planilha não sobrevive a auditoria. Aqui em cima tem o comparativo entre safras, então você consegue ver se aquele investimento em correção de solo deu retorno ou não. E tudo isso conversa com o financeiro, então o custo de produção já bate com o que saiu do caixa. Deixa eu mostrar o aplicativo de campo também, porque é ele que faz a mágica acontecer. O agrônomo abre no celular, mesmo sem sinal, e sincroniza depois. Nada de caderninho.
Henrique: Entendi.
Ana: E aqui a gente tem os relatórios prontos pra certificação.
Henrique: Tá. Vou precisar pensar.
Ana: Claro. Alguma dúvida específica?
Henrique: Não, por enquanto não.`,
    gold: gold({
      dores: [],
      sentimento: 'neutro',
      poder_decisao: 'desconhecido',
      interesse: [25, 55],
      churn_risco: 'baixo',
      talk_ratio_vendedor: [0.85, 1],
    }),
  },
];
