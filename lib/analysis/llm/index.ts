import { z } from 'zod';
import type { AnalysisResult } from '../types';
import { gerar, MODELO, temChave } from './gemini';
import { montarPromptUsuario } from './prompt';
import type { Descartado, Enriquecimento, ItemAncorado, ResultadoEnriquecimento } from './tipos';

/**
 * Enriquecimento por LLM, com a mesma regra de evidência que vale para o resto
 * do produto: item sem citação localizável no texto não é exibido.
 *
 * A checagem é mecânica. O modelo devolve o trecho que sustenta cada observação;
 * se esse trecho não existe na transcrição, o item vai para `descartados` e a
 * interface mostra quantos foram recusados. É a diferença entre confiar no
 * modelo e verificar o modelo.
 */

const RespostaSchema = z.object({
  resumo: z.string(),
  nuance: z.array(z.object({ observacao: z.string(), citacao: z.string() })),
  proxima_acao: z.object({ acao: z.string(), citacao: z.string() }),
});

const escapar = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Onde a citação está no texto.
 *
 * Tenta o casamento literal primeiro. Se falhar, tenta de novo tolerando
 * diferença de espaço em branco — modelo costuma normalizar quebra de linha —,
 * e ainda assim devolve os offsets do texto ORIGINAL. Nada de reconstruir a
 * citação a partir do que o modelo escreveu: o `quote` sempre sai de
 * `texto.slice(inicio, fim)`, então o invariante do projeto continua valendo.
 */
function localizar(texto: string, citacao: string): { inicio: number; fim: number } | null {
  const alvo = citacao.trim();
  if (alvo.length < 8) return null;

  const direto = texto.indexOf(alvo);
  if (direto >= 0) return { inicio: direto, fim: direto + alvo.length };

  const tolerante = alvo.split(/\s+/).map(escapar).join('\\s+');
  const m = new RegExp(tolerante, 'u').exec(texto);
  if (m) return { inicio: m.index, fim: m.index + m[0].length };

  return null;
}

function ancorar(
  texto: string,
  citacao: string,
  conteudo: string,
): { item: ItemAncorado } | { falhou: true } {
  const pos = localizar(texto, citacao);
  if (!pos) return { falhou: true };

  return {
    item: {
      texto: conteudo,
      evidence: {
        quote: texto.slice(pos.inicio, pos.fim),
        start: pos.inicio,
        end: pos.fim,
      },
    },
  };
}

export async function enriquecer(entrada: {
  texto: string;
  analise: AnalysisResult;
  sinal?: AbortSignal;
}): Promise<ResultadoEnriquecimento> {
  if (!temChave()) {
    return {
      ok: false,
      motivo: 'sem_chave',
      detalhe:
        'GEMINI_API_KEY não está no ambiente. O enriquecimento é opcional: o briefing continua completo, montado pelo motor determinístico.',
    };
  }

  if (entrada.texto.trim().length < 50) {
    return {
      ok: false,
      motivo: 'sem_texto',
      detalhe: 'A transcrição é curta demais para enriquecer.',
    };
  }

  const t0 = performance.now();
  const bruto = await gerar(montarPromptUsuario(entrada.texto, entrada.analise), entrada.sinal);
  const latency_ms = Math.round(performance.now() - t0);

  if ('motivo' in bruto) {
    return { ok: false, motivo: bruto.motivo, detalhe: bruto.detalhe };
  }

  const parsed = RespostaSchema.safeParse(bruto.json);
  if (!parsed.success) {
    return {
      ok: false,
      motivo: 'resposta_invalida',
      detalhe: 'A resposta do modelo não bate com o contrato esperado.',
    };
  }

  const r = parsed.data;
  const descartados: Descartado[] = [];

  const nuance: ItemAncorado[] = [];
  for (const n of r.nuance.slice(0, 3)) {
    const a = ancorar(entrada.texto, n.citacao, n.observacao);
    if ('item' in a) nuance.push(a.item);
    else descartados.push({ campo: 'nuance', texto: n.observacao, citacao: n.citacao });
  }

  let proxima_acao: ItemAncorado | null = null;
  const acao = ancorar(entrada.texto, r.proxima_acao.citacao, r.proxima_acao.acao);
  if ('item' in acao) proxima_acao = acao.item;
  else {
    descartados.push({
      campo: 'proxima_acao',
      texto: r.proxima_acao.acao,
      citacao: r.proxima_acao.citacao,
    });
  }

  const dados: Enriquecimento = {
    resumo: r.resumo.trim() || null,
    nuance,
    proxima_acao,
    descartados,
    provider: 'gemini',
    model: MODELO,
    latency_ms,
    tokens: bruto.tokens,
  };

  return { ok: true, dados };
}

export { MODELO, temChave };
export type { Enriquecimento, ItemAncorado, ResultadoEnriquecimento } from './tipos';
