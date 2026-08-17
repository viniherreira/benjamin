import type { BusinessUnit, CategoriaObjecao } from '../types';

/**
 * Léxicos do InsightIQ — arquivo único e editável.
 *
 * IMPORTANTE: todos os padrões são escritos em MINÚSCULO e SEM ACENTO, porque
 * rodam contra o `textoBusca` (ver segment.ts), que é a transcrição dobrada
 * nessa forma com o mesmo comprimento do original.
 *
 * O portfólio da TOTVS muda. Validar esta lista com o time antes do pitch.
 */

/* ================================================================== *
 * Produtos TOTVS, por unidade de negócio
 * ================================================================== */

export type EntradaProduto = {
  nome: string;
  unidade: BusinessUnit;
  padrao: string;
  /** Produto descontinuado que aponta para o atual. */
  legadoDe?: string;
};

export const PRODUTOS: EntradaProduto[] = [
  // --- TOTVS Gestão ---
  { nome: 'TOTVS Protheus', unidade: 'gestao', padrao: 'protheus' },
  { nome: 'TOTVS Datasul', unidade: 'gestao', padrao: 'datasul' },
  { nome: 'TOTVS RM', unidade: 'gestao', padrao: '(?:linha\\s+)?rm' },
  { nome: 'TOTVS Fluig', unidade: 'gestao', padrao: 'fluig(?!\\s+identity)' },
  { nome: 'Fluig Identity', unidade: 'gestao', padrao: 'fluig\\s+identity' },
  { nome: 'TOTVS Winthor', unidade: 'gestao', padrao: 'winthor' },
  { nome: 'TOTVS Logix', unidade: 'gestao', padrao: 'logix' },
  { nome: 'TOTVS Protheus', unidade: 'gestao', padrao: 'microsiga', legadoDe: 'Microsiga' },
  // "backoffice" sozinho é área funcional, não produto — exige a marca junto.
  { nome: 'TOTVS Backoffice', unidade: 'gestao', padrao: 'totvs\\s+backoffice' },
  { nome: 'TOTVS RH', unidade: 'gestao', padrao: 'totvs\\s+rh' },
  { nome: 'Folha de Pagamento', unidade: 'gestao', padrao: 'folha(?:\\s+de\\s+pagamento)?' },
  { nome: 'eSocial', unidade: 'gestao', padrao: 'e-?social' },
  { nome: 'Ponto Eletrônico', unidade: 'gestao', padrao: 'ponto\\s+eletronico' },
  { nome: 'TOTVS Moda', unidade: 'gestao', padrao: 'totvs\\s+moda' },
  { nome: 'TOTVS Varejo', unidade: 'gestao', padrao: 'totvs\\s+varejo' },
  { nome: 'TOTVS Saúde', unidade: 'gestao', padrao: 'totvs\\s+saude' },
  { nome: 'TOTVS Educacional', unidade: 'gestao', padrao: 'totvs\\s+educacional' },
  { nome: 'TOTVS Jurídico', unidade: 'gestao', padrao: 'totvs\\s+juridico' },
  { nome: 'TOTVS Construção', unidade: 'gestao', padrao: 'totvs\\s+construcao' },
  { nome: 'TOTVS Agro', unidade: 'gestao', padrao: 'totvs\\s+agro' },
  { nome: 'TOTVS Chef', unidade: 'gestao', padrao: 'totvs\\s+chef' },
  { nome: 'TOTVS Distribuição', unidade: 'gestao', padrao: 'totvs\\s+distribuicao' },
  { nome: 'TOTVS Manufatura', unidade: 'gestao', padrao: 'totvs\\s+manufatura' },
  { nome: 'TOTVS Gestão de Serviços', unidade: 'gestao', padrao: 'totvs\\s+gestao\\s+de\\s+servicos' },
  { nome: 'TOTVS Assinatura Eletrônica', unidade: 'gestao', padrao: 'assinatura\\s+eletronica' },
  { nome: 'Smart Analytics', unidade: 'gestao', padrao: 'smart\\s+analytics' },

  // --- RD Station ---
  { nome: 'RD Station Marketing', unidade: 'rd_station', padrao: 'rd\\s+station\\s+marketing' },
  { nome: 'RD Station CRM', unidade: 'rd_station', padrao: 'rd\\s+station\\s+crm' },
  { nome: 'RD Station', unidade: 'rd_station', padrao: 'rd\\s+station' },
  { nome: 'RD Conversas', unidade: 'rd_station', padrao: 'rd\\s+conversas' },

  // --- TOTVS Techfin ---
  { nome: 'TOTVS Techfin', unidade: 'techfin', padrao: 'techfin' },
  { nome: 'TOTVS Supplier', unidade: 'techfin', padrao: 'supplier' },
  { nome: 'TOTVS Antecipa', unidade: 'techfin', padrao: 'antecipa\\b' },
];

