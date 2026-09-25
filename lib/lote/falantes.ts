/**
 * Falantes: a ponte entre o que as ferramentas exportam e o que o motor lê.
 *
 * O motor só reconhece turno quando a linha começa com "Nome: " — e só aceita
 * como nome algo capitalizado, feito de letras, com até três palavras
 * (lib/analysis/rules/segment.ts). Isso é deliberado: é o que impede "Os
 * principais pontos são:" de virar participante. Mas é também o que faz
 * "Speaker 1:", "SPEAKER_00:", "ana.torres@totvs.com:" e "Ana Paula de Souza
 * Lima:" passarem batido — e uma reunião sem turnos perde talk ratio, voz do
 * cliente e o filtro de sentimento de uma vez.
 *
 * Então o importador traduz o rótulo antes de o texto chegar ao motor, e o
 * motor continua exigente.
 */

const PARTICULAS = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'del', 'di', 'van', 'von']);

const RE_GENERICO = /^(?:speaker|falante|orador|locutor|participante|spk|interlocutor|pessoa|voz)[\s_-]*([0-9]+|[a-z])$/i;
const RE_SO_NUMERO = /^[0-9]+$/;

function capitalizar(p: string, i: number): string {
  if (i > 0 && PARTICULAS.has(p.toLowerCase())) return p.toLowerCase();
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
}

/**
 * Normaliza rótulos dentro de UM documento. Os genéricos ("Speaker 1",
 * "SPEAKER_00", 0, "A") viram "Falante A", "Falante B"… na ordem em que
 * aparecem — assim "Speaker 1" e "Speaker 2" continuam sendo dois lados
 * distintos, que é tudo o que o motor precisa para separar turnos.
 */
