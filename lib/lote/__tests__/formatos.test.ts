import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strToU8, zipSync } from 'fflate';
import { preparar } from '../../analysis';
import { criarNormalizador, reorganizarFalantes } from '../falantes';
import { deDocx, deJson, deLegenda, deXlsx, lerTabela, lerTabelaCsv } from '../formatos';
import { consertarNomeZip, extrair, type Fonte } from '../extrair';
import { clienteDasPastas, dataNoNome, metadadosDoCaminho, normalizarData, normalizarTipo } from '../metadados';
import { decodificar, lerCsv } from '../texto';
import type { ItemTexto } from '../tipos';

/** O que o motor entende do texto: nomes de falante reconhecidos. */
const falantesNoMotor = (t: string) => preparar(t).falantes.map((f) => f.nome).sort();

const TEAMS_VTT = `WEBVTT

a1b2c3/12-0
00:00:01.000 --> 00:00:04.200
<v Ana Torres>Bom dia, Ricardo. Obrigada pelo tempo.</v>

a1b2c3/13-0
00:00:04.200 --> 00:00:06.000
<v Ana Torres>Vamos falar do Protheus?</v>

a1b2c3/14-0
00:00:06.500 --> 00:00:11.000
<v Ricardo Mendes>Claro. Hoje o fechamento leva doze dias e ninguém aguenta mais.</v>
`;

test('VTT do Teams: <v Nome> vira turno do motor, cues do mesmo falante se juntam', () => {
  const t = deLegenda(TEAMS_VTT);
  assert.equal(t.split('\n').length, 2);
  assert.match(t, /^Ana Torres: Bom dia, Ricardo\. Obrigada pelo tempo\. Vamos falar do Protheus\?$/m);
  assert.deepEqual(falantesNoMotor(t), ['Ana Torres', 'Ricardo Mendes']);
});

test('VTT do Zoom: "Nome: fala" dentro do cue', () => {
  const zoom = `WEBVTT\n\n1\n00:00:01.000 --> 00:00:03.000\nAna Torres: Oi, pessoal.\n\n2\n00:00:03.500 --> 00:00:07.000\nJoão Silva: Oi, Ana. Estamos avaliando a Senior também.\n`;
  assert.deepEqual(falantesNoMotor(deLegenda(zoom)), ['Ana Torres', 'João Silva']);
});

test('SRT sem falante: parágrafo novo a cada pausa de 2 s', () => {
  const srt = `1\n00:00:01,000 --> 00:00:03,000\nPrimeira frase.\n\n2\n00:00:03,100 --> 00:00:05,000\nContinua aqui.\n\n3\n00:00:09,000 --> 00:00:11,000\nOutra pessoa responde.\n`;
  assert.equal(deLegenda(srt), 'Primeira frase. Continua aqui.\nOutra pessoa responde.');
});

test('legenda rolante do YouTube não duplica linhas', () => {
  const yt = `WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nolá pessoal\n\n00:00:02.000 --> 00:00:03.000\nolá pessoal\nhoje vamos falar\n`;
  assert.equal(deLegenda(yt), 'olá pessoal hoje vamos falar');
});

test('rótulos genéricos e e-mails viram nomes que o motor aceita', () => {
  const n = criarNormalizador();
  assert.equal(n('SPEAKER_00'), 'Falante A');
  assert.equal(n('Speaker 1'), 'Falante B');
  assert.equal(n('SPEAKER_00'), 'Falante A', 'mesmo rótulo, mesmo falante');
  assert.equal(n(2), 'Falante C');
  assert.equal(n('ana.torres@totvs.com.br'), 'Ana Torres');
  assert.equal(n('RICARDO MENDES'), 'Ricardo Mendes');
  assert.equal(n('Ana Paula de Souza Lima'), 'Ana Lima');
  assert.equal(n('Jean-Pierre'), 'Jean Pierre');
  assert.equal(n(''), null);
});

