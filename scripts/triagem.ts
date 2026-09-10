/**
 * Triagem do corpus real para anotação humana.
 *
 * O problema que este script resolve: temos 1.174 reuniões reais e nenhum
 * gabarito. Anotar tudo à mão é inviável, e sem gabarito toda métrica sobre
 * dado real é chute.
 *
 * A saída NÃO é gabarito. É uma FILA DE REVISÃO: o modelo lê cada reunião e
 * diz se enxerga risco de churn; o humano confirma ou corrige, e só então
 * aquilo vira anotação. A regra do projeto continua valendo — a IA propõe com
 * a evidência, o humano decide.
 *
 * Duas decisões de amostragem, ambas para não enganar a métrica:
 *
 *  - Só entram reuniões de CLIENTE (TP_RECURSO = customer). Lead não pode dar
 *    churn: quem não é cliente não tem o que cancelar. Triar lead misturado
 *    inflaria a base de "risco baixo" com casos em que baixo é trivial.
 *
 *  - O que o modelo classificar como BAIXO também precisa ir para revisão por
 *    amostragem. Sem isso mediríamos só onde o modelo achou algo, e o falso
 *    negativo — o erro caro num produto de retenção — ficaria invisível.
 *
 * Uso:
 *   npx tsx scripts/triagem.ts <caminho-do-jsonl> [--limite N] [--saida arq]
 *
 * Retoma de onde parou: se o arquivo de saída existir, as reuniões já triadas
 * são puladas. A camada gratuita falha e o processo é longo.
 */
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

type Registro = {
  ID_MEETING: string;
  CODT: string;
  DT_MEETING: string;
  TP_RECURSO?: string | null;
  NOTA_NPS?: string | number | null;
  NOME_SEGMENTO?: string | null;
  NOME_UNIDADE?: string | null;
  ANON_TRANSCRICAO?: string;
};

type Veredito = {
  id: string;
  codt: string;
  data: string;
  segmento: string | null;
  /** Contexto declarado, NUNCA usado como verdade: a pesquisa é de outra época. */
  nps: number | null;
  chars: number;
  risco: 'baixo' | 'medio' | 'alto';
  confianca: number;
  justificativa: string;
  citacao: string;
  /** A citação foi encontrada literalmente na transcrição? */
  ancorada: boolean;
  /** Qual modelo julgou. Rodadas de modelos diferentes não se misturam. */
  modelo: string;
  latencia_ms: number;
  tokens_entrada: number;
};

type Resposta = { risco: string; confianca: number; justificativa: string; citacao: string };

/*
 * O modelo é configurável porque a cota gratuita é POR MODELO.
 *
 * Descoberto do jeito difícil: com o gemini-3.6-flash esgotado (limite 20), a
 * mesma chave respondia normalmente em gemini-flash-lite-latest. Fixar o modelo
 * no código transformaria "acabou a cota daquele modelo" em "acabou o dia".
 *
 * A troca não é de graça: modelo menor julga pior, e por isso a triagem grava o
 * modelo usado em cada veredito. Comparar duas rodadas de modelos diferentes sem
 * saber qual foi qual seria misturar medições.
 */
const MODELO = process.env.TRIAGEM_MODELO ?? 'gemini-flash-lite-latest';
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

const SISTEMA = `Você avalia transcrições de reuniões comerciais da TOTVS em português do Brasil.

A transcrição vem de reconhecimento automático de fala: tem erro, frase picada, e nomes trocados por [PESSOA], [EMPRESA] e [LOCAL]. Isso é normal — trabalhe com o que há.

Responda só o risco de o cliente deixar de ser cliente (churn) e a evidência.

- risco: "baixo", "medio" ou "alto"
- confianca: 0 a 1
- justificativa: uma frase, direta
- citacao: trecho COPIADO LITERALMENTE da transcrição, caractere por caractere, que sustente o risco. Se não houver trecho literal que sustente, devolva string vazia — não parafraseie.

Reunião de prospecção, de expansão ou de projeto recém-aprovado é risco BAIXO. Ausência de reclamação é risco baixo, e dizer isso é a resposta certa. Não force achado.`;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    risco: { type: 'STRING' },
    confianca: { type: 'NUMBER' },
    justificativa: { type: 'STRING' },
    citacao: { type: 'STRING' },
  },
  required: ['risco', 'confianca', 'justificativa', 'citacao'],
} as const;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/*
 * Cinco tentativas com espera crescente.
 *
 * Medido num lote de 12: com três tentativas e espera curta, 4 falharam com
 * 503 — um terço do corpus perdido. E uma chamada que levou 78 segundos
 * terminou bem, o que diz que o problema é fila do provedor gratuito, não
 * tamanho da entrada. Contra fila, a resposta é paciência, não desistência.
 */
