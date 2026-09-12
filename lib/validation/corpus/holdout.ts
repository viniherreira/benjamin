import { gold, type Amostra } from '../tipos';

/**
 * PARTIÇÃO HOLDOUT — lacrada.
 *
 * Escritas junto com as de dev e nunca abertas para diagnóstico. Sobre estas eu
 * só rodo a métrica agregada; não leio o erro individual e não ajusto léxico
 * olhando para elas. Se o F1 de dev ficar muito acima do de holdout, o motor
 * decorou e o relatório de validação precisa dizer isso em voz alta.
 */
export const CORPUS_HOLDOUT: Amostra[] = [
  {
    codigo: 'HLD-01',
    cenario: 'negociacao',
    particao: 'holdout',
    cliente: 'Plásticos Riviera',
    texto: `Ana: Cláudio, você viu a proposta revisada?
Cláudio: Vi. Continua salgado, Ana. Noventa mil é acima do orçamento que a diretoria liberou.
Ana: Qual o teto?
Cláudio: Setenta. E olha que eu já briguei pra chegar nesse número.
Ana: Consigo trabalhar tirando o módulo de BI da primeira fase. Isso derruba pra setenta e quatro.
Cláudio: Setenta e quatro ainda tá fora. E tem outra: a Senior mandou proposta ontem, e veio bem abaixo.
Ana: Quanto abaixo?
Cláudio: Uns vinte por cento. Não vou fingir que não conta.
Ana: Conta, claro. Só te peço pra comparar escopo, porque a proposta deles não inclui a integração com o que você já tem rodando.
Cláudio: Isso é verdade, eu preciso olhar com calma.
Ana: Posso montar um comparativo linha a linha?
Cláudio: Monta. Se a diferença real for pequena, eu defendo vocês aqui dentro.
Ana: Te mando quinta.`,
    gold: gold({
      papeis: { ana: 'vendedor', 'cláudio': 'cliente' },
      concorrentes: [{ nome: 'Senior Sistemas', ativo: true }],
      objecoes: ['preco', 'concorrencia', 'autoridade'],
      dores: [],
      upsell_claro: true,
      budget: 90000,
      sentimento: 'negativo',
      poder_decisao: 'influenciador',
      interesse: [30, 60],
      churn_risco: 'medio',
    }),
  },

  {
    codigo: 'HLD-02',
    cenario: 'customer_success_insatisfeito',
    particao: 'holdout',
    cliente: 'Têxtil Guarani',
    texto: `Carla: Mônica, obrigada por me receber. Sei que a implantação não foi como esperado.
Mônica: Não foi mesmo. Vou te dizer o que aconteceu do meu ponto de vista.
Carla: Por favor.
Mônica: Vocês prometeram go-live em cento e vinte dias. Estamos no dia duzentos e dez e o módulo de custos ainda não está rodando. Não entregaram o que prometeram, Carla, simples assim.
Carla: Você tem razão no prazo.
Mônica: E não é só prazo. O consultor que estava com a gente saiu no meio, e o que entrou não sabia nada do nosso processo. A gente teve que explicar tudo de novo. Isso é insustentável.
Carla: Isso não deveria ter acontecido e eu não vou tentar justificar.
Mônica: Olha, meu diretor já pediu pra eu levantar o custo de sair. Estamos avaliando alternativas, inclusive a Benner, que atende umas concorrentes nossas.
Carla: Mônica, me deixa trazer um plano de recuperação com governança semanal e um gerente de projeto sênior dedicado. Em quinze dias eu te mostro o custo rodando.
Mônica: Quinze dias. Se passar disso, a conversa muda de assunto.
Carla: Entendido.`,
    gold: gold({
      papeis: { carla: 'vendedor', 'mônica': 'cliente' },
      concorrentes: [{ nome: 'Benner', ativo: true }],
      dores: ['suporte'],
      churn_claro: true,
      sentimento: 'negativo',
      poder_decisao: 'influenciador',
      interesse: [0, 30],
      churn_risco: 'alto',
    }),
  },

  {
    codigo: 'HLD-03',
    cenario: 'descoberta',
    particao: 'holdout',
    cliente: 'Atacado Boa Praça',
    texto: `Ana: Vanessa, me conta como funciona o financeiro de vocês hoje.
Vanessa: A gente recebe de tudo quanto é jeito: boleto, cartão, pix, prazo de rede. E aí a conciliação bancária é um inferno.
Ana: Manual?
Vanessa: Manual. Duas pessoas passam a semana inteira batendo extrato com o sistema. E sempre sobra diferença que ninguém sabe de onde veio.
Ana: E isso atrasa o fechamento?
Vanessa: Atrasa tudo. A gente fecha o mês dia quinze do mês seguinte, o que é um absurdo.
Ana: Vanessa, isso não é problema de ERP, é problema de meio de pagamento desconectado da gestão. A gente tem uma frente de Techfin que resolve exatamente isso: o pagamento nasce dentro do sistema e concilia sozinho.
Vanessa: E funciona com os bancos que a gente já usa?
Ana: Funciona, e também com as adquirentes de cartão.
Vanessa: Se isso me devolver duas pessoas por semana, já se paga.
Ana: Posso trazer uma simulação com o volume de vocês?
Vanessa: Traz. E me diz também quanto tempo leva pra implantar.`,
    gold: gold({
      papeis: { ana: 'vendedor', vanessa: 'cliente' },
      produtos: [{ nome: 'TOTVS Techfin', status: 'oportunidade' }],
      dores: ['financeiro', 'processo_manual'],
      unidades_oportunidade: ['techfin'],
      upsell_claro: true,
      sentimento: 'misto',
      poder_decisao: 'desconhecido',
      interesse: [65, 88],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'HLD-04',
    cenario: 'descoberta',
    particao: 'holdout',
    cliente: 'Construtora Horizonte',
    texto: `Ana: Seu Nilton, qual o maior aperto hoje?
Nilton: Capital de giro. A obra consome caixa antes de a medição ser paga.
Ana: E como o senhor cobre?
Nilton: Banco. E o banco cobra o que quer, porque sabe que eu preciso.
Ana: E se a antecipação de recebíveis viesse de dentro do sistema, com o contrato de medição já cadastrado?
Nilton: Aí a taxa seria menor?
Ana: Costuma ser, porque o risco é menor: quem antecipa enxerga o recebível na origem, não precisa confiar num documento que você mandou.
Nilton: Isso faz sentido. Nunca ninguém me ofereceu desse jeito.
Ana: É a nossa área de Techfin. E como vocês já usam o Protheus na obra, o dado já está lá.
Nilton: Quero ver isso com número. Me traz uma simulação com uma medição real nossa.
Ana: Trago. Preciso que o senhor me autorize a puxar os dados de uma obra.
Nilton: Autorizo. Fala com o Marcelo do financeiro que ele te passa.`,
    gold: gold({
      papeis: { ana: 'vendedor', nilton: 'cliente' },
      produtos: [
        { nome: 'TOTVS Protheus', status: 'em_uso' },
        { nome: 'TOTVS Techfin', status: 'oportunidade' },
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
    codigo: 'HLD-05',
    cenario: 'descoberta',
    particao: 'holdout',
    cliente: 'EduPlus Cursos',
    texto: `Ana: Tatiana, você disse que o problema tá no topo do funil.
Tatiana: Tá. A gente gasta em anúncio e não sabe o que volta. O marketing não gera lead qualificado, gera cadastro frio.
Ana: E o time comercial?
Tatiana: Reclama. Diz que liga pra gente que nem lembra de ter preenchido formulário.
Ana: Vocês fazem alguma nutrição antes de passar pro vendedor?
Tatiana: Nada. Cai no HubSpot free e o vendedor liga.
Ana: Então o problema é de processo, não de mídia. Com nutrição e pontuação de lead, só chega no vendedor quem já demonstrou intenção.
Tatiana: E vocês fazem isso?
Ana: Fazemos, é o RD Station Marketing junto com o RD Station CRM. E dá pra medir a conversão etapa por etapa, que é o que te falta hoje.
Tatiana: Isso seria ótimo pra apresentar pro conselho. Eles vivem perguntando quanto custa o aluno.
Ana: Consigo montar a conta de custo por aluno com os seus dados.
Tatiana: Monta e marca uma call comigo e com o meu head de marketing.`,
    gold: gold({
      papeis: { ana: 'vendedor', tatiana: 'cliente' },
      produtos: [
        { nome: 'RD Station Marketing', status: 'oportunidade' },
        { nome: 'RD Station CRM', status: 'oportunidade' },
      ],
      concorrentes: [{ nome: 'HubSpot', ativo: true }],
      dores: ['relatorios'],
      unidades_oportunidade: ['rd_station'],
      upsell_claro: true,
      sentimento: 'misto',
      poder_decisao: 'influenciador',
      interesse: [65, 88],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'HLD-06',
    cenario: 'proposta',
    particao: 'holdout',
    cliente: 'Frigorífico Campo Belo',
    texto: `Ana: Então, Edson, essa é a proposta fechada. Duzentos e dez mil, implantação em cinco meses.
Edson: Tá dentro do que a gente conversou. Um pouco acima, mas dentro.
Ana: O que ficou acima?
Edson: Eu tinha na cabeça uns cento e noventa. Mas os dez por cento não vão inviabilizar.
Ana: Posso ajustar a forma de pagamento se ajudar o caixa.
Edson: Aí sim, isso ajuda mais que desconto. Consegue diluir a implantação em doze parcelas?
Ana: Consigo, sim.
Edson: Então manda a versão com essa condição que eu assino essa semana.
Ana: Mando hoje à tarde.
Edson: E já vai agendando o kickoff pro início do mês que vem.
Ana: Agendo. Preciso que você indique o sponsor interno.
Edson: Sou eu mesmo. Aqui quem decide investimento de sistema sou eu.`,
    gold: gold({
      papeis: { ana: 'vendedor', edson: 'cliente' },
      objecoes: ['preco'],
      dores: [],
      upsell_claro: true,
      budget: 210000,
      sentimento: 'positivo',
      poder_decisao: 'decisor',
      interesse: [82, 100],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'HLD-07',
    cenario: 'alinhamento_tecnico',
    particao: 'holdout',
    cliente: 'Grupo Andrade',
    texto: `Rafael: Pessoal, essa call é só pra fechar o ambiente de homologação.
Diego: Beleza. A VM já foi provisionada ontem.
Rafael: Sistema operacional?
Diego: Linux, conforme o documento. Dezesseis giga de RAM, quatro vCPU.
Rafael: E o banco?
Diego: Instância separada, já com o dump de teste carregado.
Rafael: A liberação de porta saiu?
Diego: Saiu na sexta. O time de rede liberou a faixa que vocês pediram.
Rafael: Então tá tudo pronto. Vou rodar o instalador amanhã de manhã.
Diego: Se der algum erro de permissão me chama no direct que eu resolvo na hora.
Rafael: Combinado. Alguma janela que eu deva evitar?
Diego: Evita entre onze e treze, que é backup.
Rafael: Anotado.`,
    gold: gold({
      papeis: { rafael: 'vendedor', diego: 'cliente' },
      dores: [],
      sentimento: 'neutro',
      poder_decisao: 'desconhecido',
      interesse: [40, 70],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'HLD-08',
    cenario: 'institucional',
    particao: 'holdout',
    cliente: 'Cooperativa Vale do Sol',
    texto: `Ana: Dona Marlene, muito obrigada por nos receber na cooperativa.
Marlene: Imagina, é um prazer. Vocês vieram de longe?
Ana: De São Paulo, saímos cedo.
Marlene: Puxa. Aceitam um café? O da cooperativa é bom, é da nossa produção.
Ana: Aceito com prazer.
Marlene: A cooperativa tem sessenta e dois anos, sabia? Começou com onze famílias.
Ana: Não sabia. E hoje são quantos cooperados?
Marlene: Mil e quatrocentos. Cresceu muito, principalmente na última década.
Ana: É uma história bonita.
Marlene: É. Olha, hoje eu queria só que vocês conhecessem a estrutura. Amanhã a gente conversa de sistema com o pessoal técnico.
Ana: Perfeito, é assim mesmo que a gente gosta de começar.
Marlene: Então vem, deixa eu te mostrar o armazém.`,
    gold: gold({
      papeis: { ana: 'vendedor', marlene: 'cliente' },
      dores: [],
      sentimento: 'positivo',
      poder_decisao: 'desconhecido',
      interesse: [40, 70],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'HLD-09',
    cenario: 'descoberta',
    particao: 'holdout',
    cliente: 'Química Delta',
    texto: `Ana: Leandro, vocês vieram de outro sistema?
Leandro: Vim eu, na verdade. Onde eu trabalhava antes a gente tinha Oracle. Aqui já era TOTVS quando eu cheguei.
Ana: E a experiência anterior te ajuda ou atrapalha?
Leandro: Ajuda a comparar. Mas aquilo ficou pra trás, não é uma opção aqui.
Ana: Entendido. E o que hoje não está coberto?
Leandro: Fiscal. A gente faz apuração de imposto em planilha, e no nosso setor a substituição tributária é complicada. Todo mês é sofrimento.
Ana: Isso é exatamente o que o módulo fiscal resolve, e como vocês já têm a base, ele entra encaixado.
Leandro: Quanto tempo leva?
Ana: Sessenta dias.
Leandro: Faz sentido pra gente. Manda uma proposta que eu levo pro comitê de investimento.
Ana: Mando até quarta. Quem participa desse comitê?
Leandro: Eu, o controller e o diretor industrial. Quem bate o martelo é o diretor.`,
    gold: gold({
      papeis: { ana: 'vendedor', leandro: 'cliente' },
      concorrentes: [{ nome: 'Oracle', ativo: false }],
      dores: ['fiscal', 'processo_manual'],
      unidades_oportunidade: ['gestao'],
      upsell_claro: true,
      sentimento: 'misto',
      poder_decisao: 'influenciador',
      interesse: [68, 90],
      churn_risco: 'baixo',
    }),
  },

  {
    codigo: 'HLD-10',
    cenario: 'renovacao',
    particao: 'holdout',
    cliente: 'Varejo Estrela',
    texto: `Carla: Gustavo, a renovação está próxima. Como vocês estão vendo?
Gustavo: Carla, com franqueza, a gente vai reduzir licenças. Fechamos quatro lojas no ano passado e continuamos pagando por elas.
Carla: Isso a gente ajusta, sem problema.
Gustavo: Ainda bem, porque do jeito que estava não ia rolar. E tem o preço: o reajuste do ano passado veio bem acima da inflação. Ficou caro pro tamanho que a gente tem hoje.
Carla: Entendo. Consigo revisar as duas coisas.
Gustavo: Olha, e eu preciso ser transparente: a Alterdata veio conversar comigo e o número deles é bem menor. Eu não quero trocar, dá trabalho, mas o meu sócio está cobrando.
Carla: Agradeço a transparência. Me dá uma semana pra montar uma revisão completa: licenças pelo uso real e reajuste renegociado.
Gustavo: Uma semana eu te dou. Depois disso eu preciso levar alguma coisa pro meu sócio.
Carla: Terei.`,
    gold: gold({
      papeis: { carla: 'vendedor', gustavo: 'cliente' },
      concorrentes: [{ nome: 'Alterdata', ativo: true }],
      objecoes: ['preco'],
      dores: ['custo'],
      churn_claro: true,
      sentimento: 'negativo',
      poder_decisao: 'influenciador',
      interesse: [10, 40],
      churn_risco: 'alto',
    }),
  },

  {
    codigo: 'HLD-11',
    cenario: 'demonstracao',
    particao: 'holdout',
    cliente: 'Logística Trans Sul',
    texto: `Ana: Vou te mostrar o fluxo completo. Começa aqui, na entrada da carga. O conferente bica o volume com o coletor e o sistema já valida contra o pedido, então divergência aparece na hora, não no fim do dia. Daqui o volume vai pro endereçamento, e o próprio sistema sugere a posição ideal considerando giro e peso. Isso reduz deslocamento dentro do armazém, e no seu volume isso é dinheiro. Aqui em cima você acompanha a ocupação em tempo real. Repara nessa parte: quando a ocupação passa de oitenta e cinco por cento, o sistema começa a alertar, porque acima disso a produtividade despenca. Agora deixa eu te mostrar a expedição, que é onde a maioria das empresas perde. O sistema monta a onda de separação por rota, não por pedido. Isso muda completamente a eficiência do picking. E aqui a gente tem a torre de controle com todos os indicadores. Tem também o app do motorista, com comprovante digital de entrega, então acabou aquele canhoto perdido. E toda essa informação alimenta o faturamento automaticamente.
Wagner: Entendi.
Ana: Ficou alguma dúvida?
Wagner: Não, ficou claro. Vou conversar internamente.`,
    gold: gold({
      papeis: { ana: 'vendedor', wagner: 'cliente' },
      dores: [],
      sentimento: 'neutro',
      poder_decisao: 'desconhecido',
      interesse: [25, 55],
      churn_risco: 'baixo',
      talk_ratio_vendedor: [0.85, 1],
    }),
  },

  {
    codigo: 'HLD-12',
    cenario: 'follow_up',
    particao: 'holdout',
    cliente: 'Móveis Bonatto',
    texto: `Ana: Sandra, tudo bem? Vim entender por que a proposta travou.
Sandra: Travou porque eu perdi a confiança, Ana. Vou ser franca.
Ana: Prefiro assim.
Sandra: Vocês ficaram de mandar o ambiente de teste em duas semanas. Passou mês e meio. Já me prometeram isso antes, na outra negociação, e também não veio.
Ana: Você está certa e a falha é nossa.
Sandra: E aí eu fico numa posição ruim aqui dentro, porque eu defendi vocês. Meu diretor pergunta e eu não tenho resposta.
Ana: Vou te dar data com nome: o ambiente sobe segunda, e quem responde por ele é o Márcio, do time de soluções.
Sandra: Anotei. E o preço, mexeu?
Ana: Consigo manter a condição anterior por mais trinta dias.
Sandra: O preço continua alto pro que a gente vai usar de verdade. Mas isso a gente discute depois que o ambiente estiver de pé.
Ana: Justo.
Sandra: Se falhar de novo, eu paro a conversa. Sem drama, mas paro.`,
    gold: gold({
      papeis: { ana: 'vendedor', sandra: 'cliente' },
      objecoes: ['preco'],
      dores: [],
      churn_claro: true,
      sentimento: 'negativo',
      poder_decisao: 'influenciador',
      interesse: [10, 45],
      churn_risco: 'alto',
    }),
  },

  {
    codigo: 'HLD-13',
    cenario: 'renovacao',
    particao: 'holdout',
    cliente: 'Hospital Santa Lúcia',
    texto: `Carla: Doutor Almeida, a renovação vence em noventa dias.
Almeida: Pois é. Carla, eu vou ser honesto: a diretoria está insatisfeita.
Carla: Com o quê especificamente?
Almeida: Com o tempo de resposta. A gente abriu um chamado crítico no agendamento em janeiro e ficou quatro dias parado. Num hospital, quatro dias é uma eternidade.
Carla: É inaceitável, concordo.
Almeida: E não foi isolado. É problema recorrente. Toda vez que tem atualização, alguma coisa quebra.
Carla: Doutor, o que a diretoria precisa ver pra renovar com tranquilidade?
Almeida: Um acordo de nível de serviço de verdade, com multa. E um canal de emergência que atenda em duas horas.
Carla: Consigo levar isso para negociação contratual.
Almeida: Faça isso. Porque do jeito que está, a recomendação que vai subir é para não renovar e abrir concorrência.
Carla: Me dá até o fim do mês para trazer a proposta de SLA.
Almeida: Tem até lá.`,
    gold: gold({
      papeis: { carla: 'vendedor', almeida: 'cliente' },
      dores: ['suporte'],
      churn_claro: true,
      sentimento: 'negativo',
      poder_decisao: 'influenciador',
      interesse: [5, 35],
      churn_risco: 'alto',
    }),
  },

  /*
   * ADVERSARIAIS — o cliente abre a reunião.
   *
   * Escritas pelo mesmo motivo das de dev: sem elas o baseline "quem fala
   * primeiro é o vendedor" é perfeito por construção também no holdout, e a
   * acurácia de papel medida aqui não significaria nada.
   *
   * São cenários correntes em campo — o cliente que antecipa a conversa de
   * renovação, e o comitê do cliente que convoca o fornecedor — escolhidos por
   * serem realistas, não por mirarem alguma falha já observada do motor. Erro
   * individual delas continua fechado a diagnóstico.
   */

  {
    codigo: 'HLD-14',
    cenario: 'renovacao_aberta_pelo_cliente',
    particao: 'holdout',
    cliente: 'Auto Peças Quatro Rodas',
    texto: `Rogério: Carla, eu adiantei essa conversa de propósito, antes de vocês me mandarem a renovação.
Carla: Tudo bem. Me conta o que você está pensando.
Rogério: Eu quero renovar, isso não está em discussão. O que eu não quero é renovar no mesmo desenho.
Carla: Que parte incomoda?
Rogério: A gente paga por trinta e cinco licenças e usa vinte e duas. Isso vem se arrastando desde que fechamos a filial de Betim.
Carla: Isso a gente consegue ajustar no aditivo.
Rogério: E tem outra: o módulo de compras ninguém usa. Foi contratado no pacote e nunca saiu do papel.
Carla: Aí eu prefiro entender antes de tirar. Se ninguém usou, pode ser que faltou implantação, não que o módulo não sirva.
Rogério: Pode ser. Mas hoje ele é custo sem retorno.
Carla: Deixa eu levantar o histórico de uso e te trazer as duas opções: ativar direito ou retirar do contrato.
Rogério: Me traz até o dia vinte, que é quando eu fecho o orçamento do ano.
Carla: Até o dia vinte.`,
    gold: gold({
      papeis: { rogério: 'cliente', carla: 'vendedor' },
      dores: ['custo'],
      objecoes: ['preco'],
      sentimento: 'misto',
      poder_decisao: 'decisor',
      interesse: [45, 72],
      churn_risco: 'medio',
    }),
  },

  {
    codigo: 'HLD-15',
    cenario: 'descoberta_com_tres_do_cliente',
    particao: 'holdout',
    cliente: 'Rede Farmacêutica Bom Preço',
    texto: `Marcelo: Ana, obrigado por vir. Deixa eu apresentar o time: a Renata é do financeiro e o Douglas cuida da TI.
Ana: Prazer a todos.
Marcelo: A gente chamou vocês porque o fechamento contábil virou um problema de gestão, não só de contabilidade.
Renata: Eu fecho o mês em onze dias úteis. Deveria fechar em cinco. E fecho porque eu viro a noite, não porque o processo funciona.
Ana: O que consome esses dias?
Renata: Conciliação. A gente tem trinta e duas lojas e cada uma manda o movimento de um jeito diferente.
Douglas: E a integração que a gente fez internamente quebra toda vez que muda alguma coisa no meio do caminho. Eu não tenho time pra sustentar aquilo.
Ana: Vocês já avaliaram alguma solução de mercado pra isso?
Douglas: A gente olhou a Alterdata no ano passado, mas parou por falta de gente pra tocar o projeto.
Marcelo: Dessa vez é diferente. Eu já tenho verba aprovada pro ano que vem.
Ana: De que ordem, se puder falar?
Marcelo: Uns duzentos mil. Não é público isso, tá?
Ana: Fica entre nós. Posso montar um desenho e voltar com vocês três juntos?
Marcelo: Pode. Marca com a minha secretária.`,
    gold: gold({
      papeis: { marcelo: 'cliente', ana: 'vendedor', renata: 'cliente', douglas: 'cliente' },
      concorrentes: [{ nome: 'Alterdata', ativo: false }],
      dores: ['financeiro', 'integracao'],
      unidades_oportunidade: ['techfin'],
      budget: 200000,
      sentimento: 'misto',
      poder_decisao: 'decisor',
      interesse: [70, 92],
      churn_risco: 'baixo',
    }),
  },
];