test('JSON do Whisper, AssemblyAI, Deepgram e Fireflies', () => {
  const whisper = deJson(JSON.stringify({ text: 'Bom dia a todos, vamos começar a reunião de alinhamento.', segments: [{ id: 0, text: 'Bom dia' }] }));
  assert.match(whisper[0]!.texto, /Bom dia a todos/);

  const assembly = deJson(JSON.stringify({ utterances: [{ speaker: 'A', text: 'Qual o prazo?' }, { speaker: 'B', text: 'Até sexta-feira que vem.' }, { speaker: 'A', text: 'Perfeito.' }] }));
  assert.deepEqual(falantesNoMotor(assembly[0]!.texto), ['Falante A', 'Falante B']);

  const deepgram = deJson(JSON.stringify({ results: { utterances: [{ speaker: 0, transcript: 'Vocês usam Protheus hoje?' }, { speaker: 1, transcript: 'Usamos, na versão doze, e a migração está travada.' }] } }));
  assert.deepEqual(falantesNoMotor(deepgram[0]!.texto), ['Falante A', 'Falante B']);

  const fireflies = deJson(JSON.stringify({ title: 'Descoberta Vale Verde', date: '2026-09-10', sentences: [{ speaker_name: 'Ana Torres', text: 'Como está o fechamento?' }, { speaker_name: 'Carlos Lima', text: 'Demorado demais, doze dias.' }] }));
  assert.equal(fireflies[0]!.titulo, 'Descoberta Vale Verde');
  assert.equal(fireflies[0]!.data, '2026-09-10');
  assert.deepEqual(falantesNoMotor(fireflies[0]!.texto), ['Ana Torres', 'Carlos Lima']);
});

test('JSON com lista de reuniões vira várias reuniões com seus metadados', () => {
  const longo = (n: string) => `Ana: ${'Conversa longa sobre o projeto de migração. '.repeat(6)}\n${n}: Concordo com o plano.`;
  const lista = deJson(JSON.stringify([
    { titulo: 'Kickoff', cliente: 'Metalúrgica Vale Verde', data: '10/09/2026', transcricao: longo('Carlos') },
    { titulo: 'Renovação', cliente: 'Agro Norte', data: '2026-09-11', transcricao: longo('Paula') },
  ]));
  assert.equal(lista.length, 2);
  assert.equal(lista[1]!.cliente, 'Agro Norte');
});

test('layout de documento do Meet e do Teams (nome sem dois-pontos) é reorganizado', () => {
  const meet = `Ana Torres\n00:00:03\nOlá, Carlos. Tudo certo?\nCarlos Lima\n00:00:07\nTudo. Queria falar do contrato.\n`;
  assert.deepEqual(falantesNoMotor(reorganizarFalantes(meet)), ['Ana Torres', 'Carlos Lima']);

  const teams = `Ana Torres   0:03\nOlá, Carlos.\n\nCarlos Lima   0:07\nQueria falar do contrato.\n`;
  assert.deepEqual(falantesNoMotor(reorganizarFalantes(teams)), ['Ana Torres', 'Carlos Lima']);

  const jaRotulado = 'Ana: Olá.\nCarlos: Oi.\nTítulo Solto\n00:10\nmais texto';
  assert.equal(reorganizarFalantes(jaRotulado), jaRotulado, 'não reescreve o que o motor já lê');
});

function docx(paragrafos: string[]): Uint8Array {
  const corpo = paragrafos
    .map((p) => `<w:p><w:r><w:t xml:space="preserve">${p.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</w:t></w:r></w:p>`)
    .join('');
  return zipSync({ 'word/document.xml': strToU8(`<?xml version="1.0"?><w:document><w:body>${corpo}</w:body></w:document>`) });
}

test('DOCX: parágrafos em ordem, entidades XML decodificadas', () => {
  const t = deDocx(docx(['Ana: Proposta & prazo <urgente>.', 'Carlos: Recebido.']));
  assert.equal(t, 'Ana: Proposta & prazo <urgente>.\nCarlos: Recebido.');
});

