import type {
  Budget,
  Concorrente,
  Objecao,
  Oportunidade,
  Persona,
  Problema,
  ProdutoTotvs,
  ProximoPasso,
  SentimentoAspecto,
} from '../types';
import { CATEGORIAS_DOR } from './lexicons';

/**
 * Resumo extrativo.
 *
 * Com o motor rodando só em regras, o resumo é montado a partir dos fatos já
 * extraídos — cada frase corresponde a campos que têm evidência própria. Isso
 * tem uma vantagem sobre resumo gerado por modelo: nada aqui pode ser inventado,
 * porque nada aqui é escrito livremente. Se o fato não foi extraído, a frase
 * não existe.
 */

const brl = (n: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(n);

const lista = (itens: string[]): string => {
  if (itens.length === 0) return '';
  if (itens.length === 1) return itens[0] as string;
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
};

const rotuloDor = (categoria: string): string =>
  CATEGORIAS_DOR.find((c) => c.categoria === categoria)?.rotulo ?? categoria;

const PODER: Record<Persona['decision_power'], string> = {
  decisor: 'é quem decide',
  influenciador: 'influencia a decisão, mas depende de aprovação acima',
  usuario: 'é usuário, sem poder de decisão',
  desconhecido: 'tem poder de decisão não identificado na conversa',
};

export type DadosResumo = {
  produtos: ProdutoTotvs[];
  problemas: Problema[];
  objecoes: Objecao[];
  concorrentes: Concorrente[];
  oportunidades: Oportunidade[];
  budget: Budget[];
  persona: Persona;
  proximosPassos: ProximoPasso[];
  aspectos: SentimentoAspecto[];
  interesse: number;
};

export function montarResumo(d: DadosResumo): string {
  const frases: string[] = [];

  // 1. O que o cliente já tem e quem está falando.
  const emUso = d.produtos.filter((p) => p.status === 'em_uso').map((p) => p.name);
  const parteStack = emUso.length > 0 ? `O cliente já opera com ${lista(emUso)}.` : '';
  const parteQuem = d.persona.role
    ? `O interlocutor é ${d.persona.role} e ${PODER[d.persona.decision_power]}.`
    : d.persona.decision_power !== 'desconhecido'
      ? `O interlocutor ${PODER[d.persona.decision_power]}.`
      : '';
  if (parteStack || parteQuem) frases.push([parteStack, parteQuem].filter(Boolean).join(' '));

  // 2. A dor principal.
  const dor = d.problemas[0];
  if (dor) {
    const outras = d.problemas.length - 1;
    frases.push(
      `A dor central está em ${rotuloDor(dor.category)}${outras > 0 ? `, com mais ${outras} ponto(s) de atrito citado(s)` : ''}.`,
    );
  }

  // 3. Sentimento decomposto, quando há contraste.
  const bons = d.aspectos.filter((a) => a.polarity === 'positivo').map((a) => a.aspect);
  const ruins = d.aspectos.filter((a) => a.polarity === 'negativo').map((a) => a.aspect);
  if (bons.length > 0 && ruins.length > 0) {
    frases.push(`Satisfeito com ${lista(bons)}, insatisfeito com ${lista(ruins)}.`);
  }

  // 4. Ameaça competitiva.
  const ativo = d.concorrentes.find((c) => c.active);
  if (ativo) {
    frases.push(
      `${ativo.name} está na mesa com ameaça ${ativo.threat} — precisa ser endereçado antes do próximo passo.`,
    );
  }

  // 5. Oportunidade e dinheiro.
  const melhor = [...d.oportunidades].sort((a, b) => b.probability - a.probability)[0];
  const valor = d.budget[0];
  if (melhor) {
    const pct = Math.round(melhor.probability * 100);
    const comValor = valor?.amount
      ? ` Budget de ${brl(valor.amount)} declarado${valor.confidential ? ', com pedido de sigilo' : ''}.`
      : '';
    frases.push(`Oportunidade de ${melhor.product} com ${pct}% de probabilidade.${comValor}`);
  } else if (valor?.amount) {
    frases.push(
      `Budget de ${brl(valor.amount)} declarado${valor.confidential ? ', com pedido de sigilo' : ''}.`,
    );
  }

  // 6. Objeção em aberto.
  const objAberta = d.objecoes.find((o) => !o.resolved);
  if (objAberta) {
    frases.push(`Objeção de ${objAberta.category} segue sem resposta.`);
  }

  // 7. Compromisso — ou a falta dele.
  if (d.proximosPassos.length === 0) {
    frases.push('A reunião terminou sem próximo passo definido, o que derruba o interesse projetado.');
  } else {
    frases.push(`Próximo passo registrado: ${(d.proximosPassos[0] as ProximoPasso).text}`);
  }

  if (frases.length === 0) {
    return 'A transcrição não trouxe sinais comerciais suficientes para um briefing. Verifique se o texto está completo.';
  }

  return frases.slice(0, 6).join(' ');
}