export function criarNormalizador() {
  const genericos = new Map<string, string>();

  return function normalizar(bruto: string | number | null | undefined): string | null {
    if (bruto === null || bruto === undefined) return null;
    let s = String(bruto).trim().replace(/^[[(<{"']+|[\])>}"':]+$/g, '').trim();
    if (!s) return null;

    const generico = RE_GENERICO.exec(s);
    if (generico || RE_SO_NUMERO.test(s) || /^[A-Z]$/.test(s)) {
      const chave = (generico?.[1] ?? s).toLowerCase();
      if (!genericos.has(chave)) {
        genericos.set(chave, `Falante ${String.fromCharCode(65 + (genericos.size % 26))}`);
      }
      return genericos.get(chave)!;
    }

    // E-mail: o nome costuma estar antes do @ — "ana.torres" → "Ana Torres".
    if (s.includes('@')) s = s.split('@')[0]!.replace(/[._]+/g, ' ');

    // Só letras, espaço, ponto e apóstrofo cabem no rótulo do motor. Hífen vira
    // espaço ("Jean-Pierre" → "Jean Pierre"); dígito e símbolo saem.
    s = s
      .replace(/[-_]+/g, ' ')
      .replace(/[^\p{L}.'’ ]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!s) return null;

    let palavras = s.split(' ');
    if (s === s.toLowerCase() || s === s.toUpperCase()) palavras = palavras.map(capitalizar);
    else palavras = palavras.map((p, i) => (i === 0 ? p.charAt(0).toUpperCase() + p.slice(1) : p));

    // Mais de três palavras o motor recusa. Primeiro e último nome preservam a
    // identidade — "Ana Paula de Souza Lima" → "Ana Lima".
    if (palavras.length > 3) {
      const nucleo = palavras.filter((p) => !PARTICULAS.has(p.toLowerCase()));
      palavras = nucleo.length >= 2 ? [nucleo[0]!, nucleo[nucleo.length - 1]!] : palavras.slice(0, 3);
    }

    const nome = palavras.join(' ').slice(0, 40).trim();
    return nome.length >= 2 ? nome : null;
  };
}

export type Fala = { falante: string | null; texto: string };

/**
 * Junta falas consecutivas do mesmo falante e devolve no formato do motor.
 * Legenda quebra uma frase em quatro cues; o motor precisa de um turno.
 */
export function montarTranscricao(falas: Fala[]): string {
  const turnos: Fala[] = [];
  for (const f of falas) {
    const texto = f.texto.replace(/\s+/g, ' ').trim();
    if (!texto) continue;
    const ultimo = turnos[turnos.length - 1];
    if (ultimo && ultimo.falante === f.falante) ultimo.texto += ` ${texto}`;
    else turnos.push({ falante: f.falante, texto });
  }
  return turnos.map((t) => (t.falante ? `${t.falante}: ${t.texto}` : t.texto)).join('\n');
}

/** Quantos rótulos distintos no formato do motor o texto já tem. */
export function contarFalantes(texto: string): number {
  const nomes = new Set<string>();
  for (const linha of texto.split('\n')) {
    const m = /^[ \t>-]*([\p{Lu}][\p{L}.'’ ]{1,40}?)\s*:[ \t]/u.exec(linha);
    if (m && m[1]!.trim().split(/\s+/).length <= 3) nomes.add(m[1]!.trim().toLowerCase());
  }
  return nomes.size;
}

const RE_TEMPO = String.raw`\(?\[?\d{1,2}:\d{2}(?::\d{2})?(?:[.,]\d{1,3})?\]?\)?`;
const RE_LINHA_SO_TEMPO = new RegExp(`^\\s*${RE_TEMPO}(?:\\s*-->\\s*${RE_TEMPO})?\\s*$`);
const RE_NOME_COM_TEMPO = new RegExp(`^\\s*(.{2,60}?)\\s+${RE_TEMPO}\\s*$`);

function pareceNomeSolto(linha: string): boolean {
  const s = linha.trim();
  if (s.length < 2 || s.length > 45) return false;
  if (/[.!?,;:]$/.test(s)) return false; // fala termina com pontuação; nome não
  if (/\d/.test(s)) return false;
  const palavras = s.split(/\s+/);
  if (palavras.length > 5) return false;
  return palavras.every(
    (p, i) => (i > 0 && PARTICULAS.has(p.toLowerCase())) || /^[\p{Lu}]/u.test(p),
  );
}

/**
 * Reorganiza os layouts de exportação em que o nome NÃO vem seguido de
 * dois-pontos — o que o Meet, o Teams e o Zoom fazem ao salvar em documento:
 *
 *   Ana Torres  0:03          Ana Torres          0:0:0.0 --> 0:0:4.2
 *   Olá, tudo bem?            00:00:03            Ana Torres
 *                             Olá, tudo bem?      Olá, tudo bem?
 *
 * Só age quando o padrão se repete (≥ 2 blocos) e o texto ainda não tem
 * rótulos no formato do motor; uma linha com cara de nome no meio de uma
 * transcrição já rotulada não é motivo para reescrever nada.
 */
export function reorganizarFalantes(texto: string): string {
  if (contarFalantes(texto) >= 2) return texto;

  const linhas = texto.split('\n');
  const normalizar = criarNormalizador();
  const falas: Fala[] = [];
  let atual: Fala | null = null;
  let blocos = 0;

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i]!.trim();
    if (!linha) continue;

    let nome: string | null = null;

    const comTempo = RE_NOME_COM_TEMPO.exec(linha);
    if (comTempo && pareceNomeSolto(comTempo[1]!)) nome = comTempo[1]!;
    else if (pareceNomeSolto(linha)) {
      // Nome sozinho conta se vier colado a uma linha de tempo (antes ou depois)
      // e for seguido de fala — é o que separa "Ana Torres" de um título.
      const antes = linhas[i - 1]?.trim() ?? '';
      const depois = linhas[i + 1]?.trim() ?? '';
      if (RE_LINHA_SO_TEMPO.test(depois) || RE_LINHA_SO_TEMPO.test(antes)) nome = linha;
    }

    if (nome) {
      blocos++;
      atual = { falante: normalizar(nome), texto: '' };
      falas.push(atual);
      continue;
    }
    if (RE_LINHA_SO_TEMPO.test(linha)) continue;

    if (atual) atual.texto += ` ${linha}`;
    else falas.push({ falante: null, texto: linha });
  }

  if (blocos < 2) return texto;
  return montarTranscricao(falas);
}