test('XLSX com strings compartilhadas e célula inline', () => {
  const xlsx = zipSync({
    'xl/sharedStrings.xml': strToU8('<sst><si><t>falante</t></si><si><t>fala</t></si><si><t>Ana</t></si><si><t>Qual o budget?</t></si></sst>'),
    'xl/worksheets/sheet1.xml': strToU8(
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>' +
        '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c></row>' +
        '<row r="3"><c r="A3" t="inlineStr"><is><t>Carlos</t></is></c><c r="B3" t="inlineStr"><is><t>Cerca de 200 mil.</t></is></c></row></sheetData></worksheet>',
    ),
  });
  const leitura = lerTabela(deXlsx(xlsx));
  assert.equal(leitura.forma, 'falas');
  assert.equal(leitura.forma === 'falas' && leitura.texto, 'Ana: Qual o budget?\nCarlos: Cerca de 200 mil.');
});

test('CSV com ponto e vírgula (Excel em português) e aspas', () => {
  assert.deepEqual(lerCsv('a;b\n"x;y";"diz ""oi"""\n'), [['a', 'b'], ['x;y', 'diz "oi"']]);
  const manifesto = lerTabelaCsv('arquivo;cliente;data\ncall1.vtt;Agro Norte;11/09/2026\n');
  assert.equal(manifesto.forma, 'manifesto');
});

test('Windows-1252 e UTF-16 são decodificados sem virar "reuni�o"', () => {
  const latin = Uint8Array.from([0x72, 0x65, 0x75, 0x6e, 0x69, 0xe3, 0x6f]); // "reunião" em CP1252
  assert.deepEqual(decodificar(latin), { texto: 'reunião', encoding: 'windows-1252' });
  const utf16 = new Uint8Array([0xff, 0xfe, ...new Uint8Array(new Uint16Array([...'não'].map((c) => c.charCodeAt(0))).buffer)]);
  assert.equal(decodificar(utf16).texto, 'não');
});

test('nome de zip gravado pelo Windows em CP850 volta a ter acento', () => {
  // "Metalúrgica/ação.txt" em CP850, lido como Latin-1 pelo leitor de zip
  const cp850 = String.fromCharCode(...[0x4d, 0x65, 0x74, 0x61, 0x6c, 0xa3, 0x72, 0x67, 0x69, 0x63, 0x61, 0x2f, 0x61, 0x87, 0xc6, 0x6f]);
  assert.equal(consertarNomeZip(cp850), 'Metalúrgica/ação');
  const utf8ComoLatin = String.fromCharCode(...new TextEncoder().encode('Reunião'));
  assert.equal(consertarNomeZip(utf8ComoLatin), 'Reunião');
  assert.equal(consertarNomeZip('Reunião'), 'Reunião', 'nome já correto não muda');
});

test('metadados saem do nome e da pasta', () => {
  assert.deepEqual(dataNoNome('GMT20260910-143000_Recording.m4a')?.data, '2026-09-10');
  assert.equal(dataNoNome('10.09.2026 call.txt')?.data, '2026-09-10');
  assert.equal(dataNoNome('call 31-02-2026.txt'), undefined, '31 de fevereiro não existe');
  assert.equal(normalizarData('46275'), '2026-09-10', 'serial de data do Excel');
  assert.equal(normalizarTipo('Follow-up semanal'), 'follow_up');
  assert.equal(normalizarTipo('Demo Protheus'), 'demonstracao');

  assert.equal(clienteDasPastas(['Reuniões setembro']), undefined, 'pasta só de palavras genéricas e de tempo');
  assert.equal(clienteDasPastas(['Transcrições Q3 2026']), undefined);
  assert.equal(clienteDasPastas(['Calls Agro Norte']), 'Calls Agro Norte');
  assert.equal(clienteDasPastas(['Metalúrgica Vale Verde', 'semana 2']), 'Metalúrgica Vale Verde');

  const m = metadadosDoCaminho('2026-09-10 - Descoberta Protheus.vtt', ['transcricoes', 'Metalúrgica Vale Verde', 'setembro 2026']);
  assert.deepEqual(m, { titulo: 'Descoberta Protheus', data: '2026-09-10', cliente: 'Metalúrgica Vale Verde', tipo: 'descoberta' });
  assert.equal(metadadosDoCaminho('2026-09-08 negociacao.json', ['Agro Norte']).titulo, 'Negociação — Agro Norte', 'nome que é só o tipo vira título legível');
  assert.equal(metadadosDoCaminho('GMT20260910-143000_Recording.m4a', []).titulo, 'Reunião');
});

