import type { SinalConfianca } from '../types';
import type { Preparado } from './segment';
import { SINAIS_CONFIANCA, SINAIS_DESCONFIANCA } from './lexicons';
import { casar, evidenciaEm, limitar } from './util';

/**
 * Índice de Confiança — resposta direta à provocação A da TOTVS:
 * "o cliente considera o vendedor uma pessoa de confiança?".
 *
 * O sinal mais forte é o do próprio exemplo canônico: o cliente compartilha um
 * valor e pede que o vendedor não o revele ao CFO. Isso é cumplicidade, e
 * cumplicidade é rapport alto.
 */

export type ResultadoConfianca = {
  trust_score: number;
  trust_signals: SinalConfianca[];
};

export function analisarConfianca(prep: Preparado): ResultadoConfianca {
  const sinais: SinalConfianca[] = [];
  const vistos = new Set<string>();

  const coletar = (lista: { padrao: string; delta: number; rotulo: string }[]) => {
    for (const s of lista) {
      const cs = casar(prep, s.padrao);
      const c = cs[0];
      if (!c) continue;
      if (vistos.has(s.rotulo)) continue;
      vistos.add(s.rotulo);
      sinais.push({
        label: s.rotulo,
        delta: s.delta,
        evidence: evidenciaEm(prep, c.inicio, c.fim),
      });
    }
  };

  coletar(SINAIS_CONFIANCA);
  coletar(SINAIS_DESCONFIANCA);

  // Cliente que quase não fala é sinal fraco de confiança — mas só dá para
  // afirmar isso quando existe diarização.
  if (prep.temDiarizacao) {
    const cliente = prep.falantes.filter((f) => f.lado === 'cliente');
    const total = prep.falantes.reduce((s, f) => s + f.palavras, 0);
    const palavrasCliente = cliente.reduce((s, f) => s + f.palavras, 0);

    if (total > 0 && palavrasCliente / total < 0.2 && prep.sentencas.length > 0) {
      const primeira = prep.sentencas[0];
      if (primeira) {
        sinais.push({
          label: 'Cliente falou muito pouco na reunião',
          delta: -10,
          evidence: evidenciaEm(prep, primeira.inicio, primeira.fim),
        });
      }
    }
  }

  const soma = sinais.reduce((s, x) => s + x.delta, 0);

  return {
    trust_score: Math.round(limitar(50 + soma, 0, 100)),
    trust_signals: sinais,
  };
}
