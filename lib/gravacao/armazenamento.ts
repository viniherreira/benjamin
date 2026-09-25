/**
 * Gravações guardadas no próprio navegador, pedaço a pedaço, ENQUANTO gravam.
 *
 * SÓ NAVEGADOR.
 *
 * Uma reunião de uma hora não pode depender de a aba sobreviver uma hora. Cada
 * pedaço de 5 s vai para o IndexedDB assim que o MediaRecorder o entrega; se o
 * navegador travar, a bateria acabar ou alguém fechar a aba, a gravação é
 * remontada na próxima visita. O áudio não sai deste dispositivo até ser
 * enviado para transcrição — e é apagado sozinho sete dias depois de
 * transcrito.
 */

export type Canal = 'vendedor' | 'cliente';

export type MetaGravacao = {
  id: string;
  criadaEm: number;
  modo: 'online' | 'presencial';
  nomeVendedor: string;
  mime: string;
  canais: Canal[];
  /** Deslocamento de cada canal em relação ao primeiro que começou, em segundos. */
  deslocamento: Partial<Record<Canal, number>>;
  duracaoSegundos: number | null;
  finalizada: boolean;
  transcrita: boolean;
};

const BANCO = 'benjamin-gravacoes';
const SETE_DIAS = 7 * 24 * 3600 * 1000;

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const req = indexedDB.open(BANCO, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('gravacoes')) db.createObjectStore('gravacoes', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('pedacos')) {
        const p = db.createObjectStore('pedacos', { keyPath: ['id', 'canal', 'seq'] });
        p.createIndex('porGravacao', 'id');
      }
    };
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

function concluir<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((ok, erro) => {
    req.onsuccess = () => ok(req.result);
    req.onerror = () => erro(req.error);
  });
}

async function comLoja<T>(loja: 'gravacoes' | 'pedacos', modo: IDBTransactionMode, f: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await abrir();
  try {
    return await concluir(f(db.transaction(loja, modo).objectStore(loja)));
  } finally {
    db.close();
  }
}

/** IndexedDB existe e aceita escrita? (Aba anônima do Firefox, por exemplo, recusa.) */
export async function armazenamentoDisponivel(): Promise<boolean> {
  try {
    if (typeof indexedDB === 'undefined') return false;
    (await abrir()).close();
    return true;
  } catch {
    return false;
  }
}

export const salvarMeta = (m: MetaGravacao) => comLoja('gravacoes', 'readwrite', (s) => s.put(m));

export async function atualizarMeta(id: string, parcial: Partial<MetaGravacao>): Promise<void> {
  const atual = await comLoja<MetaGravacao | undefined>('gravacoes', 'readonly', (s) => s.get(id));
  if (atual) await salvarMeta({ ...atual, ...parcial });
}

export const salvarPedaco = (id: string, canal: Canal, seq: number, blob: Blob) =>
  comLoja('pedacos', 'readwrite', (s) => s.put({ id, canal, seq, blob }));

export async function listarGravacoes(): Promise<MetaGravacao[]> {
  const todas = await comLoja<MetaGravacao[]>('gravacoes', 'readonly', (s) => s.getAll());
  return todas.sort((a, b) => b.criadaEm - a.criadaEm);
}

/** Remonta cada canal na ordem em que os pedaços foram gravados. */
export async function montarCanais(meta: MetaGravacao): Promise<Partial<Record<Canal, Blob>>> {
  const pedacos = await comLoja<{ canal: Canal; seq: number; blob: Blob }[]>('pedacos', 'readonly', (s) =>
    s.index('porGravacao').getAll(meta.id),
  );
  const canais: Partial<Record<Canal, Blob>> = {};
  for (const canal of meta.canais) {
    const partes = pedacos.filter((p) => p.canal === canal).sort((a, b) => a.seq - b.seq).map((p) => p.blob);
    if (partes.length) canais[canal] = new Blob(partes, { type: meta.mime });
  }
  return canais;
}

export async function apagarGravacao(id: string): Promise<void> {
  const db = await abrir();
  try {
    const tx = db.transaction(['gravacoes', 'pedacos'], 'readwrite');
    tx.objectStore('gravacoes').delete(id);
    const idx = tx.objectStore('pedacos').index('porGravacao');
    const chaves = await concluir(idx.getAllKeys(id));
    for (const k of chaves) tx.objectStore('pedacos').delete(k);
    await new Promise<void>((ok, erro) => {
      tx.oncomplete = () => ok();
      tx.onerror = () => erro(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Gravação transcrita há mais de sete dias não precisa mais ocupar o disco de ninguém. */
export async function limparAntigas(): Promise<void> {
  for (const m of await listarGravacoes()) {
    if (m.transcrita && Date.now() - m.criadaEm > SETE_DIAS) await apagarGravacao(m.id);
  }
}