/** Sinais de necessidade que apontam para outra unidade de negócio (Cross-BU). */
export const SINAIS_CROSS_BU: { unidade: BusinessUnit; produto: string; padroes: string[] }[] = [
  {
    unidade: 'techfin',
    produto: 'TOTVS Techfin',
    padroes: [
      'fluxo de caixa',
      'capital de giro',
      'demora (?:pra|para) receber',
      'antecipa(?:r|cao) (?:de )?receb[ií]veis',
      'inadimplencia',
      'credito (?:b2b|para (?:o )?cliente)',
      'prazo de pagamento (?:do|dos) fornecedor',
      'conciliacao (?:bancaria|de pagamento)',
      'meio de pagamento',
    ],
  },
  {
    unidade: 'rd_station',
    produto: 'RD Station',
    padroes: [
      'previsibilidade (?:de|do) (?:pipeline|funil)',
      'lead qualificado',
      'geracao de lead',
      'automacao de marketing',
      'nutricao de lead',
      'marketing nao (?:gera|entrega)',
      'funil de vendas',
      'taxa de conversao (?:do|de) (?:site|lead)',
    ],
  },
];

/* ================================================================== *
 * Concorrentes
 * ================================================================== */

export const CONCORRENTES: { nome: string; padrao: string }[] = [
  { nome: 'SAP', padrao: 'sap(?:\\s+(?:s\\/?4\\s?hana|business one|b1))?' },
  { nome: 'Oracle', padrao: 'oracle(?:\\s+(?:netsuite|fusion))?' },
  { nome: 'NetSuite', padrao: 'netsuite' },
  { nome: 'Senior Sistemas', padrao: 'senior(?:\\s+sistemas)?' },
  { nome: 'Sankhya', padrao: 'sankhya' },
  { nome: 'Benner', padrao: 'benner' },
  { nome: 'LG lugar de gente', padrao: 'lg\\s+lugar\\s+de\\s+gente' },
  { nome: 'Alterdata', padrao: 'alterdata' },
  { nome: 'Nasajon', padrao: 'nasajon' },
  { nome: 'Questor', padrao: 'questor' },
  { nome: 'Omie', padrao: 'omie' },
  { nome: 'Bling', padrao: 'bling' },
  { nome: 'Conta Azul', padrao: 'conta\\s+azul' },
  { nome: 'Microsoft Dynamics 365', padrao: '(?:microsoft\\s+)?dynamics(?:\\s+365)?' },
  { nome: 'Infor', padrao: 'infor\\b' },
  { nome: 'Mega Sistemas', padrao: 'mega\\s+sistemas' },
  { nome: 'Metadados', padrao: 'metadados' },
  { nome: 'Ahgora', padrao: 'ahgora' },
  { nome: 'Sólides', padrao: 'solides' },
  { nome: 'Gupy', padrao: 'gupy' },
  { nome: 'Convenia', padrao: 'convenia' },
  { nome: 'Pontotel', padrao: 'pontotel' },
  { nome: 'Linx', padrao: 'linx' },
  { nome: 'Salesforce', padrao: 'salesforce' },
  { nome: 'Pipedrive', padrao: 'pipedrive' },
  { nome: 'HubSpot', padrao: 'hubspot' },
  { nome: 'ADP', padrao: 'adp\\b' },
];

/** Contexto que indica concorrente do PASSADO — não é ameaça ativa. */
export const CONTEXTO_CONCORRENTE_HISTORICO = [
  'usava',
  'usavamos',
  'tinha',
  'tinhamos',
  'ja usei',
  'ja usamos',
  'na empresa anterior',
  'no emprego anterior',
  'antigamente',
  'antes (?:a gente|nos|eu)',
  'saimos do',
  'migramos do',
  'largamos o',
  'abandonamos',
  'era o',
];

