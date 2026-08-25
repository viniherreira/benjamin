import { NextResponse } from 'next/server';

/**
 * Adaptador de entrada por áudio.
 *
 * A decisão de arquitetura do produto é que o núcleo consome TEXTO e a captação
 * é um adaptador plugável. Esta rota é esse adaptador: recebe o arquivo, chama
 * o provedor de STT e devolve a transcrição, que segue exatamente o mesmo
 * caminho da aba "Colar texto".
 *
 * Sem OPENAI_API_KEY a rota devolve erro explícito. A regra 10.5 do produto
 * proíbe simular transcrição sem credencial: um texto inventado aqui
 * contaminaria todo o resto da demonstração com dado que ninguém falou.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Limite do plano gratuito da API de transcrição da OpenAI. */
const LIMITE_MB = 25;

const TIPOS_ACEITOS = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/m4a',
  'audio/x-m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/webm',
  'audio/ogg',
  'video/mp4',
  'video/webm',
];

export async function POST(req: Request) {
  const chave = process.env.OPENAI_API_KEY;

  if (!chave) {
    return NextResponse.json(
      {
        erro: 'Transcrição de áudio indisponível: OPENAI_API_KEY não está configurada.',
        detalhe:
          'O núcleo do InsightIQ analisa texto. A captação por áudio é um adaptador plugável e precisa de credencial de STT. Sem ela o sistema não simula uma transcrição — use a aba "Colar texto" ou configure a chave no ambiente.',
        alternativas: [
          'Colar a transcrição pronta (Meet, Zoom ou Teams exportam legenda).',
          'Gravar ao vivo pelo navegador, que usa a Web Speech API e não custa nada.',
          'Transcrever localmente com faster-whisper e colar o resultado.',
        ],
      },
      { status: 503 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ erro: 'Envie o áudio como multipart/form-data.' }, { status: 400 });
  }

  const arquivo = form.get('audio');
  if (!(arquivo instanceof File)) {
    return NextResponse.json({ erro: 'Campo "audio" ausente ou inválido.' }, { status: 422 });
  }

  const mb = arquivo.size / (1024 * 1024);
  if (mb > LIMITE_MB) {
    return NextResponse.json(
      { erro: `Arquivo de ${mb.toFixed(1)} MB excede o limite de ${LIMITE_MB} MB do provedor.` },
      { status: 413 },
    );
  }
  if (arquivo.type && !TIPOS_ACEITOS.includes(arquivo.type)) {
    return NextResponse.json(
      { erro: `Formato "${arquivo.type}" não aceito. Envie mp3, m4a, wav, webm ou ogg.` },
      { status: 415 },
    );
  }

  try {
    const envio = new FormData();
    envio.append('file', arquivo);
    envio.append('model', 'whisper-1');
    envio.append('language', 'pt');
    // Sem timestamp no texto: o motor trabalha sobre a fala, e o preparo já
    // remove marcações temporais quando elas aparecem.
    envio.append('response_format', 'text');

    const resp = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}` },
      body: envio,
    });

    if (!resp.ok) {
      const detalhe = await resp.text().catch(() => '');
      return NextResponse.json(
        { erro: `O provedor de transcrição recusou o pedido (HTTP ${resp.status}).`, detalhe },
        { status: 502 },
      );
    }

    const texto = (await resp.text()).trim();
    if (!texto) {
      return NextResponse.json(
        { erro: 'O provedor devolveu uma transcrição vazia. Verifique o áudio.' },
        { status: 422 },
      );
    }

    return NextResponse.json({
      texto,
      provedor: 'whisper-1',
      arquivo: arquivo.name,
      tamanho_mb: Number(mb.toFixed(2)),
      aviso:
        'Transcrição automática não revisada. Confira antes de analisar — o Índice de Confiabilidade do briefing indica a qualidade do texto.',
    });
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : 'Erro ao transcrever.';
    return NextResponse.json({ erro: mensagem }, { status: 500 });
  }
}
