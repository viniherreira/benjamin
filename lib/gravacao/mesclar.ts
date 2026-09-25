import { montarTranscricao, type Fala } from '../lote/falantes';

/**
 * Duas gravações — o microfone de quem vende e o áudio da aba da reunião —
 * viram UMA transcrição com quem falou o quê.
 *
 * É identificação de falante sem modelo: o canal diz o lado. Tudo o que o
 * microfone captou é do vendedor; tudo o que veio da aba do Meet ou do Teams é
 * do outro lado. Para o motor isso vale mais do que qualquer inferência,
 * porque talk ratio, voz do cliente e o filtro de sentimento dependem
 * exatamente de separar os dois lados, e aqui a separação é física.
 *
 * O rótulo do vendedor leva o cargo — "Ana Torres (Vendedora):" — porque o
 * motor lê cargo como o sinal de papel mais forte que existe numa transcrição
 * (lib/analysis/rules/papeis.ts). Achado o vendedor, quem sobra é cliente.
 */

export type Segmento = { inicio: number; fim: number; texto: string };

export type Canais = { vendedor: Segmento[]; cliente: Segmento[] };

function palavras(t: string): Set<string> {
  return new Set(
    t
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((p) => p.length >= 3),
  );
}

function semelhanca(a: string, b: string): number {
  const A = palavras(a);
  const B = palavras(b);
  if (A.size === 0 || B.size === 0) return 0;
  let comum = 0;
  for (const p of A) if (B.has(p)) comum++;
  return comum / Math.min(A.size, B.size);
}

function sobreposicao(a: Segmento, b: Segmento): number {
  const inter = Math.min(a.fim, b.fim) - Math.max(a.inicio, b.inicio);
  return inter <= 0 ? 0 : inter / Math.max(0.001, a.fim - a.inicio);
}

/**
 * Sem fone de ouvido, a voz do cliente sai do alto-falante e entra no
 * microfone. O cancelamento de eco do navegador remove quase tudo, mas o que
 * escapa apareceria duas vezes — uma como cliente, outra como vendedor — e o
 * vendedor ganharia falas que não disse. Segmento do microfone que coincide no
 * tempo E no conteúdo com um do cliente é eco e sai.
 */
export function removerEco(canais: Canais): { vendedor: Segmento[]; removidos: number } {
  let removidos = 0;
  const vendedor = canais.vendedor.filter((v) => {
    const eco = canais.cliente.some((c) => sobreposicao(v, c) >= 0.4 && semelhanca(v.texto, c.texto) >= 0.6);
    if (eco) removidos++;
    return !eco;
  });
  return { vendedor, removidos };
}

export function rotuloVendedor(nome: string): string {
  const limpo = nome.trim();
  return limpo ? `${limpo} (Vendedor)` : 'Vendedor';
}

export function mesclarCanais(
  canais: Canais,
  nomes: { vendedor: string; cliente?: string },
): { texto: string; ecosRemovidos: number } {
  const { vendedor, removidos } = removerEco(canais);
  const rv = rotuloVendedor(nomes.vendedor);
  const rc = nomes.cliente?.trim() || 'Cliente';

  const todas = [
    ...vendedor.map((s) => ({ ...s, falante: rv })),
    ...canais.cliente.map((s) => ({ ...s, falante: rc })),
  ].sort((a, b) => a.inicio - b.inicio || a.fim - b.fim);

  const falas: Fala[] = todas.map((s) => ({ falante: s.falante, texto: s.texto }));
  return { texto: montarTranscricao(falas), ecosRemovidos: removidos };
}

/**
 * Um canal só (reunião presencial, ou online sem o áudio da aba): não há como
 * saber quem falou. Parágrafo novo a cada pausa de 1,5 s — o melhor indício
 * disponível de troca de turno — e nenhum rótulo inventado.
 */
export function transcricaoDeUmCanal(segmentos: Segmento[]): string {
  const paragrafos: string[] = [];
  let atual = '';
  let fimAnterior = -Infinity;
  for (const s of [...segmentos].sort((a, b) => a.inicio - b.inicio)) {
    const t = s.texto.trim();
    if (!t) continue;
    if (atual && s.inicio - fimAnterior >= 1.5) {
      paragrafos.push(atual.trim());
      atual = '';
    }
    atual += ` ${t}`;
    fimAnterior = s.fim;
  }
  if (atual.trim()) paragrafos.push(atual.trim());
  return paragrafos.join('\n');
}