/** Contexto que indica avaliação ATIVA — ameaça real. */
export const CONTEXTO_CONCORRENTE_ATIVO = [
  'viu uma demo',
  'vimos uma demo',
  'demo d[ao]',
  'apresentacao d[ao]',
  'cotando com',
  'cotamos com',
  'orcamento (?:com|d[ao])',
  'proposta d[ao]',
  'avaliando',
  'comparando com',
  'conversando com',
  'reuniao com',
  'gostou',
  'gostaram',
  'esta na mesa',
  'considerando',
];

/* ================================================================== *
 * Gatilhos de compra
 * ================================================================== */

export const GATILHOS_COMPRA: { padrao: string; peso: number; rotulo: string }[] = [
  { padrao: 'quanto custa', peso: 10, rotulo: 'Perguntou preço' },
  { padrao: 'qual o (?:investimento|valor|custo)', peso: 10, rotulo: 'Perguntou investimento' },
  { padrao: 'manda (?:a|uma) proposta', peso: 12, rotulo: 'Pediu proposta' },
  { padrao: 'envia (?:a|uma) proposta', peso: 12, rotulo: 'Pediu proposta' },
  { padrao: 'me manda (?:o|um) orcamento', peso: 12, rotulo: 'Pediu orçamento' },
  { padrao: 'fazer (?:uma|a) proposta', peso: 10, rotulo: 'Pediu proposta' },
  { padrao: 'quando conseguimos implantar', peso: 7, rotulo: 'Perguntou implantação' },
  { padrao: 'prazo de implanta(?:cao|r)', peso: 7, rotulo: 'Perguntou prazo' },
  { padrao: 'quanto tempo (?:leva|demora) (?:a|para|pra)', peso: 7, rotulo: 'Perguntou prazo' },
  { padrao: 'quero expandir', peso: 7, rotulo: 'Mencionou expansão' },
  { padrao: 'outras filiais', peso: 7, rotulo: 'Mencionou filiais' },
  { padrao: 'mais licencas', peso: 7, rotulo: 'Mencionou licenças' },
  { padrao: 'modulo de', peso: 5, rotulo: 'Interesse em módulo' },
  { padrao: 'faz sentido (?:pra|para) (?:a )?gente', peso: 6, rotulo: 'Validou fit' },
  { padrao: 'vamos fechar', peso: 12, rotulo: 'Sinalizou fechamento' },
  { padrao: 'podemos assinar', peso: 12, rotulo: 'Sinalizou assinatura' },
  { padrao: 'assinar o contrato', peso: 12, rotulo: 'Falou em contrato' },
  { padrao: 'proximos passos', peso: 6, rotulo: 'Pediu próximos passos' },
  { padrao: 'consolidar tudo (?:na|no|com a) totvs', peso: 10, rotulo: 'Quer consolidar na TOTVS' },
  { padrao: 'prefiro consolidar', peso: 10, rotulo: 'Quer consolidar na TOTVS' },
  { padrao: 'prefiro (?:ficar com|a|manter) (?:a )?totvs', peso: 10, rotulo: 'Preferência declarada pela TOTVS' },
  { padrao: 'unificar (?:tudo )?(?:num|em um) (?:so )?fornecedor', peso: 8, rotulo: 'Quer unificar fornecedor' },
  { padrao: 'me interessa', peso: 8, rotulo: 'Declarou interesse' },
  { padrao: 'quero ver (?:isso|com numero)', peso: 8, rotulo: 'Pediu detalhamento' },
  { padrao: '(?:marca|agenda|marque|agende) (?:uma |a )?(?:demo|call|apresentacao|conversa)', peso: 8, rotulo: 'Pediu agendamento' },
  { padrao: '(?:traz|manda|envia) (?:essa|uma|a) (?:simulacao|proposta|conta)', peso: 10, rotulo: 'Pediu proposta' },
  { padrao: 'se paga', peso: 6, rotulo: 'Avaliou retorno' },
  { padrao: 'muda a minha vida', peso: 7, rotulo: 'Reconheceu valor' },
  { padrao: 'quero testar', peso: 8, rotulo: 'Pediu teste' },
  { padrao: 'prova de conceito', peso: 8, rotulo: 'Pediu POC' },
  { padrao: '\\bpoc\\b', peso: 8, rotulo: 'Pediu POC' },
];

