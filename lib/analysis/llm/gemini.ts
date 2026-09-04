import { SCHEMA_RESPOSTA, SISTEMA } from './prompt';
import type { MotivoFalha } from './tipos';

/**
 * Cliente do Gemini, em `fetch` puro.
 *
 * Sem SDK de propósito: uma dependência a mais para montar um POST com JSON não
 * se paga, e o projeto inteiro é assim (sem UI kit, gráficos em SVG próprio).
 * Trocar de provedor daqui é reescrever este arquivo, e só ele.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Flash é a linha certa: dentro da camada gratuita e barata em latência quando
 * há capacidade. `thinkingLevel: 'low'` porque a tarefa é reescrever e observar,
 * não raciocinar em cadeia.
 *
 * Medido nesta reunião, três execuções seguidas com prompt idêntico: 22,4 s,
 * 4,5 s e 25,8 s. A variação é da fila do provedor gratuito, não do prompt nem
 * do tamanho da entrada — e é por isso que a interface avisa o usuário em vez de
 * fingir que o tempo é previsível.
 */
export const MODELO = 'gemini-3.6-flash';

export type RespostaBruta = {
  json: unknown;
  tokens: { entrada: number; saida: number };
};

export type FalhaProvedor = { motivo: MotivoFalha; detalhe: string };

export function temChave(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Uma retentativa para falha transitória do provedor.
 *
 * Não é zelo excessivo: na primeira chamada real deste código o Gemini devolveu
 * 502 depois de 19 s, e a segunda tentativa idêntica funcionou. Numa
 * apresentação ao vivo, um clique que falha por soluço de rede é caro demais
 * para não custar uma segunda tentativa. Limite de cota (429) não é retentado —
 * insistir só piora.
 */
export async function gerar(
  promptUsuario: string,
  sinal?: AbortSignal,
): Promise<RespostaBruta | FalhaProvedor> {
  const primeira = await tentar(promptUsuario, sinal);
  if (!('motivo' in primeira) || primeira.motivo !== 'provedor') return primeira;
  return tentar(promptUsuario, sinal);
}

async function tentar(
  promptUsuario: string,
  sinal?: AbortSignal,
): Promise<RespostaBruta | FalhaProvedor> {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) {
    return {
      motivo: 'sem_chave',
      detalhe: 'GEMINI_API_KEY não está no ambiente. O enriquecimento é opcional: sem ela o briefing continua completo, montado pelo motor determinístico.',
    };
  }

  let resp: Response;
  try {
    resp = await fetch(`${BASE}/${MODELO}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': chave, 'content-type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SISTEMA }] },
        contents: [{ role: 'user', parts: [{ text: promptUsuario }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: SCHEMA_RESPOSTA,
          temperature: 0.2,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
      ...(sinal ? { signal: sinal } : {}),
    });
  } catch (e) {
    return {
      motivo: 'provedor',
      detalhe: `Falha de rede ao chamar o Gemini: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  if (resp.status === 429) {
    return {
      motivo: 'limite_excedido',
      detalhe: 'Limite de requisições da camada gratuita atingido. Aguarde um minuto e tente de novo — o briefing determinístico não depende disto.',
    };
  }

  if (!resp.ok) {
    const corpo = await resp.text().catch(() => '');
    return {
      motivo: 'provedor',
      detalhe: `Gemini respondeu ${resp.status}. ${corpo.slice(0, 300)}`,
    };
  }

  const corpo = (await resp.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };

  const texto = corpo.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!texto) {
    return { motivo: 'resposta_invalida', detalhe: 'O Gemini respondeu sem conteúdo de texto.' };
  }

  let json: unknown;
  try {
    json = JSON.parse(texto);
  } catch {
    return {
      motivo: 'resposta_invalida',
      detalhe: 'O Gemini devolveu algo que não é JSON, apesar do schema declarado.',
    };
  }

  return {
    json,
    tokens: {
      entrada: corpo.usageMetadata?.promptTokenCount ?? 0,
      saida: corpo.usageMetadata?.candidatesTokenCount ?? 0,
    },
  };
}
