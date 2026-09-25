'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AudioLines, Check, Download, Loader2, Mic, MonitorSpeaker, RotateCcw, Square, Trash2, TriangleAlert, Users } from 'lucide-react';
import {
  apagarGravacao,
  armazenamentoDisponivel,
  atualizarMeta,
  limparAntigas,
  listarGravacoes,
  montarCanais,
  type Canal,
  type MetaGravacao,
} from '@/lib/gravacao/armazenamento';
import {
  ErroCaptura,
  extensaoDoMime,
  iniciarGravacao,
  suportaModoOnline,
  type GravacaoPronta,
  type Gravador,
  type Modo,
} from '@/lib/gravacao/gravador';
import { transcreverGravacao, type ResultadoGravacao } from '@/lib/gravacao/transcrever-gravacao';

/**
 * Gravar a reunião — microfone e som da aba em canais separados.
 *
 * Substitui a captura por Web Speech, que ouvia só o microfone (numa call, o
 * cancelamento de eco apaga a voz do cliente), parava sozinha no meio de
 * reunião longa e não guardava o áudio. Aqui o áudio é gravado, salvo neste
 * navegador pedaço a pedaço e transcrito ao final, com cada canal rotulado.
 */

type Fase = 'preparo' | 'gravando' | 'transcrevendo' | 'pronto';

const CHAVE_NOME = 'benjamin-nome-vendedor';
/** Abaixo disto no medidor é silêncio (a escala é comprimida; fala fica acima de 0,5). */
const LIMIAR_SOM = 0.35;
const ALERTA_MUDO_S = 45;

const BOTAO =
  'inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink transition-colors hover:border-line-strong disabled:opacity-50';
const CAMPO =
  'w-full rounded-md border border-line bg-surface-2 px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none';