/* ================================================================== *
 * Sinais de churn
 * ================================================================== */

export const SINAIS_CHURN: { padrao: string; peso: number; rotulo: string }[] = [
  { padrao: 'cancelar', peso: 25, rotulo: 'Falou em cancelar' },
  { padrao: 'nao vamos renovar', peso: 30, rotulo: 'Disse que não renova' },
  { padrao: 'revendo o contrato', peso: 20, rotulo: 'Revendo o contrato' },
  { padrao: 'insatisfeit[oa]', peso: 18, rotulo: 'Declarou insatisfação' },
  { padrao: 'nao esta funcionando', peso: 15, rotulo: 'Produto não funciona' },
  { padrao: 'chamado sem resposta', peso: 15, rotulo: 'Chamado sem resposta' },
  { padrao: 'suporte demora', peso: 14, rotulo: 'Suporte lento' },
  { padrao: 'avaliando alternativas', peso: 22, rotulo: 'Avaliando alternativas' },
  { padrao: 'cotando com', peso: 22, rotulo: 'Cotando com concorrente' },
  { padrao: 'comparando com', peso: 15, rotulo: 'Comparando com concorrente' },
  { padrao: 'reduzir (?:as )?licencas', peso: 20, rotulo: 'Quer reduzir licenças' },
  { padrao: 'problema recorrente', peso: 16, rotulo: 'Problema recorrente' },
  { padrao: 'terceira vez', peso: 16, rotulo: 'Problema repetido' },
  { padrao: 'perdemos a paciencia', peso: 25, rotulo: 'Paciência esgotada' },
  { padrao: 'nao entregaram o que prometeram', peso: 22, rotulo: 'Promessa não cumprida' },
  { padrao: 'vou escalar', peso: 18, rotulo: 'Vai escalar internamente' },
  { padrao: 'ta insustentavel', peso: 20, rotulo: 'Situação insustentável' },
];

/* ================================================================== *
 * Objeções
 * ================================================================== */

export const OBJECOES: { categoria: CategoriaObjecao; padroes: string[] }[] = [
  {
    categoria: 'preco',
    padroes: [
      'muito caro',
      '\\bcaro\\b',
      'carissimo',
      'acima do (?:orcamento|budget|que (?:eu )?(?:tenho|temos))',
      'nao cabe no (?:budget|orcamento)',
      'fora do (?:nosso )?orcamento',
      'consegue (?:um )?desconto',
      'tem desconto',
      'sai mais barato',
      'valor (?:esta|ta) alto',
      'preco (?:esta|ta|continua) (?:alto|sendo o ponto|caro)',
      'numero (?:grande|alto)',
      'salgado',
      'ainda (?:esta|ta) fora',
      'passa (?:do|o) (?:teto|limite)',
      'reajuste (?:veio )?acima',
    ],
  },
  {
    categoria: 'prazo',
    padroes: [
      'muito demorado',
      'precisamos (?:pra|para) ontem',
      'precisa (?:disso|estar|ta) (?:pra|para) ontem',
      '\\d+ dias e muito',
      '(?:trinta|sessenta|noventa|cento e vinte) dias e muito',
      '(?:seis|tres|quatro|cinco) meses(?:,)? nao serve',
      'nao da tempo',
      'prazo (?:esta|ta) apertado',
      'perde a janela',
      'antes da virada',
    ],
  },
  {
    categoria: 'concorrencia',
    padroes: [
      'o concorrente cobra menos',
      'eles (?:cobram|oferecem|pedem) menos',
      'veio bem abaixo',
      'mais barato',
      '(?:uns )?\\w+ por cento abaixo',
      'a proposta (?:deles|dele) (?:veio|e)',
      'o numero deles e (?:bem )?menor',
      'acharam mais simples que a de voces',
    ],
  },
  {
    categoria: 'tecnica',
    padroes: [
      'nao integra',
      'nao sei se conversa com',
      'nosso legado',
      'sistema legado',
      'vai precisar de customizacao',
      'muita customizacao',
      'nao roda (?:no|na)',
      'incompativel',
      'sera que integra',
      'e integrado (?:mesmo|ne)',
    ],
  },
  {
    categoria: 'processo',
    padroes: [
      'passar por compras',
      'processo interno',
      'passar pelo juridico',
      'o juridico (?:precisa|tem que|vai)',
      'area de compras',
      'precisa de licitacao',
      'politica interna',
      'vira processo',
    ],
  },
  {
    categoria: 'autoridade',
    padroes: [
      'preciso aprovar com',
      'aprovar internamente',
      'nao sou eu quem decide',
      'levar (?:pra|para) (?:o|a) (?:diretoria|comite|conselho|socio)',
      'levo (?:pra|para) (?:o|a) (?:diretoria|comite|conselho|socio)',
      'depende (?:do|da) (?:cfo|ceo|diretor|conselho|comite)',
      'quem (?:decide|bate o martelo) e',
      'preciso validar com (?:meu|minha)',
      'comite de investimento',
      'meu socio (?:esta|ta) cobrando',
    ],
  },
];

