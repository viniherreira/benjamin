import type { Redacao } from '../types';

/**
 * Anonimização LGPD.
 *
 * Regra de ouro deste módulo: a máscara tem EXATAMENTE o mesmo comprimento do
 * trecho mascarado. Sem isso, todo offset depois do primeiro CPF andaria e a
 * evidência apontaria para o lugar errado na transcrição. É o motivo de não
 * usarmos "[CPF]" ou string vazia.
 *
 * O valor original nunca é guardado — só o tipo e a posição.
 */

type Regra = { tipo: Redacao['type']; re: RegExp };

// A ordem importa: o mais específico primeiro, para o CNPJ não ser comido pelo CPF.
const REGRAS: Regra[] = [
  { tipo: 'cnpj', re: /\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/g },
  { tipo: 'cnpj', re: /\b\d{14}\b/g },
  { tipo: 'cartao', re: /\b\d{4}[ .-]\d{4}[ .-]\d{4}[ .-]\d{4}\b/g },
  { tipo: 'cpf', re: /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g },
  { tipo: 'cpf', re: /\b\d{11}\b/g },
  { tipo: 'email', re: /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g },
  // Telefone só com parênteses ou hífen: evita comer valor monetário solto.
  { tipo: 'telefone', re: /\(\d{2}\)\s?\d{4,5}-?\d{4}\b/g },
  { tipo: 'telefone', re: /\b\d{2}\s?9?\d{4}-\d{4}\b/g },
  { tipo: 'telefone', re: /\b9\d{4}-\d{4}\b/g },
];

export type ResultadoRedacao = {
  /** Mesmo comprimento do texto de entrada. */
  texto: string;
  redacoes: Redacao[];
};

export function redigir(bruto: string): ResultadoRedacao {
  const chars = [...bruto];
  const ocupado = new Array<boolean>(chars.length).fill(false);
  const redacoes: Redacao[] = [];

  for (const { tipo, re } of REGRAS) {
    re.lastIndex = 0;
    for (const m of bruto.matchAll(re)) {
      const inicio = m.index;
      const fim = inicio + m[0].length;

      // Não remascarar trecho já coberto por uma regra mais específica.
      let livre = true;
      for (let i = inicio; i < fim; i++) {
        if (ocupado[i]) {
          livre = false;
          break;
        }
      }
      if (!livre) continue;

      for (let i = inicio; i < fim; i++) {
        ocupado[i] = true;
        // Preserva os separadores para o trecho continuar legível como "tipo de dado".
        chars[i] = /[.\-/() ]/.test(chars[i] ?? '') ? (chars[i] as string) : '#';
      }
      redacoes.push({ type: tipo, start: inicio, end: fim });
    }
  }

  const texto = chars.join('');

  /* istanbul ignore next — invariante estrutural, não caminho de execução */
  if (texto.length !== bruto.length) {
    throw new Error('Redação alterou o comprimento do texto — offsets de evidência ficariam inválidos.');
  }

  redacoes.sort((a, b) => a.start - b.start);
  return { texto, redacoes };
}
