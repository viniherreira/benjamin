/**
 * Sessão assinada — o mínimo para o produto não ficar aberto na internet.
 *
 * O Benjamin guarda transcrição de conversa comercial com cliente identificado.
 * Sem nenhuma barreira, quem souber a URL lê todo budget, todo risco de churn e
 * toda conversa da base — e ainda pode chamar /api/transcribe, que gasta a
 * chave da OpenAI do dono.
 *
 * ISTO NÃO É LOGIN DE USUÁRIO. É uma porta única, com uma senha compartilhada,
 * que existe para fechar o buraco enquanto a autenticação de verdade — usuário,
 * organização, RLS por sessão — não é construída. Ela não identifica quem
 * entrou e não isola organizações. O que ela faz é impedir acesso anônimo.
 *
 * Escrito só com Web Crypto porque o middleware do Next roda no Edge, onde
 * `node:crypto` não está disponível.
 */

const CODIFICADOR = new TextEncoder();

/** Rótulo fixo na derivação: separa esta chave de qualquer outro uso da senha. */
const CONTEXTO = 'benjamin:sessao:v1';

/**
 * A chave de assinatura deriva da própria senha. É de propósito: trocar a senha
 * invalida toda sessão emitida antes dela, que é o que se espera ao girar uma
 * credencial que vazou.
 */
async function chaveDe(segredo: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    CODIFICADOR.encode(`${CONTEXTO}:${segredo}`),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

const paraHex = (b: ArrayBuffer): string =>
  [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/**
 * Token no formato `expiracao.assinatura`.
 *
 * A expiração entra na mensagem assinada, não só no cookie: sem isso, esticar a
 * validade seria editar um número em texto puro.
 */
export async function assinarSessao(segredo: string, duracaoSegundos: number): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + duracaoSegundos;
  const chave = await chaveDe(segredo);
  const assinatura = await crypto.subtle.sign('HMAC', chave, CODIFICADOR.encode(String(exp)));
  return `${exp}.${paraHex(assinatura)}`;
}

export async function verificarSessao(token: string, segredo: string): Promise<boolean> {
  if (!segredo || !token) return false;

  const partes = token.split('.');
  if (partes.length !== 2) return false;

  const [expBruto, assinatura] = partes;
  if (!expBruto || !assinatura || !/^\d+$/.test(expBruto) || !/^[0-9a-f]+$/.test(assinatura)) {
    return false;
  }

  const chave = await chaveDe(segredo);
  const esperada = await crypto.subtle.sign('HMAC', chave, CODIFICADOR.encode(expBruto));
  if (!iguaisEmTempoConstante(assinatura, paraHex(esperada))) return false;

  // Só depois de a assinatura conferir é que a validade significa alguma coisa.
  return Number(expBruto) > Math.floor(Date.now() / 1000);
}

/**
 * Comparação sem vazar por tempo.
 *
 * `a === b` no JavaScript sai no primeiro caractere diferente, e a diferença de
 * tempo entre "errou no primeiro" e "errou no último" é mensurável em rede.
 */
function iguaisEmTempoConstante(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

/**
 * A senha digitada confere com a configurada?
 *
 * Segredo ausente devolve `false` para tudo. O caso real é o deploy que sobe
 * sem a variável: ali a resposta certa é negar, nunca abrir.
 */
export function senhaConfere(digitada: string, configurada: string | undefined): boolean {
  if (!configurada) return false;
  return iguaisEmTempoConstante(digitada, configurada);
}

/** Nome do cookie. Um só lugar define, para o middleware e a rota concordarem. */
export const COOKIE_SESSAO = 'benjamin_sessao';

/** Oito horas: um dia de trabalho, sem obrigar a reentrar no meio da tarde. */
export const DURACAO_SESSAO = 8 * 60 * 60;