/* ================================================================== *
 * Dores, por categoria — alimentam o radar
 * ================================================================== */

/**
 * `generica: true` marca a categoria que só descreve a FORMA da dor, não o
 * domínio dela. "Planilha" e "manual" aparecem em quase toda dor real, então
 * numa mesma frase o domínio (rh, fiscal, financeiro) sempre ganha — senão o
 * radar viraria uma coluna gigante de "processo manual" e nada acionável.
 */
export const CATEGORIAS_DOR: {
  categoria: string;
  rotulo: string;
  padroes: string[];
  generica?: boolean;
}[] = [
  {
    categoria: 'rh',
    rotulo: 'RH e folha de pagamento',
    padroes: ['folha manual', 'folha de pagamento', 'fechamento da folha', '\\bfolha\\b', 'ponto manual', 'esocial', 'admissao', 'rescisao', 'time de rh', 'setor de rh', 'pessoal do rh', '\\brh\\b', 'departamento pessoal', 'hora extra'],
  },
  {
    categoria: 'fiscal',
    rotulo: 'Fiscal e tributário',
    padroes: ['fiscal', 'tributari', 'sped', 'nota fiscal', 'icms', 'apuracao de imposto', 'obrigacao acessoria'],
  },
  {
    categoria: 'financeiro',
    rotulo: 'Financeiro e fluxo de caixa',
    padroes: ['fluxo de caixa', 'contas a (?:pagar|receber)', 'conciliacao', 'inadimplencia', 'capital de giro', 'cobranca'],
  },
  {
    categoria: 'estoque',
    rotulo: 'Estoque e logística',
    padroes: ['estoque', 'inventario', 'logistica', 'expedicao', 'armazem', 'wms', 'ruptura'],
  },
  {
    categoria: 'integracao',
    rotulo: 'Integração entre sistemas',
    padroes: ['integracao', 'integrar', 'nao conversa com', 'planilha (?:no|de) meio', 'api', 'dado duplicado', 'redigitar'],
  },
  {
    categoria: 'suporte',
    rotulo: 'Suporte e atendimento',
    padroes: ['suporte', 'chamado', 'atendimento demora', 'sem resposta', 'sla'],
  },
  {
    categoria: 'usabilidade',
    rotulo: 'Usabilidade',
    padroes: ['dificil de usar', 'nao e intuitivo', 'interface', 'muita tela', 'usuario reclama', 'treinamento (?:e|foi) dificil'],
  },
  {
    categoria: 'custo',
    rotulo: 'Custo',
    padroes: ['custo alto', 'caro demais', 'mensalidade', 'licenca cara', 'reajuste', 'ficou caro', 'pagando por (?:elas|eles|licenca)', 'juros'],
  },
  {
    categoria: 'performance',
    rotulo: 'Performance',
    padroes: ['lento', 'travando', 'trava', 'demora (?:pra|para) (?:abrir|carregar|processar)', 'fora do ar', 'instavel'],
  },
  {
    categoria: 'compliance',
    rotulo: 'Compliance',
    padroes: ['lgpd', 'auditoria', 'compliance', 'conformidade', 'governanca'],
  },
  {
    categoria: 'relatorios',
    rotulo: 'Relatórios e BI',
    padroes: ['relatorio', 'indicador', 'dashboard', '\\bbi\\b', 'nao tenho visibilidade', 'sem visao', 'previsibilidade', 'nao sei o que (?:volta|converte)', 'so descubro'],
  },
  {
    categoria: 'mobilidade',
    rotulo: 'Mobilidade',
    padroes: ['no celular', 'aplicativo', 'acesso remoto', 'em campo', 'mobile'],
  },
  {
    categoria: 'processo_manual',
    rotulo: 'Processo manual e retrabalho',
    padroes: ['manual', 'planilha', 'excel', 'retrabalho', 'digitar de novo', 'no papel', 'na mao', 'redigita'],
    generica: true,
  },
];

