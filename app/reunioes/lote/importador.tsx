'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  AudioLines,
  Ban,
  Check,
  CircleAlert,
  Download,
  FileText,
  FolderOpen,
  FolderUp,
  Loader2,
  Pause,
  Play,
  RotateCcw,
  Upload,
  X,
} from 'lucide-react';
import { criarAgenda, ErroFatal, ErroSessao, ErroTransitorio, type Estado, type Tarefa } from '@/lib/lote/agenda';
import { extrair, type Fonte } from '@/lib/lote/extrair';
import { transcreverArquivo } from '@/lib/lote/transcrever';
import { nomeBase, semExtensao } from '@/lib/lote/texto';
import { ROTULO_TIPO, type Formato, type ItemIgnorado, type TipoReuniao } from '@/lib/lote/tipos';
import { fontesDeArraste, fontesDeLista } from './entrada';

/* ------------------------------------------------------------------ *
 * Estado
 * ------------------------------------------------------------------ */

type Fase = 'vazio' | 'lendo' | 'revisao' | 'processando' | 'fim';

type Linha = {
  id: string;
  caminho: string;
  origem: 'texto' | 'audio';
  formato: Formato;
  /** Rótulos de falante reconhecidos no texto. Null para áudio (só depois de transcrever). */
  falantes: number | null;
  encoding?: string;
  incluir: boolean;
  titulo: string;
  cliente: string;
  data: string;
  tipo: TipoReuniao;
};

/**
 * O conteúdo pesado mora fora do estado do React. Cem transcrições de 34 mil
 * caracteres copiadas a cada atualização de progresso travariam a tela no
 * momento exato em que ela mais precisa responder.
 */
type Conteudo = { texto?: string; audio?: Blob; cache: Map<number, string> };

type Transcricao = { disponivel: boolean; erro?: string } | null;

const hoje = () => new Date().toISOString().slice(0, 10);

const CAMPO =
  'w-full min-w-0 rounded-md border border-line bg-surface-2 px-2 py-1.5 text-[12.5px] text-ink placeholder:text-ink-faint transition-colors focus:border-accent focus:outline-none disabled:opacity-60';
const BOTAO =
  'inline-flex items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-[12px] font-medium text-ink transition-all duration-300 hover:border-line-strong disabled:opacity-50';
const BOTAO_PRIMARIO =
  'inline-flex items-center gap-1.5 rounded-lg bg-accent px-3.5 py-2 text-[12.5px] font-semibold text-canvas transition-all duration-300 hover:shadow-glow disabled:opacity-50';

const FORMATOS_ACEITOS =
  '.txt,.md,.vtt,.srt,.sbv,.docx,.odt,.rtf,.json,.csv,.tsv,.xlsx,.zip,.mp3,.m4a,.wav,.ogg,.oga,.opus,.webm,.flac,.aac,.wma,.mp4,.m4v,.mov,.mpeg,.mpga,.mkv,.3gp,.amr,audio/*,video/*';

/* ------------------------------------------------------------------ *
 * Rede: cada reunião vira uma requisição à mesma rota da ingestão manual
 * ------------------------------------------------------------------ */

async function mensagem(r: Response): Promise<string> {
  const j = (await r.json().catch(() => null)) as { erro?: string } | null;
  return j?.erro ?? `HTTP ${r.status}`;
}

async function enviarParaAnalise(l: Linha, texto: string, sinal: AbortSignal) {
  let r: Response;
  try {
    r = await fetch('/api/meetings', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      signal: sinal,
      body: JSON.stringify({
        titulo: (l.titulo.trim() || semExtensao(nomeBase(l.caminho))).slice(0, 160),
        tipo: l.tipo,
        data: l.data || hoje(),
        ...(l.cliente.trim() ? { clienteNome: l.cliente.trim().slice(0, 120) } : {}),
        texto,
        origem: 'batch',
        idempotente: true,
      }),
    });
  } catch (e) {
    if (sinal.aborted) throw e;
    throw new ErroTransitorio('Sem conexão com o servidor.');
  }

  if (r.ok) {
    const j = (await r.json()) as { id: string; jaExistia?: boolean };
    return { meetingId: j.id, jaExistia: Boolean(j.jaExistia) };
  }
  if (r.status === 401) throw new ErroSessao(await mensagem(r));
  if (r.status === 503) throw new ErroFatal(await mensagem(r), 'analisar');
  if (r.status === 429 || r.status >= 500) {
    const espera = Number(r.headers.get('retry-after')) * 1000 || undefined;
    throw new ErroTransitorio(await mensagem(r), espera);
  }
  throw new Error(await mensagem(r));
}

/* ------------------------------------------------------------------ *
 * Relatório e modelo de manifesto
 * ------------------------------------------------------------------ */