const TENTATIVAS = 5;

/*
 * Ritmo.
 *
 * A camada gratuita permite 20 requisições por minuto. Na primeira rodada
 * completa eu ignorei isso: as retentativas dispararam em rajada, queimaram a
 * própria cota e o processo passou 26 minutos levando 429 sem gravar UMA
 * resposta. O erro não foi o limite do provedor, foi meu.
 *
 * Uma chamada a cada 3,5 s deixa a margem confortável. E quando o 429 vem, a
 * própria resposta diz quanto esperar ("Please retry in 5.09s") — obedecer ao
 * número que o servidor mandou é mais barato que chutar 30 segundos.
 */
const INTERVALO_MS = 3500;
let ultimaChamada = 0;

async function respeitarRitmo() {
  const desde = Date.now() - ultimaChamada;
  if (ultimaChamada > 0 && desde < INTERVALO_MS) await dormir(INTERVALO_MS - desde);
  ultimaChamada = Date.now();
}

/** Extrai o "retry in 5.09s" que a própria API devolve no corpo do 429. */
function esperaSugerida(corpo: string): number | null {
  const m = /retry in ([\d.]+)s/i.exec(corpo);
  if (!m?.[1]) return null;
  const s = Number(m[1]);
  return Number.isFinite(s) ? Math.ceil(s * 1000) + 500 : null;
}

