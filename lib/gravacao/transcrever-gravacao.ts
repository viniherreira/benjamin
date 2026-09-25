import { transcreverArquivo, type TrechoTranscrito } from '../lote/transcrever';
import type { Canal } from './armazenamento';
import { extensaoDoMime, type GravacaoPronta } from './gravador';
import { mesclarCanais, transcricaoDeUmCanal, type Segmento } from './mesclar';

/**
 * Gravação de dois canais → transcrição rotulada.
 *
 * SÓ NAVEGADOR.
 */

export type ResultadoGravacao = {
  texto: string;
  canaisUsados: Canal[];
  avisos: string[];
  ecosRemovidos: number;
};

export async function transcreverGravacao(
  g: GravacaoPronta,
  o: { sinal?: AbortSignal; aoProgresso?: (feitos: number, total: number) => void; caches?: Partial<Record<Canal, Map<number, TrechoTranscrito>>> } = {},
): Promise<ResultadoGravacao> {
  const ext = extensaoDoMime(g.meta.mime);
  const progresso: Partial<Record<Canal, [number, number]>> = {};
  const informar = () => {
    const v = Object.values(progresso) as [number, number][];
    o.aoProgresso?.(v.reduce((s, [f]) => s + f, 0), v.reduce((s, [, t]) => s + t, 0));
  };

  const canais = (Object.entries(g.canais) as [Canal, Blob][]).filter(([, b]) => b.size > 0);
  if (canais.length === 0) throw new Error('A gravação ficou vazia — nenhum áudio foi capturado.');

  const avisos: string[] = [];
  const resultados = await Promise.all(
    canais.map(async ([canal, blob]): Promise<[Canal, Segmento[] | null]> => {
      try {
        const r = await transcreverArquivo(blob, `${canal}.${ext}`, {
          sinal: o.sinal,
          concorrencia: 3,
          cache: o.caches?.[canal],
          aoProgresso: (f, t) => {
            progresso[canal] = [f, t];
            informar();
          },
        });
        const desloc = g.meta.deslocamento[canal] ?? 0;
        return [canal, r.segmentos.map((s) => ({ ...s, inicio: s.inicio + desloc, fim: s.fim + desloc }))];
      } catch (e) {
        // Canal da reunião mudo não derruba a gravação inteira: o microfone ainda
        // vale. O contrário (microfone mudo) também — mas os dois mudos, sim.
        const semFala = e instanceof Error && /sem fala|não reconheceu fala|só silêncio/i.test(e.message);
        if (!semFala) throw e;
        avisos.push(
          canal === 'cliente'
            ? 'O áudio da aba da reunião veio sem fala. Confira se “Compartilhar áudio da guia” estava ligado e se a reunião não estava no mudo. A transcrição abaixo tem só o microfone, sem separação de quem falou.'
            : 'O microfone veio sem fala. A transcrição abaixo tem só o áudio da reunião.',
        );
        return [canal, null];
      }
    }),
  );

  const porCanal = Object.fromEntries(resultados) as Partial<Record<Canal, Segmento[] | null>>;
  const vendedor = porCanal.vendedor ?? null;
  const cliente = porCanal.cliente ?? null;

  if (vendedor && cliente) {
    const { texto, ecosRemovidos } = mesclarCanais({ vendedor, cliente }, { vendedor: g.meta.nomeVendedor });
    return { texto, canaisUsados: ['vendedor', 'cliente'], avisos, ecosRemovidos };
  }
  const unico = vendedor ?? cliente;
  if (!unico || unico.length === 0) throw new Error('Nenhum dos canais tem fala reconhecível.');
  if (g.meta.modo === 'presencial') {
    avisos.push('Gravação presencial tem um canal só: quem falou o quê não é separado, e talk ratio e voz do cliente ficam em branco na análise.');
  }
  return { texto: transcricaoDeUmCanal(unico), canaisUsados: vendedor ? ['vendedor'] : ['cliente'], avisos, ecosRemovidos: 0 };
}