/* ================================================================== *
 * Confiança (rapport com o vendedor)
 * ================================================================== */

export const SINAIS_CONFIANCA: { padrao: string; delta: number; rotulo: string }[] = [
  { padrao: 'nao (?:menciona|mencione|mencionar|comenta|comente|fala|fale|conta|conte|espalha)', delta: 18, rotulo: 'Pediu sigilo sobre informação sensível' },
  { padrao: 'entre (?:nos|a gente)', delta: 15, rotulo: 'Falou em off' },
  { padrao: 'confidencial', delta: 12, rotulo: 'Marcou assunto como confidencial' },
  { padrao: 'te falo (?:isso )?(?:porque )?confio', delta: 15, rotulo: 'Declarou confiança' },
  { padrao: 'o que (?:voce|vc) (?:acha|recomenda|faria)', delta: 12, rotulo: 'Pediu opinião ao vendedor' },
  { padrao: 'na sua experiencia', delta: 10, rotulo: 'Consultou a experiência do vendedor' },
  { padrao: 'politica (?:interna|da casa)', delta: 10, rotulo: 'Revelou política interna' },
  { padrao: 'aqui dentro (?:e|a gente|tem)', delta: 8, rotulo: 'Revelou dinâmica interna' },
  { padrao: 'nosso problema (?:real|de verdade) e', delta: 10, rotulo: 'Admitiu problema interno' },
  { padrao: 'vou te apresentar (?:o|a|para)', delta: 12, rotulo: 'Apresentou outra pessoa do time' },
  { padrao: 'te apresento (?:o|a)', delta: 12, rotulo: 'Apresentou outra pessoa do time' },
  { padrao: 'pode (?:me )?chamar (?:no|direto)', delta: 8, rotulo: 'Abriu canal direto' },
];

export const SINAIS_DESCONFIANCA: { padrao: string; delta: number; rotulo: string }[] = [
  { padrao: 'vou ver e te aviso', delta: -12, rotulo: 'Resposta evasiva sobre próximo passo' },
  { padrao: 'depois (?:eu )?(?:te )?(?:retorno|falo|aviso)', delta: -10, rotulo: 'Adiou sem compromisso' },
  { padrao: 'nao posso (?:falar|comentar) (?:sobre )?(?:isso|valores|orcamento)', delta: -12, rotulo: 'Recusou falar de orçamento' },
  { padrao: 'prefiro nao (?:comentar|falar)', delta: -10, rotulo: 'Evitou o assunto' },
  { padrao: 'e integrado(?:,)? (?:ne|mesmo)\\?', delta: -8, rotulo: 'Desconfiança técnica explícita' },
  { padrao: 'sera que (?:funciona|integra|da certo)', delta: -8, rotulo: 'Duvidou da entrega' },
  { padrao: 'ja me prometeram isso', delta: -15, rotulo: 'Lembrou promessa não cumprida' },
];

/* ================================================================== *
 * Voz do cliente
 * ================================================================== */

export const VOZ_ELOGIO = [
  'gostei (?:muito )?d[oa]',
  'esta (?:muito )?bom',
  'funciona (?:muito )?bem',
  'resolveu (?:o nosso|nosso|meu)',
  'ajudou (?:muito|bastante)',
  'atende (?:bem|super bem)',
  'melhorou (?:muito|bastante)',
  'nao tenho (?:o que|nada a) reclamar',
];

export const VOZ_RECLAMACAO = [
  'nao gosto d[oa]',
  'e ruim',
  'deixa a desejar',
  'nunca funcionou',
  'da problema',
  'vive (?:travando|caindo|dando erro)',
  'e um parto',
  'ninguem consegue usar',
];

export const VOZ_LEGADO = [
  'sistema (?:antigo|legado)',
  'o que a gente usava antes',
  'na migracao',
  'quando migramos',
  'o fornecedor anterior',
  'ficou (?:pela metade|incompleto)',
];

