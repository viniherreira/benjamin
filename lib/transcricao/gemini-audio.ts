/**
 * Transcrição de áudio pelo Gemini, na camada gratuita.
 *
 * Por que não só o Whisper: ele devolve um bloco de texto corrido, sem separar
 * quem falou. Medido sobre as 37 amostras do corpus, remover os rótulos de
 * falante custa o talk ratio, o interesse e o risco de churn nas 37 — metade do
 * briefing — e ainda infla a lista de dores em 30%, porque a dor que o VENDEDOR
 * descreve entra como se fosse do cliente. Além disso o Whisper é pago.
 *
 * O Gemini recebe o áudio e devolve a transcrição já dividida por falante, no
 * formato "Nome: fala" que Meet e Teams exportam e que o motor sabe ler.
 *
 * Recebe UM trecho por vez (até 110 s, cortado no navegador por causa do limite
 * de 4,5 MB da Vercel). Para a mesma voz manter o mesmo rótulo de um trecho
 * para o outro, cada chamada leva as últimas falas do trecho anterior como
 * contexto.
 *
 * Limitação declarada: a separação é feita por um modelo, não por diarização
 * acústica. Ele acerta a fronteira de turno muito melhor do que texto corrido,
 * mas pode trocar dois falantes de lugar — principalmente entre trechos, onde
 * só vê o texto anterior e não a voz.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Mesma linha usada no enriquecimento: dentro da camada gratuita. */
export const MODELO_AUDIO = 'gemini-3.6-flash';

const INSTRUCAO = `Você recebe um trecho de áudio de uma reunião comercial em português do Brasil.

Transcreva TUDO o que foi dito, palavra por palavra, separando por quem fala.

Regras:
- Uma linha por turno de fala, no formato "Rótulo: o que foi dito".
- Se a pessoa for identificada pelo nome na conversa, use o nome dela como rótulo (primeiro nome, ou nome e sobrenome).
- Se o nome não aparecer, use "Falante A", "Falante B", "Falante C"… e mantenha o mesmo rótulo para a mesma voz do começo ao fim.
- Não resuma, não corrija a gramática de quem falou e não invente nada. Trecho inaudível vira [inaudível].
- Sem marcação de tempo, sem cabeçalho, sem negrito e sem comentário seu.
- Se o trecho não tiver fala, devolva uma resposta vazia.
- Devolva apenas a transcrição.`;

function instrucaoComContexto(contexto: string): string {
  return `${INSTRUCAO}

Este trecho continua uma gravação. O trecho anterior terminou com as falas abaixo:
"""
${contexto}
"""
- Use os MESMOS rótulos para as mesmas pessoas, mesmo que descubra o nome de alguém só agora.
- NÃO repita essas falas: transcreva só o que se ouve neste áudio.`;
}

export type TrechoTranscrito = { texto: string };

export type FalhaTranscricao = {
  erro: string;
  detalhe?: string;
  /** Status HTTP que a rota devolve — o cliente decide tentar de novo por ele. */
  status: number;
  retryAfter?: number;
};

export function ehFalha(v: TrechoTranscrito | FalhaTranscricao): v is FalhaTranscricao {
  return 'erro' in v;
}

export function temChaveGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

const LETRAS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Deixa a resposta no formato que o motor reconhece como turno.
 *
 * O motor só aceita rótulo feito de letras (lib/analysis/rules/segment.ts):
 * "Falante 1:" passaria batido e a reunião inteira perderia os turnos. Então
 * número vira letra — sempre a mesma letra para o mesmo número, o que mantém a
 * correspondência entre trechos.
 */