async function avaliar(
  texto: string,
  chave: string,
): Promise<{ dados: Resposta; tokens: number } | { erro: string }> {
  // 429 não consome tentativa — é fila, não falha. Mas precisa de teto, senão
  // uma cota diária esgotada deixaria o processo girando para sempre.
  let esperas429 = 0;
  const MAX_429 = 10;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    const ultima = tentativa === TENTATIVAS;
    let resp: Response;

    await respeitarRitmo();

    try {
      resp = await fetch(`${BASE}/${MODELO}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': chave, 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SISTEMA }] },
          contents: [{ role: 'user', parts: [{ text: texto.slice(0, 200000) }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
            temperature: 0.1,
            thinkingConfig: { thinkingLevel: 'low' },
          },
        }),
      });
    } catch (e) {
      if (ultima) return { erro: `rede: ${e instanceof Error ? e.message : String(e)}` };
      await dormir(4000 * tentativa * tentativa);
      continue;
    }

    if (resp.status === 429) {
      esperas429++;
      if (esperas429 > MAX_429) return { erro: 'cota esgotada (429 persistente)' };
      // O corpo diz quanto esperar; obedecer ao servidor é melhor que chutar.
      const corpo = await resp.text().catch(() => '');
      await dormir(esperaSugerida(corpo) ?? 15000);
      tentativa--;
      continue;
    }
    if (!resp.ok) {
      if (ultima) return { erro: `HTTP ${resp.status}` };
      await dormir(4000 * tentativa * tentativa);
      continue;
    }

    const corpo = (await resp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      usageMetadata?: { promptTokenCount?: number };
    };
    const txt = corpo.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!txt) {
      if (ultima) return { erro: 'resposta sem texto' };
      await dormir(2000 * tentativa);
      continue;
    }

    try {
      return { dados: JSON.parse(txt) as Resposta, tokens: corpo.usageMetadata?.promptTokenCount ?? 0 };
    } catch {
      if (ultima) return { erro: 'resposta não é JSON' };
      await dormir(2000 * tentativa);
    }
  }
  return { erro: 'esgotou as tentativas' };
}

/** A citação existe mesmo no texto? Tolera diferença de espaço em branco. */
function ancorar(texto: string, citacao: string): boolean {
  const alvo = citacao.trim();
  if (alvo.length < 12) return false;
  if (texto.includes(alvo)) return true;
  const escapado = alvo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').split(/\s+/).join('\\s+');
  try {
    return new RegExp(escapado, 'u').test(texto);
  } catch {
    return false;
  }
}

async function principal() {
  const args = process.argv.slice(2);
  const caminho = args.find((a) => !a.startsWith('--'));
  if (!caminho) {
    console.error('uso: npx tsx scripts/triagem.ts <caminho-do-jsonl> [--limite N] [--saida arq]');
    process.exit(1);
  }
  const limite = Number(args[args.indexOf('--limite') + 1]) || Infinity;
  const saida = args.includes('--saida') ? (args[args.indexOf('--saida') + 1] as string) : 'triagem.json';

  const chave = process.env.GEMINI_API_KEY;
  if (!chave) {
    console.error('GEMINI_API_KEY não está no ambiente. A triagem depende do modelo.');
    process.exit(1);
  }

  const jaFeitos: Veredito[] = existsSync(saida)
    ? (JSON.parse(readFileSync(saida, 'utf8')) as Veredito[])
    : [];
  const vistos = new Set(jaFeitos.map((v) => v.id));
  if (jaFeitos.length > 0) console.log(`retomando: ${jaFeitos.length} reuniões já triadas`);

  const fila: Registro[] = [];
  const rl = createInterface({ input: createReadStream(caminho, 'utf8'), crlfDelay: Infinity });
  for await (const linha of rl) {
    const t = linha.trim().replace(/,$/, '');
    if (!t) continue;
    let o: Registro;
    try {
      o = JSON.parse(t) as Registro;
    } catch {
      continue;
    }
    if (o.TP_RECURSO !== 'customer') continue;
    if (vistos.has(o.ID_MEETING)) continue;
    if ((o.ANON_TRANSCRICAO ?? '').length < 2000) continue;
    fila.push(o);
  }

  const total = Math.min(fila.length, limite);
  console.log(`modelo: ${MODELO}`);
  console.log(`fila: ${fila.length} reuniões de cliente · triando ${total}`);

  const resultados = [...jaFeitos];
  let falhas = 0;
  const t0 = performance.now();

  for (const [i, r] of fila.slice(0, limite).entries()) {
    const texto = r.ANON_TRANSCRICAO ?? '';
    const marca = performance.now();
    const res = await avaliar(texto, chave);

    if ('erro' in res) {
      falhas++;
      console.log(`  ${i + 1}/${total} ${r.ID_MEETING} FALHOU: ${res.erro}`);
      continue;
    }

    const d = res.dados;
    const risco = (['baixo', 'medio', 'alto'].includes(d.risco) ? d.risco : 'baixo') as Veredito['risco'];

    const v: Veredito = {
      id: r.ID_MEETING,
      codt: r.CODT,
      data: r.DT_MEETING,
      segmento: r.NOME_SEGMENTO ?? null,
      nps:
        r.NOTA_NPS === null || r.NOTA_NPS === '' || r.NOTA_NPS === undefined ? null : Number(r.NOTA_NPS),
      chars: texto.length,
      risco,
      confianca: Number(d.confianca) || 0,
      justificativa: d.justificativa ?? '',
      citacao: d.citacao ?? '',
      ancorada: ancorar(texto, d.citacao ?? ''),
      modelo: MODELO,
      latencia_ms: Math.round(performance.now() - marca),
      tokens_entrada: res.tokens,
    };
    resultados.push(v);

    const sinal = risco === 'baixo' ? '  ' : risco === 'medio' ? ' !' : '!!';
    console.log(
      `  ${i + 1}/${total} ${r.ID_MEETING} ${sinal} ${risco.padEnd(5)}` +
        ` conf=${v.confianca.toFixed(2)} ancorada=${v.ancorada ? 'sim' : 'nao'} ${v.latencia_ms}ms`,
    );

    // Grava a cada resposta: processo longo em cota gratuita não pode perder
    // trabalho por uma queda no meio.
    writeFileSync(saida, JSON.stringify(resultados, null, 2));
  }

  const novos = resultados.length - jaFeitos.length;
  const cont = { baixo: 0, medio: 0, alto: 0 };
  for (const v of resultados) cont[v.risco]++;
  const ancoradas = resultados.filter((v) => v.ancorada).length;

  console.log('\n─── triagem ───');
  console.log(`triadas agora: ${novos} · total no arquivo: ${resultados.length} · falhas: ${falhas}`);
  console.log(`risco: baixo ${cont.baixo} · médio ${cont.medio} · alto ${cont.alto}`);
  console.log(`citação ancorada no texto: ${ancoradas}/${resultados.length}`);
  console.log(`tempo: ${((performance.now() - t0) / 60000).toFixed(1)} min`);
  console.log(`\nsaída: ${saida}`);
  console.log('Isto é fila de revisão, não gabarito. Nada vira anotação sem um humano confirmar.');
}

void principal();