const fonte = (caminho: string, conteudo: string | Uint8Array, pastas: string[] = []): Fonte => ({
  caminho,
  pastas,
  dados: typeof conteudo === 'string' ? strToU8(conteudo) : conteudo,
});

test('extrair: zip com pastas por cliente, manifesto, duplicata, lixo e formatos recusados', async () => {
  const reuniao = (a: string, b: string) => `${a}: Precisamos resolver o fechamento contábil.\n${b}: Concordo, está levando doze dias.`;
  const interno = zipSync({ 'extra.txt': strToU8(reuniao('Ana', 'Paula')) });
  const zip = zipSync({
    'Metalurgica Vale Verde/2026-09-10 descoberta.vtt': strToU8(TEAMS_VTT),
    'Metalurgica Vale Verde/copia.txt': strToU8(deLegenda(TEAMS_VTT)), // mesma reunião, outro formato
    'Agro Norte/call.txt': strToU8(reuniao('Ana', 'Jorge')),
    'Agro Norte/audio.m4a': new Uint8Array([1, 2, 3]),
    'manifesto.csv': strToU8('arquivo;titulo;data;tipo\ncall.txt;Renovação anual;12/09/2026;renovação\n'),
    'relatorio.pdf': strToU8('%PDF-1.4'),
    '__MACOSX/._call.txt': strToU8('lixo'),
    '.DS_Store': strToU8('lixo'),
    'aninhado.zip': interno,
    'vazio.txt': strToU8('oi'),
  });

  const r = await extrair([fonte('lote.zip', zip)]);
  const porNome = (s: string) => r.itens.find((i) => i.caminho.endsWith(s));

  assert.equal(r.itens.length, 7, 'lixo de sistema não conta; manifesto não vira reunião');
  assert.equal(r.manifesto.aplicadas, 1);

  const vtt = porNome('descoberta.vtt') as ItemTexto;
  assert.equal(vtt.tipo, 'texto');
  assert.deepEqual(vtt.meta, { titulo: 'Descoberta — Metalurgica Vale Verde', data: '2026-09-10', cliente: 'Metalurgica Vale Verde', tipo: 'descoberta' });
  assert.equal(vtt.falantes, 2);

  assert.equal(porNome('copia.txt')?.tipo, 'ignorado', 'duplicata de conteúdo');
  assert.match((porNome('copia.txt') as { motivo: string }).motivo, /idêntico/);

  const call = porNome('Agro Norte/call.txt') as ItemTexto;
  assert.deepEqual(call.meta, { titulo: 'Renovação anual', data: '2026-09-12', cliente: 'Agro Norte', tipo: 'renovacao' });

  assert.equal(porNome('audio.m4a')?.tipo, 'audio');
  assert.equal(porNome('relatorio.pdf')?.tipo, 'ignorado');
  assert.equal(porNome('aninhado.zip › extra.txt')?.tipo, 'texto');
  assert.match((porNome('vazio.txt') as { motivo: string }).motivo, /curto demais/);
});

test('zip com nome de cliente dá o cliente às reuniões da raiz; zip genérico não', async () => {
  const conteudo = strToU8('Ana: Vamos revisar o contrato de renovação.\nJorge: Pode ser na sexta.');
  const doCliente = await extrair([fonte('Agro Norte.zip', zipSync({ 'call.txt': conteudo }))]);
  assert.equal((doCliente.itens[0] as ItemTexto).meta.cliente, 'Agro Norte');
  const generico = await extrair([fonte('reunioes-setembro-2026.zip', zipSync({ 'call.txt': conteudo }))]);
  assert.equal((generico.itens[0] as ItemTexto).meta.cliente, undefined);
});