function baixar(nome: string, conteudo: string) {
  // BOM + ";" : é o que o Excel em português abre sem pedir para importar.
  const blob = new Blob(['﻿', conteudo], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csv = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

function relatorioCsv(linhas: Linha[], estados: Record<string, Estado>, ignorados: ItemIgnorado[]): string {
  const cab = ['arquivo', 'titulo', 'cliente', 'data', 'tipo', 'formato', 'situacao', 'detalhe', 'reuniao'];
  const corpo = linhas
    .filter((l) => l.incluir)
    .map((l) => {
      const e = estados[l.id];
      const situacao = !e ? 'não processada' : e.fase === 'concluida' ? (e.jaExistia ? 'já importada' : 'concluída') : e.fase;
      const detalhe = e?.fase === 'erro' ? e.mensagem : e?.fase === 'aguardando' ? e.motivo : '';
      const reuniao = e?.fase === 'concluida' ? `${location.origin}/reunioes/${e.meetingId}` : '';
      return [l.caminho, l.titulo, l.cliente, l.data || hoje(), l.tipo, l.formato, situacao, detalhe, reuniao];
    });
  const fora = ignorados.map((i) => [i.caminho, '', '', '', '', '', 'ignorado', i.motivo, '']);
  return [cab, ...corpo, ...fora].map((l) => l.map(csv).join(';')).join('\n');
}

const MODELO_MANIFESTO = [
  'arquivo;titulo;cliente;data;tipo',
  '2026-09-10 descoberta.vtt;Descoberta Protheus;Metalúrgica Vale Verde;10/09/2026;descoberta',
  'call-renovacao.m4a;Renovação anual;Agro Norte;12/09/2026;renovação',
].join('\n');

/* ------------------------------------------------------------------ *
 * Componente
 * ------------------------------------------------------------------ */

export function Importador() {
  const [fase, setFase] = useState<Fase>('vazio');
  const [leitura, setLeitura] = useState<{ feitos: number; total: number; caminho: string } | null>(null);
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [ignorados, setIgnorados] = useState<ItemIgnorado[]>([]);
  const [manifesto, setManifesto] = useState<{ linhas: number; aplicadas: number } | null>(null);
  const [estados, setEstados] = useState<Record<string, Estado>>({});
  const [transcricao, setTranscricao] = useState<Transcricao>(null);
  const [pausa, setPausa] = useState<string | null>(null);
  const [erroGeral, setErroGeral] = useState<string | null>(null);
  const [frentes, setFrentes] = useState({ analisar: 6, transcrever: 2 });
  const [inicio, setInicio] = useState<number | null>(null);
  const [agora, setAgora] = useState(Date.now());
  const [resumo, setResumo] = useState<{ ms: number } | null>(null);

  const conteudo = useRef(new Map<string, Conteudo>());
  const agenda = useRef<ReturnType<typeof criarAgenda> | null>(null);

  /* ---------- leitura ---------- */

  const receber = useCallback(async (fontes: Fonte[]) => {
    if (fontes.length === 0) return;
    setErroGeral(null);
    setFase('lendo');
    try {
      const r = await extrair(fontes, (feitos, total, caminho) => setLeitura({ feitos, total, caminho }));
      conteudo.current = new Map();
      const novas: Linha[] = [];
      r.itens.forEach((item, i) => {
        if (item.tipo === 'ignorado') return;
        const id = String(i);
        conteudo.current.set(id, item.tipo === 'texto' ? { texto: item.texto, cache: new Map() } : { audio: item.dados, cache: new Map() });
        novas.push({
          id,
          caminho: item.caminho,
          origem: item.tipo,
          formato: item.formato,
          falantes: item.tipo === 'texto' ? item.falantes : null,
          ...(item.tipo === 'texto' && item.encoding ? { encoding: item.encoding } : {}),
          incluir: true,
          titulo: item.meta.titulo || semExtensao(nomeBase(item.caminho)),
          cliente: item.meta.cliente ?? '',
          data: item.meta.data ?? '',
          tipo: item.meta.tipo,
        });
      });
      setLinhas(novas);
      setIgnorados(r.itens.filter((i): i is ItemIgnorado => i.tipo === 'ignorado'));
      setManifesto(r.manifesto.linhas ? r.manifesto : null);
      setEstados({});
      setResumo(null);
      setFase('revisao');

      if (novas.some((l) => l.origem === 'audio')) {
        const t = (await fetch('/api/transcribe')
          .then((x) => (x.ok ? x.json() : { disponivel: false, erro: `Não foi possível consultar a transcrição (HTTP ${x.status}).` }))
          .catch(() => ({ disponivel: false, erro: 'Não foi possível consultar a transcrição.' }))) as Transcricao;
        setTranscricao(t);
      } else setTranscricao(null);
    } catch (e) {
      setErroGeral(e instanceof Error ? e.message : 'Não foi possível ler os arquivos.');
      setFase('vazio');
    } finally {
      setLeitura(null);
    }
  }, []);

  /* ---------- execução ---------- */

  const processar = useCallback(
    async (alvo: Linha[]) => {
      const porId = new Map(alvo.map((l) => [l.id, l]));
      const tarefas: Tarefa[] = alvo.map((l) => ({
        id: l.id,
        grupo: l.cliente.trim() ? l.cliente.trim().toLowerCase() : null,
        ordem: `${l.data || hoje()}|${l.titulo}|${l.id.padStart(6, '0')}`,
        precisaTranscrever: !conteudo.current.get(l.id)?.texto,
      }));

      setPausa(null);
      setFase('processando');
      setInicio(Date.now());
      setResumo(null);

      const a = criarAgenda({
        tarefas,
        concorrencia: frentes,
        aoMudar: (id, e) => setEstados((s) => ({ ...s, [id]: e })),
        aoPausar: (motivo) => setPausa(motivo),
        executar: {
          transcrever: async (id, sinal, progresso) => {
            const c = conteudo.current.get(id)!;
            if (!c.audio) throw new Error('Áudio não está mais disponível. Solte o arquivo de novo.');
            const r = await transcreverArquivo(c.audio, nomeBase(porId.get(id)!.caminho), {
              sinal,
              aoProgresso: progresso,
              cache: c.cache,
            });
            c.texto = r.texto;
          },
          analisar: async (id, sinal) => {
            const texto = conteudo.current.get(id)?.texto;
            if (!texto) throw new Error('Sem texto para analisar.');
            return enviarParaAnalise(porId.get(id)!, texto, sinal);
          },
        },
      });
      agenda.current = a;
      const r = await a.iniciar();
      agenda.current = null;
      setResumo({ ms: r.ms });
      setFase('fim');
    },
    [frentes],
  );

  useEffect(() => {
    if (fase !== 'processando') return;
    const relogio = setInterval(() => setAgora(Date.now()), 1000);
    // Fechar a aba no meio do lote interrompe a fila; o navegador pergunta antes.
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', avisar);
    return () => {
      clearInterval(relogio);
      window.removeEventListener('beforeunload', avisar);
    };
  }, [fase]);

  /* ---------- derivados ---------- */

  const incluidas = useMemo(() => linhas.filter((l) => l.incluir), [linhas]);
  const audiosIncluidos = incluidas.filter((l) => l.origem === 'audio').length;
  const semFalante = incluidas.filter((l) => l.falantes === 0).length;
  const clientes = useMemo(
    () => [...new Set(linhas.map((l) => l.cliente.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')),
    [linhas],
  );
  const semCliente = incluidas.filter((l) => !l.cliente.trim()).length;
  const semData = incluidas.filter((l) => !l.data).length;

  const contagem = useMemo(() => {
    const c = { fila: 0, transcrevendo: 0, analisando: 0, aguardando: 0, concluida: 0, jaExistia: 0, erro: 0, cancelada: 0 };
    for (const e of Object.values(estados)) {
      if (e.fase === 'concluida') {
        c.concluida++;
        if (e.jaExistia) c.jaExistia++;
      } else c[e.fase]++;
    }
    return c;
  }, [estados]);

  const falhas = linhas.filter((l) => l.incluir && estados[l.id]?.fase === 'erro');
  const bloqueadasPorTranscricao = transcricao && !transcricao.disponivel ? audiosIncluidos : 0;

  const editar = (id: string, campo: Partial<Linha>) =>
    setLinhas((ls) => ls.map((l) => (l.id === id ? { ...l, ...campo } : l)));

  const recomecar = () => {
    conteudo.current = new Map();
    setLinhas([]);
    setIgnorados([]);
    setEstados({});
    setManifesto(null);
    setTranscricao(null);
    setResumo(null);
    setFase('vazio');
  };

  /* ---------- render ---------- */

  if (fase === 'vazio' || fase === 'lendo') {
    return <Soltar lendo={fase === 'lendo'} leitura={leitura} erro={erroGeral} aoReceber={receber} />;
  }

  const executando = fase === 'processando';
  const total = Object.keys(estados).length || incluidas.length;
  const terminadas = contagem.concluida + contagem.erro + contagem.cancelada;
  const decorrido = inicio ? ((resumo?.ms ?? agora - inicio) / 1000) : 0;
  const porMinuto = decorrido > 0 ? (contagem.concluida / decorrido) * 60 : 0;
  const restante = porMinuto > 0 && executando ? ((total - terminadas) / porMinuto) * 60 : null;

  return (
    <div className="grid gap-6">
      {/* ---------- faixa de números ---------- */}
      <section className="vidro rounded-xl px-5 py-4">
        <div className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-5 lg:gap-x-8 [&>*+*]:lg:border-l [&>*+*]:lg:border-line [&>*+*]:lg:pl-8">
          {fase === 'revisao' ? (
            <>
              <Numero rotulo="Reuniões" valor={incluidas.length} detalhe={`de ${linhas.length} encontradas`} />
              <Numero rotulo="De texto" valor={incluidas.length - audiosIncluidos} detalhe="análise imediata" />
              <Numero rotulo="De áudio" valor={audiosIncluidos} detalhe="transcritas antes" />
              <Numero rotulo="Clientes" valor={clientes.length} detalhe={semCliente ? `${semCliente} sem cliente` : 'todas com cliente'} />
              <Numero rotulo="Ignorados" valor={ignorados.length} detalhe={ignorados.length ? 'motivo abaixo' : 'nenhum arquivo'} />
            </>
          ) : (
            <>
              <Numero rotulo="Concluídas" valor={contagem.concluida} detalhe={`de ${total}${contagem.jaExistia ? ` · ${contagem.jaExistia} já existiam` : ''}`} tom="health" />
              <Numero
                rotulo="Em andamento"
                valor={contagem.transcrevendo + contagem.analisando}
                detalhe={`${contagem.transcrevendo} transcrevendo · ${contagem.analisando} analisando`}
              />
              <Numero rotulo="Na fila" valor={contagem.fila + contagem.aguardando} detalhe={contagem.aguardando ? `${contagem.aguardando} aguardando nova tentativa` : 'aguardando vez'} />
              <Numero rotulo="Erros" valor={contagem.erro} detalhe={contagem.cancelada ? `${contagem.cancelada} canceladas` : 'com motivo na linha'} tom={contagem.erro ? 'risk' : undefined} />
              <Numero
                rotulo="Tempo"
                valor={formatarTempo(decorrido)}
                detalhe={restante !== null ? `~${formatarTempo(restante)} restantes · ${porMinuto.toFixed(1)}/min` : porMinuto ? `${porMinuto.toFixed(1)} reuniões/min` : '—'}
              />
            </>
          )}
        </div>
        {fase !== 'revisao' ? (
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={terminadas}>
            <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${total ? (terminadas / total) * 100 : 0}%` }} />
          </div>
        ) : null}
      </section>

      {/* ---------- avisos ---------- */}
      {pausa ? (
        <Aviso tom="risk" icone={<Pause size={14} />}>
          <strong className="font-semibold">Lote pausado: {pausa}</strong> Entre de novo em outra aba — o que já foi processado está salvo — e depois clique em{' '}
          <button type="button" className="font-semibold underline underline-offset-2" onClick={() => { setPausa(null); agenda.current?.retomar(); }}>
            retomar
          </button>
          .
        </Aviso>
      ) : null}

      {fase === 'revisao' && bloqueadasPorTranscricao ? (
        <Aviso tom="risk" icone={<AudioLines size={14} />}>
          <strong className="font-semibold">
            {bloqueadasPorTranscricao} {bloqueadasPorTranscricao === 1 ? 'áudio não será transcrito' : 'áudios não serão transcritos'}.
          </strong>{' '}
          {transcricao?.erro ?? 'A transcrição de áudio não está disponível.'} As reuniões em texto seguem normalmente.
        </Aviso>
      ) : null}

      {fase === 'revisao' && semFalante ? (
        <Aviso tom="neutro" icone={<CircleAlert size={14} />}>
          {semFalante} {semFalante === 1 ? 'reunião não tem' : 'reuniões não têm'} rótulo de quem falou (formato <code className="font-mono text-[11px]">Nome: fala</code>). Elas
          são analisadas, mas talk ratio, voz do cliente e os escores que dependem de separar vendedor e cliente ficam em branco — o motor se abstém em vez de chutar.
          {audiosIncluidos ? ' Áudio transcrito também chega sem rótulo.' : ''}
        </Aviso>
      ) : null}

      {fase === 'revisao' && manifesto ? (
        <Aviso tom="neutro" icone={<FileText size={14} />}>
          Manifesto lido: {manifesto.linhas} {manifesto.linhas === 1 ? 'linha' : 'linhas'}, {manifesto.aplicadas}{' '}
          {manifesto.aplicadas === 1 ? 'arquivo recebeu' : 'arquivos receberam'} título, cliente, data ou tipo dele.
          {manifesto.aplicadas > manifesto.linhas
            ? ' Uma linha com nome de arquivo que se repete em várias pastas vale para todas — para ser específico, escreva o caminho (Cliente/arquivo.vtt).'
            : manifesto.aplicadas < manifesto.linhas
              ? ' As demais linhas não casaram com nenhum arquivo do lote.'
              : ''}
        </Aviso>
      ) : null}

      {/* ---------- ações ---------- */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {fase === 'revisao' ? (
            <>
              <button
                type="button"
                className={BOTAO_PRIMARIO}
                disabled={incluidas.length === 0}
                onClick={() => void processar(incluidas)}
              >
                <Play size={14} />
                Processar {incluidas.length} {incluidas.length === 1 ? 'reunião' : 'reuniões'}
              </button>
              <button type="button" className={BOTAO} onClick={recomecar}>
                <X size={13} />
                Descartar
              </button>
            </>
          ) : null}
          {executando ? (
            <button type="button" className={BOTAO} onClick={() => agenda.current?.cancelar()}>
              <Ban size={13} />
              Cancelar o que falta
            </button>
          ) : null}
          {fase === 'fim' ? (
            <>
              {falhas.length ? (
                <button type="button" className={BOTAO_PRIMARIO} onClick={() => void processar(falhas)}>
                  <RotateCcw size={14} />
                  Tentar de novo {falhas.length} com erro
                </button>
              ) : null}
              <Link href="/reunioes" className={BOTAO}>
                Ver reuniões
              </Link>
              <button type="button" className={BOTAO} onClick={recomecar}>
                <Upload size={13} />
                Importar outro lote
              </button>
            </>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {fase !== 'revisao' ? (
            <button
              type="button"
              className={BOTAO}
              onClick={() => baixar(`benjamin-lote-${hoje()}.csv`, relatorioCsv(linhas, estados, ignorados))}
            >
              <Download size={13} />
              Relatório (CSV)
            </button>
          ) : (
            <details className="relative">
              <summary className={`${BOTAO} cursor-pointer list-none`}>Frentes de trabalho</summary>
              <div className="absolute right-0 z-10 mt-2 w-72 rounded-xl border border-line bg-surface-solid p-4 text-[12px] shadow-lift">
                <label className="block" htmlFor="frentes-analise">
                  <span className="font-medium text-ink">Análises simultâneas</span>
                  <input id="frentes-analise" type="number" min={1} max={16} className={`${CAMPO} mt-1`} value={frentes.analisar}
                    onChange={(e) => setFrentes((f) => ({ ...f, analisar: Math.max(1, Math.min(16, Number(e.target.value) || 1)) }))} />
                </label>
                <label className="mt-3 block" htmlFor="frentes-transcricao">
                  <span className="font-medium text-ink">Áudios transcritos ao mesmo tempo</span>
                  <input id="frentes-transcricao" type="number" min={1} max={6} className={`${CAMPO} mt-1`} value={frentes.transcrever}
                    onChange={(e) => setFrentes((f) => ({ ...f, transcrever: Math.max(1, Math.min(6, Number(e.target.value) || 1)) }))} />
                </label>
                <p className="mt-3 leading-relaxed text-ink-faint">
                  Cada áudio envia até 3 trechos em paralelo ao provedor. Se ele devolver limite de requisições, o lote espera e continua sozinho.
                  Reuniões do mesmo cliente são sempre analisadas uma por vez, em ordem de data, para que cada uma enxergue a anterior na memória da conta.
                </p>
              </div>
            </details>
          )}
        </div>
      </div>

      {fase === 'revisao' ? (
        <EdicaoEmMassa
          clientes={clientes}
          pendencias={{ semCliente, semData }}
          aoAplicar={(campo) => setLinhas((ls) => ls.map((l) => (l.incluir ? { ...l, ...campo } : l)))}
        />
      ) : null}

      {/* ---------- tabela ---------- */}
      <section className="vidro overflow-hidden rounded-xl">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] border-collapse text-left text-[12.5px]">
            <thead>
              <tr className="border-b border-line text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                <th className="w-10 px-3 py-2.5">
                  {fase === 'revisao' ? (
                    <input
                      type="checkbox"
                      aria-label="Incluir todas"
                      checked={incluidas.length === linhas.length}
                      onChange={(e) => setLinhas((ls) => ls.map((l) => ({ ...l, incluir: e.target.checked })))}
                    />
                  ) : null}
                </th>
                <th className="px-2 py-2.5">Arquivo</th>
                <th className="px-2 py-2.5">Título</th>
                <th className="w-[18%] px-2 py-2.5">Cliente</th>
                <th className="w-[130px] px-2 py-2.5">Data</th>
                <th className="w-[150px] px-2 py-2.5">Tipo</th>
                {fase !== 'revisao' ? <th className="w-[200px] px-3 py-2.5">Situação</th> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {(fase === 'revisao' ? linhas : incluidas).map((l) => (
                <LinhaTabela
                  key={l.id}
                  linha={l}
                  editavel={fase === 'revisao'}
                  estado={estados[l.id]}
                  semTranscricao={Boolean(transcricao && !transcricao.disponivel && l.origem === 'audio')}
                  aoEditar={(c) => editar(l.id, c)}
                />
              ))}
            </tbody>
          </table>
        </div>
        <datalist id="clientes-do-lote">
          {clientes.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </section>

      {ignorados.length ? (
        <details className="vidro rounded-xl px-5 py-4 text-[12.5px]">
          <summary className="cursor-pointer font-medium text-ink">
            {ignorados.length} {ignorados.length === 1 ? 'arquivo ignorado' : 'arquivos ignorados'} — ver motivos
          </summary>
          <ul className="mt-3 divide-y divide-line">
            {ignorados.map((i) => (
              <li key={i.caminho} className="grid gap-1 py-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-4">
                <span className="truncate font-mono text-[11.5px] text-ink-dim" title={i.caminho}>
                  {i.caminho}
                </span>
                <span className="text-ink-faint">{i.motivo}</span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Peças
 * ------------------------------------------------------------------ */

function formatarTempo(segundos: number): string {
  if (!Number.isFinite(segundos) || segundos < 0) return '—';
  if (segundos < 60) return `${Math.round(segundos)} s`;
  const m = Math.floor(segundos / 60);
  if (m < 60) return `${m} min ${Math.round(segundos % 60)} s`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}

function Numero({ rotulo, valor, detalhe, tom }: { rotulo: string; valor: number | string; detalhe: string; tom?: 'health' | 'risk' }) {
  const cor = tom === 'health' ? 'text-health' : tom === 'risk' ? 'text-risk' : 'text-ink';
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-faint">{rotulo}</p>
      <p className={`mt-2 font-mono text-[24px] leading-none tabular-nums ${cor}`}>{valor}</p>
      <p className="mt-2 truncate text-[11px] text-ink-faint" title={detalhe}>
        {detalhe}
      </p>
    </div>
  );
}

function Aviso({ tom, icone, children }: { tom: 'risk' | 'neutro'; icone: ReactNode; children: ReactNode }) {
  const estilo = tom === 'risk' ? 'border-risk/30 bg-risk-soft/40 text-ink' : 'border-line bg-surface-2 text-ink-dim';
  return (
    <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-[12.5px] leading-relaxed ${estilo}`}>
      <span className={`mt-0.5 shrink-0 ${tom === 'risk' ? 'text-risk' : 'text-ink-faint'}`}>{icone}</span>
      <p>{children}</p>
    </div>
  );
}

function Soltar({
  lendo,
  leitura,
  erro,
  aoReceber,
}: {
  lendo: boolean;
  leitura: { feitos: number; total: number; caminho: string } | null;
  erro: string | null;
  aoReceber: (f: Fonte[]) => void;
}) {
  const [sobre, setSobre] = useState(false);
  const pasta = useRef<HTMLInputElement>(null);

  // webkitdirectory não é atributo do React; precisa ir direto no elemento.
  useEffect(() => {
    pasta.current?.setAttribute('webkitdirectory', '');
    pasta.current?.setAttribute('directory', '');
  }, []);

  return (
    <div className="grid gap-6">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setSobre(true);
        }}
        onDragLeave={() => setSobre(false)}
        onDrop={async (e) => {
          e.preventDefault();
          setSobre(false);
          if (lendo) return;
          aoReceber(await fontesDeArraste(e.dataTransfer));
        }}
        className={`vidro flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-16 text-center transition-colors ${
          sobre ? 'border-accent bg-accent-soft' : 'border-line-strong'
        }`}
      >
        {lendo ? (
          <>
            <Loader2 size={22} className="animate-spin text-ink-faint" />
            <p className="mt-4 text-[14px] font-medium text-ink">
              Lendo {leitura ? `${Math.min(leitura.feitos + 1, leitura.total)} de ${leitura.total}` : ''} arquivos…
            </p>
            <p className="mt-1 max-w-md truncate font-mono text-[11px] text-ink-faint">{leitura?.caminho}</p>
          </>
        ) : (
          <>
            <div className="flex size-12 items-center justify-center rounded-xl border border-line bg-accent-soft text-accent">
              <FolderUp size={20} />
            </div>
            <p className="mt-4 text-[15px] font-semibold tracking-[-0.01em] text-ink">Solte aqui uma pasta, um zip ou vários arquivos</p>
            <p className="mt-1.5 max-w-lg text-[12.5px] leading-relaxed text-ink-dim">
              Nada é enviado agora: primeiro você revisa título, cliente e data de cada reunião.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <label className={`${BOTAO_PRIMARIO} cursor-pointer`}>
                <Upload size={14} />
                Escolher arquivos
                <input
                  type="file"
                  multiple
                  accept={FORMATOS_ACEITOS}
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) aoReceber(fontesDeLista(e.target.files));
                    e.target.value = '';
                  }}
                />
              </label>
              <label className={`${BOTAO} cursor-pointer`}>
                <FolderOpen size={14} />
                Escolher pasta
                <input
                  ref={pasta}
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files) aoReceber(fontesDeLista(e.target.files));
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </>
        )}
      </div>

      {erro ? (
        <Aviso tom="risk" icone={<CircleAlert size={14} />}>
          {erro}
        </Aviso>
      ) : null}

      <section className="vidro grid gap-6 rounded-xl px-5 py-5 text-[12.5px] leading-relaxed text-ink-dim md:grid-cols-3">
        <div>
          <h2 className="text-[12.5px] font-semibold text-ink">O que entra</h2>
          <p className="mt-1.5">
            <strong className="font-medium text-ink">Texto:</strong> .txt, .docx, .odt, .rtf, legendas .vtt e .srt (Teams, Zoom, Meet), JSON de Whisper,
            AssemblyAI, Deepgram e Fireflies, planilhas .csv e .xlsx.
          </p>
          <p className="mt-1.5">
            <strong className="font-medium text-ink">Áudio e vídeo:</strong> .mp3, .m4a, .wav, .ogg, .webm, .mp4, .mov e outros — de qualquer duração.
          </p>
          <p className="mt-1.5">
            <strong className="font-medium text-ink">Pacotes:</strong> pastas e .zip, inclusive zip dentro de zip.
          </p>
        </div>
        <div>
          <h2 className="text-[12.5px] font-semibold text-ink">Como o cliente e a data são descobertos</h2>
          <p className="mt-1.5">
            A pasta vira o cliente: <span className="font-mono text-[11.5px]">Metalúrgica Vale Verde/call.vtt</span>. Pastas como “Reuniões setembro” são ignoradas.
          </p>
          <p className="mt-1.5">
            A data sai do nome do arquivo (<span className="font-mono text-[11.5px]">2026-09-10</span>, <span className="font-mono text-[11.5px]">10.09.2026</span>, gravação do Zoom), e o tipo de
            palavras como “descoberta” ou “renovação”.
          </p>
        </div>
        <div>
          <h2 className="text-[12.5px] font-semibold text-ink">Manifesto opcional</h2>
          <p className="mt-1.5">
            Uma planilha com a coluna <span className="font-mono text-[11.5px]">arquivo</span> e, se quiser, <span className="font-mono text-[11.5px]">titulo</span>,{' '}
            <span className="font-mono text-[11.5px]">cliente</span>, <span className="font-mono text-[11.5px]">data</span> e <span className="font-mono text-[11.5px]">tipo</span> tem prioridade sobre o que for deduzido.
          </p>
          <button type="button" className={`${BOTAO} mt-3`} onClick={() => baixar('manifesto-modelo.csv', MODELO_MANIFESTO)}>
            <Download size={13} />
            Baixar modelo
          </button>
        </div>
      </section>
    </div>
  );
}