export const VOZ_DUVIDA_JORNADA = [
  'como (?:funciona|e) (?:o|a) (?:contrato|implantacao|cobranca|treinamento|suporte)',
  'quem (?:faz|toca) (?:a|o) implantacao',
  'tem treinamento',
  'como e (?:a|o) (?:renovacao|reajuste)',
  'e cobrado por',
  'o que (?:esta|ta) incluso',
];

/* ================================================================== *
 * Sentimento PT-BR
 * ================================================================== */

export const PALAVRAS_POSITIVAS: Record<string, number> = {
  excelente: 1, excelentes: 1,
  gostei: 0.8, gostou: 0.8, gostaram: 0.8, gostamos: 0.8,
  satisfeito: 0.9, satisfeita: 0.9, satisfeitos: 0.9,
  funciona: 0.6, funcionando: 0.6, funcionou: 0.7,
  atende: 0.6, atendendo: 0.6, atendeu: 0.6,
  resolve: 0.7, resolveu: 0.8, resolvido: 0.7,
  ajuda: 0.5, ajudou: 0.6, ajudando: 0.5,
  rapido: 0.6, rapida: 0.6, agil: 0.6,
  facil: 0.6, simples: 0.5,
  maravilha: 0.9,
  melhorou: 0.7, melhor: 0.5, ganho: 0.5, ganhos: 0.5,
  eficiente: 0.7, pratico: 0.6, confiavel: 0.7, estavel: 0.6,
  adorei: 0.9, adorou: 0.9, sensacional: 0.9,
  interessante: 0.6, interessa: 0.6, economiza: 0.6, resolveria: 0.6,
};

/*
 * Fora da lista de propósito: "tranquilo", "legal", "bacana", "top", "show",
 * "beleza", "perfeito", "combinado", "ótimo". Em call comercial brasileira são
 * fórmulas de cortesia — "beleza, então tá combinado" fecha reunião péssima do
 * mesmo jeito que fecha reunião boa. Mantê-las empurrava quase toda transcrição
 * neutra para "positivo".
 */

export const PALAVRAS_NEGATIVAS: Record<string, number> = {
  ruim: -0.7, pessimo: -1, pessima: -1, horrivel: -1, terrivel: -0.9,
  problema: -0.6, problemas: -0.7, problematico: -0.7,
  erro: -0.6, erros: -0.7, falha: -0.7, falhas: -0.7, falhou: -0.7,
  sofrendo: -0.9, sofre: -0.8, sofrem: -0.8, sofrimento: -0.9,
  dificil: -0.6, dificuldade: -0.6, complicado: -0.6, complexo: -0.4,
  demora: -0.6, demorado: -0.7, demorando: -0.7, lento: -0.7, lentidao: -0.7,
  travando: -0.8, trava: -0.7, travou: -0.8, caiu: -0.6, caindo: -0.7,
  caro: -0.6, carissimo: -0.9,
  insatisfeito: -1, insatisfeita: -1, insatisfacao: -0.9,
  reclamacao: -0.7, reclamando: -0.7, reclama: -0.6, reclamam: -0.7,
  frustrado: -0.9, frustrada: -0.9, frustrante: -0.9, frustracao: -0.9,
  retrabalho: -0.8, manual: -0.4, bug: -0.7, bugs: -0.8,
  instavel: -0.8, confuso: -0.6, chato: -0.5,
  perdendo: -0.7, perda: -0.7, perdemos: -0.7,
  atraso: -0.7, atrasado: -0.7, atrasando: -0.7,
  quebrou: -0.8, parou: -0.7, impossivel: -0.8,
  preocupado: -0.5, preocupacao: -0.5, receio: -0.5, medo: -0.6,
};

export const INTENSIFICADORES: Record<string, number> = {
  muito: 1.6, muita: 1.6, super: 1.7, extremamente: 2, bastante: 1.4,
  demais: 1.7, bem: 1.3, totalmente: 1.8, completamente: 1.8,
  absurdamente: 2, horrores: 1.8, pra: 1, bastantes: 1.4,
};

export const ATENUADORES: Record<string, number> = {
  meio: 0.6, pouco: 0.5, levemente: 0.5, razoavelmente: 0.7, relativamente: 0.7,
};

export const NEGADORES = ['nao', 'nunca', 'jamais', 'nenhum', 'nenhuma', 'nada', 'sem'];

