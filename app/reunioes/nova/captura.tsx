'use client';

import { useState } from 'react';
import { AudioLines, Check, Loader2, TriangleAlert, Upload } from 'lucide-react';
import { transcreverArquivo } from '@/lib/lote/transcrever';

/**
 * Adaptadores de entrada.
 *
 * A decisão de arquitetura do produto: o núcleo consome TEXTO, e a captação é
 * plugável. Estes componentes (este e a gravação, em gravacao.tsx) só produzem o texto — ele cai no mesmo campo
 * da aba "Colar texto" e segue exatamente o mesmo caminho de análise. É por isso
 * que dá para dizer, sem asterisco, que o Benjamin é agnóstico à origem.
 */

/* ------------------------------------------------------------------ *
 * Upload de áudio
 * ------------------------------------------------------------------ */

export function CapturaPorAudio({ onTexto }: { onTexto: (t: string) => void }) {
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<{ titulo: string; detalhe?: string; alternativas?: string[] } | null>(
    null,
  );
  const [ok, setOk] = useState<string | null>(null);
  const [progresso, setProgresso] = useState<string | null>(null);

  async function enviar(arquivo: File) {
    setEnviando(true);
    setErro(null);
    setOk(null);
    setProgresso(null);

    try {
      // Pergunta antes de decodificar uma hora de áudio para descobrir, no fim,
      // que não há chave de transcrição.
      const estado = (await fetch('/api/transcribe').then((r) => r.json()).catch(() => null)) as {
        disponivel?: boolean;
        erro?: string;
        detalhe?: string;
        alternativas?: string[];
      } | null;
      if (estado && !estado.disponivel) {
        setErro({
          titulo: estado.erro ?? 'Transcrição indisponível.',
          ...(estado.detalhe ? { detalhe: estado.detalhe } : {}),
          ...(estado.alternativas ? { alternativas: estado.alternativas } : {}),
        });
        setEnviando(false);
        return;
      }

      setProgresso('Preparando o áudio…');
      const r = await transcreverArquivo(arquivo, arquivo.name, {
        aoProgresso: (feitos, total) =>
          setProgresso(total > 1 ? `Transcrevendo trecho ${Math.min(feitos + 1, total)} de ${total}…` : 'Transcrevendo…'),
      });
      onTexto(r.texto);
      const minutos = r.duracaoSegundos ? ` (${Math.round(r.duracaoSegundos / 60)} min, ${r.trechos} trechos)` : '';
      setOk(`${arquivo.name} transcrito${minutos}. Revise o texto na aba “Colar texto” antes de analisar.`);
    } catch (e) {
      setErro({ titulo: e instanceof Error ? e.message : 'Não foi possível transcrever o áudio.' });
    }
    setProgresso(null);
    setEnviando(false);
  }

  return (
    <div className="space-y-3">
      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed px-6 py-8 text-center transition-colors ${
          enviando ? 'border-line bg-surface-2' : 'border-line hover:border-accent/50 hover:bg-surface-2'
        }`}
      >
        <input
          type="file"
          accept="audio/*,video/mp4,video/webm"
          className="sr-only"
          disabled={enviando}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void enviar(f);
            e.target.value = '';
          }}
        />
        <span className="mb-2 flex size-10 items-center justify-center rounded-lg border border-line bg-surface text-ink-dim">
          {enviando ? <Loader2 size={17} className="animate-spin" /> : <Upload size={17} />}
        </span>
        <span className="text-[12.5px] font-medium text-ink">
          {enviando ? (progresso ?? 'Transcrevendo…') : 'Escolher arquivo de áudio'}
        </span>
        <span className="mt-1 text-[11.5px] text-ink-faint">
          mp3, m4a, wav, ogg, webm, mp4 ou mov · qualquer duração (áudio longo é cortado em trechos)
        </span>
      </label>

      <SemRotuloDeFalante />

      {ok ? (
        <p className="inline-flex items-center gap-1.5 rounded-md border border-health/30 bg-health-soft/25 px-3 py-2 text-[12px] text-health">
          <Check size={13} />
          {ok}
        </p>
      ) : null}

      {erro ? (
        <div className="rounded-md border border-risk/30 bg-risk-soft/20 px-3 py-2.5">
          <p className="flex items-start gap-1.5 text-[12px] font-medium text-risk">
            <TriangleAlert size={13} className="mt-0.5 shrink-0" />
            {erro.titulo}
          </p>
          {erro.detalhe ? (
            <p className="mt-1 text-[11.5px] leading-relaxed text-ink-dim">{erro.detalhe}</p>
          ) : null}
          {erro.alternativas ? (
            <ul className="mt-1.5 space-y-0.5">
              {erro.alternativas.map((a) => (
                <li key={a} className="flex gap-1.5 text-[11.5px] leading-relaxed text-ink-dim">
                  <span className="mt-[6px] size-1 shrink-0 rounded-full bg-ink-faint" />
                  {a}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-ink-faint">
        <AudioLines size={12} className="mt-0.5 shrink-0" />O áudio é enviado ao provedor de
        transcrição e não fica armazenado. Sem credencial de STT configurada, o sistema mostra o erro
        real em vez de simular uma transcrição — texto inventado aqui contaminaria todo o resto da
        análise.
      </p>
    </div>
  );
}

/* ------------------------------------------------------------------ */

/**
 * O que a transcrição automática custa, dito antes e não depois.
 *
 * Nem o Whisper nem a Web Speech API separam quem falou: os dois devolvem um
 * bloco de texto corrido. Metade do briefing depende de saber de quem é cada
 * frase, e sem isso o motor se abstém em vez de chutar.
 *
 * Os números abaixo foram medidos sobre as 37 amostras do corpus, removendo os
 * rótulos de falante e comparando as duas análises — não são estimativa.
 */
function SemRotuloDeFalante() {
  return (
    <div className="rounded-md border border-warn/30 bg-warn-soft/30 px-3 py-2.5">
      <p className="flex items-start gap-1.5 text-[12px] font-medium text-ink">
        <TriangleAlert size={13} className="mt-0.5 shrink-0 text-warn" />
        A transcrição automática não separa quem falou
      </p>
      <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-dim">
        Continuam saindo iguais: produtos, concorrentes, budget, objeções e tarefas.{' '}
        <strong className="font-medium text-ink">Ficam indisponíveis</strong> o talk ratio e as
        métricas de conversa, o interesse e o risco de churn — sem saber de quem é a fala, o motor
        não tem como atribuir os sinais, e prefere não responder a responder errado. As dores ainda
        aparecem, mas sem a garantia de que foi o cliente quem as disse.
      </p>
      <p className="mt-2 text-[11.5px] leading-relaxed text-ink-dim">
        Para recuperar tudo isso, prefixe cada fala com o nome de quem fala no texto transcrito —{' '}
        <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[10.5px]">Ana:</code> e{' '}
        <code className="rounded bg-surface-3 px-1 py-0.5 font-mono text-[10.5px]">João:</code> —
        antes de analisar. É o que Meet, Teams e Zoom já entregam quando a legenda é exportada por
        lá.
      </p>
    </div>
  );
}