function EdicaoEmMassa({
  clientes,
  pendencias,
  aoAplicar,
}: {
  clientes: string[];
  pendencias: { semCliente: number; semData: number };
  aoAplicar: (campo: Partial<Linha>) => void;
}) {
  const [cliente, setCliente] = useState('');
  const [data, setData] = useState('');
  const [tipo, setTipo] = useState<TipoReuniao | ''>('');
  return (
    <section className="flex flex-wrap items-end gap-3 rounded-xl border border-line bg-surface-2 px-4 py-3 text-[12px]">
      <p className="w-full text-ink-dim sm:w-auto sm:self-center">
        Aplicar a todas as marcadas
        {pendencias.semCliente || pendencias.semData ? (
          <span className="text-ink-faint">
            {' '}
            · {[pendencias.semCliente && `${pendencias.semCliente} sem cliente`, pendencias.semData && `${pendencias.semData} sem data (usariam hoje)`].filter(Boolean).join(' · ')}
          </span>
        ) : null}
      </p>
      <label className="grid gap-1" htmlFor="massa-cliente">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Cliente</span>
        <div className="flex gap-1.5">
          <input id="massa-cliente" list="clientes-do-lote" className={`${CAMPO} w-48`} value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder={clientes[0] ?? 'Nome da conta'} />
          <button type="button" className={BOTAO} disabled={!cliente.trim()} onClick={() => aoAplicar({ cliente: cliente.trim() })}>
            Aplicar
          </button>
        </div>
      </label>
      <label className="grid gap-1" htmlFor="massa-data">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Data</span>
        <div className="flex gap-1.5">
          <input id="massa-data" type="date" className={`${CAMPO} w-40`} value={data} onChange={(e) => setData(e.target.value)} />
          <button type="button" className={BOTAO} disabled={!data} onClick={() => aoAplicar({ data })}>
            Aplicar
          </button>
        </div>
      </label>
      <label className="grid gap-1" htmlFor="massa-tipo">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-faint">Tipo</span>
        <div className="flex gap-1.5">
          <select id="massa-tipo" className={`${CAMPO} w-44`} value={tipo} onChange={(e) => setTipo(e.target.value as TipoReuniao | '')}>
            <option value="">—</option>
            {Object.entries(ROTULO_TIPO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
          <button type="button" className={BOTAO} disabled={!tipo} onClick={() => tipo && aoAplicar({ tipo })}>
            Aplicar
          </button>
        </div>
      </label>
    </section>
  );
}

const ROTULO_FORMATO: Record<Formato, string> = {
  txt: 'TXT', vtt: 'Legenda', srt: 'SRT', json: 'JSON', docx: 'Documento', csv: 'CSV', xlsx: 'Planilha', audio: 'Áudio',
};

function LinhaTabela({
  linha: l,
  editavel,
  estado,
  semTranscricao,
  aoEditar,
}: {
  linha: Linha;
  editavel: boolean;
  estado?: Estado;
  semTranscricao: boolean;
  aoEditar: (c: Partial<Linha>) => void;
}) {
  const apagada = editavel && !l.incluir;
  const detalhes = [
    ROTULO_FORMATO[l.formato],
    l.falantes === null ? null : l.falantes === 0 ? 'sem falantes' : `${l.falantes} falantes`,
    l.encoding && l.encoding !== 'utf-8' ? l.encoding : null,
  ].filter(Boolean);

  return (
    <tr className={`align-top transition-opacity ${apagada ? 'opacity-45' : ''}`}>
      <td className="px-3 py-2.5">
        {editavel ? (
          <input type="checkbox" aria-label={`Incluir ${l.caminho}`} checked={l.incluir} onChange={(e) => aoEditar({ incluir: e.target.checked })} />
        ) : null}
      </td>
      <td className="max-w-[260px] px-2 py-2.5">
        <p className="flex items-center gap-1.5 truncate font-mono text-[11.5px] text-ink" title={l.caminho}>
          {l.origem === 'audio' ? <AudioLines size={12} className="shrink-0 text-ink-faint" /> : <FileText size={12} className="shrink-0 text-ink-faint" />}
          <span className="truncate">{nomeBase(l.caminho.split(' › ').pop() ?? l.caminho)}</span>
        </p>
        <p className={`mt-0.5 text-[11px] ${semTranscricao || l.falantes === 0 ? 'text-warn' : 'text-ink-faint'}`}>
          {semTranscricao ? 'transcrição indisponível' : detalhes.join(' · ')}
        </p>
      </td>
      <td className="px-2 py-2">
        {editavel ? (
          <input id={`titulo-${l.id}`} aria-label="Título" className={CAMPO} value={l.titulo} maxLength={160} onChange={(e) => aoEditar({ titulo: e.target.value })} />
        ) : (
          <p className="py-1.5 text-ink">{l.titulo}</p>
        )}
      </td>
      <td className="px-2 py-2">
        {editavel ? (
          <input id={`cliente-${l.id}`} aria-label="Cliente" list="clientes-do-lote" className={CAMPO} value={l.cliente} maxLength={120} placeholder="sem cliente" onChange={(e) => aoEditar({ cliente: e.target.value })} />
        ) : (
          <p className={`py-1.5 ${l.cliente ? 'text-ink' : 'text-ink-faint'}`}>{l.cliente || '—'}</p>
        )}
      </td>
      <td className="px-2 py-2">
        {editavel ? (
          <input id={`data-${l.id}`} aria-label="Data" type="date" className={CAMPO} value={l.data} onChange={(e) => aoEditar({ data: e.target.value })} />
        ) : (
          <p className="py-1.5 font-mono text-[11.5px] tabular-nums text-ink-dim">{l.data || hoje()}</p>
        )}
      </td>
      <td className="px-2 py-2">
        {editavel ? (
          <select id={`tipo-${l.id}`} aria-label="Tipo" className={CAMPO} value={l.tipo} onChange={(e) => aoEditar({ tipo: e.target.value as TipoReuniao })}>
            {Object.entries(ROTULO_TIPO).map(([v, r]) => (
              <option key={v} value={v}>
                {r}
              </option>
            ))}
          </select>
        ) : (
          <p className="py-1.5 text-ink-dim">{ROTULO_TIPO[l.tipo]}</p>
        )}
      </td>
      {!editavel ? (
        <td className="px-3 py-2">
          <Situacao estado={estado} />
        </td>
      ) : null}
    </tr>
  );
}

function Situacao({ estado }: { estado?: Estado }) {
  const chip = (tom: string, icone: ReactNode, texto: ReactNode) => (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${tom}`}>
      {icone}
      {texto}
    </span>
  );
  const neutro = 'border-line bg-surface-2 text-ink-dim';
  const ativo = 'border-accent/25 bg-accent-soft text-accent';

  if (!estado || estado.fase === 'fila') return chip(neutro, null, 'Na fila');
  switch (estado.fase) {
    case 'transcrevendo':
      return chip(ativo, <Loader2 size={11} className="animate-spin" />, estado.total ? `Transcrevendo ${estado.feitos}/${estado.total}` : 'Preparando áudio');
    case 'analisando':
      return chip(ativo, <Loader2 size={11} className="animate-spin" />, 'Analisando');
    case 'aguardando':
      return (
        <div className="grid gap-1">
          {chip('border-line bg-warn-soft text-warn', <Pause size={11} />, 'Aguardando')}
          <p className="text-[11px] leading-snug text-ink-faint">{estado.motivo}</p>
        </div>
      );
    case 'concluida':
      return (
        <Link href={`/reunioes/${estado.meetingId}`} className="inline-flex items-center gap-1.5 text-[11.5px] font-medium text-health underline-offset-2 hover:underline">
          <Check size={12} />
          {estado.jaExistia ? 'Já importada — abrir' : 'Abrir briefing'}
        </Link>
      );
    case 'erro':
      return (
        <div className="grid gap-1">
          {chip('border-risk/25 bg-risk-soft text-risk', <CircleAlert size={11} />, estado.etapa === 'transcrever' ? 'Erro na transcrição' : 'Erro na análise')}
          <p className="text-[11px] leading-snug text-ink-faint">{estado.mensagem}</p>
        </div>
      );
    case 'cancelada':
      return chip(neutro, <Ban size={11} />, 'Cancelada');
  }
}