function relogio(s: number): string {
  const t = Math.max(0, Math.floor(s));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const seg = t % 60;
  return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${String(seg).padStart(2, '0')}`;
}

function baixarAudio(meta: MetaGravacao, canal: Canal, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reuniao-${new Date(meta.criadaEm).toISOString().slice(0, 10)}-${canal}.${extensaoDoMime(meta.mime)}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function GravacaoReuniao({ onTexto }: { onTexto: (t: string) => void }) {
  const [fase, setFase] = useState<Fase>('preparo');
  const [consentiu, setConsentiu] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);
  const [modo, setModo] = useState<Modo>('online');
  const [nome, setNome] = useState('');
  const [persistir, setPersistir] = useState(true);
  const [transcricao, setTranscricao] = useState<{ disponivel: boolean; erro?: string } | null>(null);
  const [pendentes, setPendentes] = useState<MetaGravacao[]>([]);

  const [erro, setErro] = useState<{ titulo: string; instrucao?: string } | null>(null);
  const [avisosAoVivo, setAvisosAoVivo] = useState<string[]>([]);
  const [niveis, setNiveis] = useState<Partial<Record<Canal, number>>>({});
  const [segundos, setSegundos] = useState(0);
  const [mudo, setMudo] = useState<Partial<Record<Canal, boolean>>>({});
  const [progresso, setProgresso] = useState<[number, number]>([0, 0]);
  const [resultado, setResultado] = useState<ResultadoGravacao | null>(null);
  const [ultima, setUltima] = useState<GravacaoPronta | null>(null);

  const gravador = useRef<Gravador | null>(null);
  const ultimoSom = useRef<Partial<Record<Canal, number>>>({});

  const recarregarPendentes = useCallback(async () => {
    try {
      setPendentes((await listarGravacoes()).filter((m) => !m.transcrita));
    } catch {
      setPendentes([]);
    }
  }, []);

  useEffect(() => {
    const suporta = suportaModoOnline();
    setOnline(suporta);
    if (!suporta) setModo('presencial');
    try {
      setNome(localStorage.getItem(CHAVE_NOME) ?? '');
    } catch {
      /* sem localStorage: o nome só não fica lembrado */
    }
    void armazenamentoDisponivel().then(async (ok) => {
      setPersistir(ok);
      if (ok) {
        await limparAntigas().catch(() => {});
        await recarregarPendentes();
      }
    });
    void fetch('/api/transcribe')
      .then((r) => (r.ok ? r.json() : { disponivel: false, erro: `HTTP ${r.status}` }))
      .then(setTranscricao)
      .catch(() => setTranscricao({ disponivel: false, erro: 'Não foi possível consultar a transcrição.' }));
    return () => gravador.current?.descartar();
  }, [recarregarPendentes]);

  // Medidores e detecção de canal mudo enquanto grava.
  useEffect(() => {
    if (fase !== 'gravando') return;
    const t = setInterval(() => {
      const g = gravador.current;
      if (!g) return;
      const n = g.niveis();
      const s = g.segundos();
      const agora = performance.now() / 1000;
      const novoMudo: Partial<Record<Canal, boolean>> = {};
      for (const [canal, v] of Object.entries(n) as [Canal, number][]) {
        if (v > LIMIAR_SOM || ultimoSom.current[canal] === undefined) ultimoSom.current[canal] = agora;
        novoMudo[canal] = s > ALERTA_MUDO_S && agora - ultimoSom.current[canal]! > ALERTA_MUDO_S;
      }
      setNiveis(n);
      setSegundos(s);
      setMudo(novoMudo);
    }, 100);
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => {
      clearInterval(t);
      window.removeEventListener('beforeunload', avisar);
    };
  }, [fase]);

  async function comecar() {
    setErro(null);
    setAvisosAoVivo([]);
    setResultado(null);
    ultimoSom.current = {};
    try {
      localStorage.setItem(CHAVE_NOME, nome.trim());
    } catch {
      /* idem */
    }
    try {
      gravador.current = await iniciarGravacao({
        modo,
        nomeVendedor: nome.trim(),
        persistir,
        aoEvento: (e) => {
          const msg =
            e.tipo === 'aba-encerrada'
              ? 'O compartilhamento da aba foi encerrado: o som da reunião parou de ser gravado. O microfone continua.'
              : e.tipo === 'microfone-encerrado'
                ? 'O microfone foi desconectado: sua voz parou de ser gravada.'
                : `Não foi possível salvar a gravação neste navegador (${e.mensagem}). Ela continua em memória — não feche esta aba até terminar.`;
          setAvisosAoVivo((a) => (a.includes(msg) ? a : [...a, msg]));
        },
      });
      setFase('gravando');
    } catch (e) {
      setErro(
        e instanceof ErroCaptura
          ? { titulo: e.message, ...(e.instrucao ? { instrucao: e.instrucao } : {}) }
          : { titulo: e instanceof Error ? e.message : 'Não foi possível começar a gravar.' },
      );
    }
  }

  async function transcrever(g: GravacaoPronta) {
    setUltima(g);
    if (!transcricao?.disponivel) {
      setErro({
        titulo: 'A gravação foi salva, mas não há transcrição configurada.',
        instrucao: `${transcricao?.erro ?? 'OPENAI_API_KEY não está configurada.'} Baixe o áudio agora ou volte a esta aba depois que a chave estiver no ambiente: a gravação fica guardada neste navegador.`,
      });
      setFase('preparo');
      await recarregarPendentes();
      return;
    }
    setFase('transcrevendo');
    setProgresso([0, 0]);
    try {
      const r = await transcreverGravacao(g, { aoProgresso: (f, t) => setProgresso([f, t]) });
      onTexto(r.texto);
      setResultado(r);
      setFase('pronto');
      await atualizarMeta(g.meta.id, { transcrita: true }).catch(() => {});
    } catch (e) {
      setErro({
        titulo: e instanceof Error ? e.message : 'Não foi possível transcrever a gravação.',
        instrucao: 'A gravação continua salva neste navegador — dá para tentar de novo sem gravar outra vez.',
      });
      setFase('preparo');
    }
    await recarregarPendentes();
  }

  async function parar() {
    const g = gravador.current;
    if (!g) return;
    gravador.current = null;
    await transcrever(await g.parar());
  }

  async function recuperar(meta: MetaGravacao) {
    setErro(null);
    try {
      const canais = await montarCanais(meta);
      await transcrever({ meta, canais });
    } catch (e) {
      setErro({ titulo: `Não foi possível abrir a gravação salva: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  async function baixarSalva(meta: MetaGravacao) {
    const canais = await montarCanais(meta);
    for (const [canal, blob] of Object.entries(canais) as [Canal, Blob][]) baixarAudio(meta, canal, blob);
  }

  if (online === null) return null;

  /* ---------------- gravando ---------------- */
  if (fase === 'gravando') {
    const canais: Canal[] = modo === 'online' ? ['vendedor', 'cliente'] : ['vendedor'];
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-2 font-mono text-[22px] tabular-nums text-ink">
            <span className="size-2.5 animate-pulse rounded-full bg-risk" aria-hidden />
            {relogio(segundos)}
          </span>
          <button
            type="button"
            onClick={() => void parar()}
            className="inline-flex items-center gap-1.5 rounded-md bg-risk px-4 py-2 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
          >
            <Square size={13} />
            Parar e transcrever
          </button>
          <button
            type="button"
            className={BOTAO}
            onClick={() => {
              gravador.current?.descartar();
              if (gravador.current) void apagarGravacao(gravador.current.id).catch(() => {});
              gravador.current = null;
              setFase('preparo');
            }}
          >
            <Trash2 size={13} />
            Descartar
          </button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {canais.map((c) => (
            <Medidor
              key={c}
              rotulo={c === 'vendedor' ? `Você${nome.trim() ? ` (${nome.trim()})` : ''} — microfone` : 'Reunião — som da aba'}
              nivel={niveis[c] ?? 0}
              mudo={Boolean(mudo[c])}
            />
          ))}
        </div>

        {mudo.cliente ? (
          <Alerta>
            Não chega som da aba da reunião há mais de {ALERTA_MUDO_S} s. Se o cliente está falando, o áudio da aba não está sendo capturado —
            pare, e grave de novo escolhendo a aba da reunião com “Compartilhar áudio da guia” ligado.
          </Alerta>
        ) : null}
        {mudo.vendedor ? <Alerta>Seu microfone não capta som há mais de {ALERTA_MUDO_S} s. Confira se ele não está no mudo.</Alerta> : null}
        {avisosAoVivo.map((a) => (
          <Alerta key={a}>{a}</Alerta>
        ))}

        <p className="text-[11.5px] leading-relaxed text-ink-faint">
          {persistir
            ? 'A gravação é salva neste navegador a cada 5 segundos. Se a aba fechar ou o computador travar, ela aparece aqui para ser transcrita na próxima vez.'
            : 'Este navegador não permite salvar a gravação no disco: ela fica só em memória. Não feche esta aba até terminar.'}
        </p>
      </div>
    );
  }

  /* ---------------- transcrevendo ---------------- */
  if (fase === 'transcrevendo') {
    const [f, t] = progresso;
    return (
      <div className="py-6 text-center">
        <Loader2 size={20} className="mx-auto animate-spin text-ink-faint" />
        <p className="mt-3 text-[13px] font-medium text-ink">{t ? `Transcrevendo trecho ${Math.min(f + 1, t)} de ${t}…` : 'Preparando o áudio…'}</p>
        <div className="mx-auto mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-surface-3">
          <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${t ? (f / t) * 100 : 5}%` }} />
        </div>
        <p className="mt-2 text-[11.5px] text-ink-faint">Cada canal é transcrito separadamente e depois intercalado pela linha do tempo.</p>
      </div>
    );
  }

  /* ---------------- preparo / pronto ---------------- */
  return (
    <div className="space-y-4">
      {fase === 'pronto' && resultado && ultima ? (
        <div className="space-y-2 rounded-md border border-health/30 bg-health-soft/25 px-4 py-3">
          <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-health">
            <Check size={14} />
            Reunião transcrita{resultado.canaisUsados.length === 2 ? ' com quem falou o quê separado' : ''}.
          </p>
          <p className="text-[12px] leading-relaxed text-ink-dim">
            O texto está na aba “Colar texto” para revisão antes de analisar.
            {resultado.ecosRemovidos ? ` ${resultado.ecosRemovidos} trecho(s) de eco do alto-falante foram removidos da sua fala.` : ''}
          </p>
          {resultado.avisos.map((a) => (
            <p key={a} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-warn">
              <TriangleAlert size={13} className="mt-0.5 shrink-0" />
              {a}
            </p>
          ))}
          <div className="flex flex-wrap gap-2 pt-1">
            {(Object.entries(ultima.canais) as [Canal, Blob][]).map(([canal, blob]) => (
              <button key={canal} type="button" className={BOTAO} onClick={() => baixarAudio(ultima.meta, canal, blob)}>
                <Download size={13} />
                Baixar áudio — {canal === 'vendedor' ? 'microfone' : 'reunião'}
              </button>
            ))}
            <button type="button" className={BOTAO} onClick={() => setFase('preparo')}>
              <Mic size={13} />
              Gravar outra
            </button>
          </div>
        </div>
      ) : null}

      {erro ? (
        <div className="rounded-md border border-risk/30 bg-risk-soft/25 px-4 py-3">
          <p className="flex items-start gap-1.5 text-[12.5px] font-medium text-risk">
            <TriangleAlert size={14} className="mt-0.5 shrink-0" />
            {erro.titulo}
          </p>
          {erro.instrucao ? <p className="mt-1.5 pl-5 text-[12px] leading-relaxed text-ink-dim">{erro.instrucao}</p> : null}
        </div>
      ) : null}

      {pendentes.length ? (
        <div className="rounded-md border border-line bg-surface-2 px-4 py-3">
          <p className="text-[12px] font-semibold text-ink">Gravações salvas neste navegador, ainda não transcritas</p>
          <ul className="mt-2 divide-y divide-line">
            {pendentes.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="text-[12px] text-ink-dim">
                  {new Date(m.criadaEm).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  {' · '}
                  {m.duracaoSegundos ? relogio(m.duracaoSegundos) : 'interrompida'}
                  {' · '}
                  {m.canais.length === 2 ? 'dois canais' : 'microfone'}
                </span>
                <span className="flex flex-wrap gap-1.5">
                  <button type="button" className={BOTAO} disabled={!transcricao?.disponivel} onClick={() => void recuperar(m)}>
                    <RotateCcw size={12} />
                    Transcrever
                  </button>
                  <button type="button" className={BOTAO} onClick={() => void baixarSalva(m)}>
                    <Download size={12} />
                    Baixar
                  </button>
                  <button
                    type="button"
                    className={BOTAO}
                    onClick={async () => {
                      await apagarGravacao(m.id).catch(() => {});
                      await recarregarPendentes();
                    }}
                  >
                    <Trash2 size={12} />
                    Apagar
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {!consentiu ? (
        <div className="rounded-md border border-warn/40 bg-warn-soft/25 px-4 py-3">
          <p className="text-[12.5px] font-semibold text-warn">Antes de gravar</p>
          <p className="mt-1 text-[12px] leading-relaxed text-ink-dim">
            Avise todos os participantes de que a reunião será gravada — gravar alguém sem ciência é ilegal e destrói a confiança que o produto existe
            para medir. O áudio fica salvo neste computador e é enviado ao provedor de transcrição (OpenAI) para virar texto; o texto é anonimizado
            antes da análise, e o áudio salvo aqui é apagado sozinho sete dias depois de transcrito.
          </p>
          <button
            type="button"
            onClick={() => setConsentiu(true)}
            className="mt-2.5 inline-flex items-center gap-1.5 rounded-md border border-warn/50 bg-surface px-3 py-1.5 text-[12px] font-medium text-warn transition-colors hover:bg-warn-soft"
          >
            <Check size={13} />
            Os participantes foram avisados
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <fieldset className="grid gap-2 sm:grid-cols-2">
            <legend className="mb-2 text-[11px] font-medium uppercase tracking-wide text-ink-faint">Onde é a reunião</legend>
            <OpcaoModo
              ativo={modo === 'online'}
              desabilitado={!online}
              aoEscolher={() => setModo('online')}
              icone={<MonitorSpeaker size={16} />}
              titulo="Online — Meet, Teams ou Zoom no navegador"
              texto={
                online
                  ? 'Grava seu microfone e o som da aba da reunião separados: a transcrição sai com quem falou o quê.'
                  : 'Precisa do Chrome ou do Edge no computador — outros navegadores não compartilham o som de uma aba.'
              }
            />
            <OpcaoModo
              ativo={modo === 'presencial'}
              aoEscolher={() => setModo('presencial')}
              icone={<Users size={16} />}
              titulo="Presencial — só o microfone"
              texto="Um canal só. A transcrição sai sem separação de quem falou, e o motor se abstém de talk ratio e voz do cliente."
            />
          </fieldset>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-faint" htmlFor="nome-vendedor">
                Seu nome
              </label>
              <input id="nome-vendedor" className={CAMPO} placeholder="Ex.: Ana Torres" value={nome} maxLength={40} onChange={(e) => setNome(e.target.value)} />
              <p className="mt-1 text-[11px] text-ink-faint">Rotula suas falas na transcrição. Fica lembrado neste navegador.</p>
            </div>
            {modo === 'online' ? (
              <div className="rounded-md border border-line bg-surface-2 px-3 py-2.5 text-[11.5px] leading-relaxed text-ink-dim">
                <p className="font-medium text-ink">Ao clicar em gravar:</p>
                <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                  <li>escolha a <strong className="font-medium text-ink">aba da reunião</strong>;</li>
                  <li>
                    deixe ligado <strong className="font-medium text-ink">“Compartilhar áudio da guia”</strong>;
                  </li>
                  <li>permita o microfone.</li>
                </ol>
                <p className="mt-1">Com fone de ouvido a separação fica perfeita; sem fone, o eco é removido.</p>
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => void comecar()}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-[12.5px] font-semibold text-canvas transition-opacity hover:opacity-90"
            >
              <Mic size={14} />
              {modo === 'online' ? 'Escolher a aba e gravar' : 'Gravar'}
            </button>
            {transcricao && !transcricao.disponivel ? (
              <span className="text-[11.5px] text-warn">Transcrição indisponível agora — a gravação fica salva para transcrever depois.</span>
            ) : (
              <span className="text-[11.5px] text-ink-faint">Sem limite de duração · transcrito ao parar</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OpcaoModo({
  ativo,
  desabilitado,
  aoEscolher,
  icone,
  titulo,
  texto,
}: {
  ativo: boolean;
  desabilitado?: boolean;
  aoEscolher: () => void;
  icone: React.ReactNode;
  titulo: string;
  texto: string;
}) {
  return (
    <button
      type="button"
      disabled={desabilitado}
      aria-pressed={ativo}
      onClick={aoEscolher}
      className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${
        ativo ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2 hover:border-line-strong'
      }`}
    >
      <span className={`mt-0.5 shrink-0 ${ativo ? 'text-accent' : 'text-ink-faint'}`}>{icone}</span>
      <span>
        <span className="block text-[12.5px] font-semibold text-ink">{titulo}</span>
        <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-dim">{texto}</span>
      </span>
    </button>
  );
}

function Medidor({ rotulo, nivel, mudo }: { rotulo: string; nivel: number; mudo: boolean }) {
  return (
    <div className={`rounded-lg border px-3.5 py-3 ${mudo ? 'border-risk/40 bg-risk-soft/30' : 'border-line bg-surface-2'}`}>
      <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-ink-dim">
        <AudioLines size={13} className={mudo ? 'text-risk' : 'text-ink-faint'} />
        {rotulo}
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-3" role="meter" aria-label={rotulo} aria-valuemin={0} aria-valuemax={1} aria-valuenow={Number(nivel.toFixed(2))}>
        <div className="h-full rounded-full bg-accent transition-[width] duration-100" style={{ width: `${Math.round(nivel * 100)}%` }} />
      </div>
    </div>
  );
}

function Alerta({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 rounded-md border border-risk/30 bg-risk-soft/30 px-3 py-2 text-[12px] leading-relaxed text-ink">
      <TriangleAlert size={13} className="mt-0.5 shrink-0 text-risk" />
      <span>{children}</span>
    </p>
  );
}