/* ================================================================== *
 * Aspectos — âncoras para o sentimento decomposto
 * ================================================================== */

export const ASPECTOS: { rotulo: string; padroes: string[] }[] = [
  { rotulo: 'Backoffice/Protheus', padroes: ['backoffice', 'protheus', 'back office', 'retaguarda'] },
  { rotulo: 'RH/Folha', padroes: ['\\brh\\b', 'folha', 'recursos humanos', 'departamento pessoal', 'ponto eletronico', 'esocial'] },
  { rotulo: 'Financeiro', padroes: ['financeiro', 'fluxo de caixa', 'contas a (?:pagar|receber)', 'tesouraria'] },
  { rotulo: 'Fiscal', padroes: ['fiscal', 'tributari', 'sped', 'nota fiscal'] },
  { rotulo: 'Estoque/Logística', padroes: ['estoque', 'logistica', 'expedicao', 'almoxarifado'] },
  { rotulo: 'Integração', padroes: ['integracao', 'integrado', 'integrar', '\\bapi\\b'] },
  { rotulo: 'Suporte', padroes: ['suporte', 'chamado', 'atendimento'] },
  { rotulo: 'Implantação', padroes: ['implantacao', 'implementacao', 'projeto de implanta', 'go.?live'] },
  { rotulo: 'Usabilidade', padroes: ['usabilidade', 'interface', 'tela do sistema', 'facil de usar', 'dificil de usar'] },
  { rotulo: 'Custo', padroes: ['preco', 'custo', 'valor', 'mensalidade', 'licenca'] },
  { rotulo: 'Relatórios/BI', padroes: ['relatorio', 'dashboard', 'indicador', '\\bbi\\b'] },
  { rotulo: 'Vendas/CRM', padroes: ['\\bcrm\\b', 'pipeline', 'funil', 'lead'] },
];

/* ================================================================== *
 * Cargos e poder de decisão
 * ================================================================== */

export const CARGOS: { padrao: string; rotulo: string; poder: 'decisor' | 'influenciador' | 'usuario' }[] = [
  { padrao: '\\bceo\\b', rotulo: 'CEO', poder: 'decisor' },
  { padrao: '\\bcfo\\b', rotulo: 'CFO', poder: 'decisor' },
  { padrao: '\\bcto\\b', rotulo: 'CTO', poder: 'decisor' },
  { padrao: '\\bcio\\b', rotulo: 'CIO', poder: 'decisor' },
  { padrao: 'presidente', rotulo: 'Presidente', poder: 'decisor' },
  { padrao: 'socio', rotulo: 'Sócio', poder: 'decisor' },
  { padrao: 'proprietari[oa]', rotulo: 'Proprietário', poder: 'decisor' },
  { padrao: 'diretor(?:a)?', rotulo: 'Diretor', poder: 'decisor' },
  { padrao: 'head de', rotulo: 'Head', poder: 'influenciador' },
  { padrao: 'gerente', rotulo: 'Gerente', poder: 'influenciador' },
  { padrao: 'gestor(?:a)?', rotulo: 'Gestor', poder: 'influenciador' },
  { padrao: 'coordenador(?:a)?', rotulo: 'Coordenador', poder: 'influenciador' },
  { padrao: 'supervisor(?:a)?', rotulo: 'Supervisor', poder: 'influenciador' },
  { padrao: 'analista', rotulo: 'Analista', poder: 'usuario' },
  { padrao: 'assistente', rotulo: 'Assistente', poder: 'usuario' },
];

/** Menção a um superior que precisa aprovar: quem fala não é o decisor final. */
export const SUPERIOR_ACIMA = [
  'meu (?:cfo|ceo|diretor|chefe|gestor|superior)',
  'nosso (?:cfo|ceo|diretor|presidente)',
  'a diretoria',
  'o conselho',
  'preciso (?:aprovar|validar) com',
  'quem (?:aprova|decide) e',
  'levar (?:pra|para) (?:a )?diretoria',
];

/* ================================================================== *
 * Muletas de linguagem — proxy de ruído da transcrição
 * ================================================================== */

export const MULETAS = ['ne', 'tipo', 'assim', 'entao', 'ah', 'eh', 'hum', 'tipo assim', 'sabe', 'olha', 'poxa'];