export function limparSaida(bruto: string, contexto = ''): string {
  const jaDito = new Set(
    contexto
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean),
  );

  const linhas = bruto
    .replace(/```[a-z]*\n?/gi, '')
    .replace(/\*\*/g, '')
    .split('\n')
    .map((l) =>
      l
        .trim()
        .replace(/^[-•]\s+/, '')
        .replace(/^(?:falante|speaker|locutor|pessoa|participante)\s*[_-]?\s*(\d{1,2})\s*:/i, (_, n: string) => {
          const i = Math.max(0, Number(n) - 1);
          return `Falante ${LETRAS[i % 26]}:`;
        }),
    )
    .filter(Boolean);

  // Se o modelo repetiu o contexto no começo, apesar da instrução, corta.
  let inicio = 0;
  while (inicio < linhas.length && jaDito.has(linhas[inicio]!)) inicio++;
  return linhas.slice(inicio).join('\n').trim();
}

/** O Gemini diz quanto esperar dentro do corpo do 429 ("retryDelay": "23s"). */
function esperaSugerida(corpo: string): number | undefined {
  const m = /"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/.exec(corpo);
  return m ? Math.ceil(Number(m[1])) : undefined;
}

export async function transcreverTrechoComGemini(
  arquivo: File,
  contexto = '',
): Promise<TrechoTranscrito | FalhaTranscricao> {
  const chave = process.env.GEMINI_API_KEY;
  if (!chave) return { erro: 'GEMINI_API_KEY não está no ambiente.', status: 503 };

  const base64 = Buffer.from(await arquivo.arrayBuffer()).toString('base64');
  const ctx = contexto.trim().slice(-800);

  let resp: Response;
  try {
    resp = await fetch(`${BASE}/${MODELO_AUDIO}:generateContent`, {
      method: 'POST',
      headers: { 'x-goog-api-key': chave, 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              { text: ctx ? instrucaoComContexto(ctx) : INSTRUCAO },
              { inlineData: { mimeType: arquivo.type || 'audio/wav', data: base64 } },
            ],
          },
        ],
        generationConfig: {
          // Transcrever é copiar, não criar: temperatura zero e raciocínio
          // mínimo, que aqui só custaria tempo.
          temperature: 0,
          thinkingConfig: { thinkingLevel: 'low' },
        },
      }),
      // Abaixo do maxDuration da rota: melhor devolver um 502 que o navegador
      // tenta de novo do que deixar a Vercel matar a Function no meio.
      signal: AbortSignal.timeout(55_000),
    });
  } catch (e) {
    return {
      erro: 'O transcritor demorou demais ou a rede falhou.',
      detalhe: e instanceof Error ? e.message : String(e),
      status: 502,
    };
  }

  if (!resp.ok) {
    const corpo = (await resp.text().catch(() => '')).slice(0, 800);
    if (resp.status === 429) {
      return {
        erro: 'Limite da camada gratuita do transcritor atingido.',
        detalhe: 'O Benjamin espera e tenta de novo sozinho. Se persistir, a cota do dia acabou.',
        status: 429,
        retryAfter: esperaSugerida(corpo) ?? 20,
      };
    }
    // Chave inválida chega como 400 no Gemini, não como 401.
    if (resp.status === 401 || resp.status === 403 || /API_KEY_INVALID|API key not valid/i.test(corpo)) {
      return { erro: 'A chave do Gemini (GEMINI_API_KEY) foi recusada.', detalhe: corpo.slice(0, 300), status: 503 };
    }
    if (resp.status === 400 || resp.status === 413 || resp.status === 415) {
      return { erro: 'O transcritor não aceitou este áudio.', detalhe: corpo.slice(0, 300), status: 422 };
    }
    // 500/503 do Gemini é fila cheia na camada gratuita: vale tentar de novo.
    return { erro: `O transcritor falhou (HTTP ${resp.status}).`, detalhe: corpo.slice(0, 300), status: 502 };
  }

  const corpo = (await resp.json()) as {
    candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
    promptFeedback?: { blockReason?: string };
  };

  if (corpo.promptFeedback?.blockReason) {
    return { erro: 'O transcritor se recusou a processar este trecho.', detalhe: corpo.promptFeedback.blockReason, status: 422 };
  }

  const candidato = corpo.candidates?.[0];
  const texto = limparSaida(
    (candidato?.content?.parts ?? [])
      .filter((p) => !p.thought)
      .map((p) => p.text ?? '')
      .join(''),
    ctx,
  );

  // Vazio com parada normal é trecho sem fala — não é erro, é silêncio.
  if (!texto && candidato?.finishReason && candidato.finishReason !== 'STOP') {
    return {
      erro: 'O transcritor não devolveu texto para este trecho.',
      detalhe: `Motivo informado: ${candidato.finishReason}.`,
      status: 422,
    };
  }

  return { texto };
}
