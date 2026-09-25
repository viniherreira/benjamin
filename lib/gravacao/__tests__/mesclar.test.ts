import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analisar, preparar } from '../../analysis';
import { mesclarCanais, removerEco, transcricaoDeUmCanal, type Canais } from '../mesclar';

const canais: Canais = {
  vendedor: [
    { inicio: 0, fim: 4, texto: 'Bom dia, Ricardo. Como está o fechamento contábil hoje?' },
    { inicio: 12, fim: 15, texto: 'E quanto tempo isso leva por mês?' },
    // eco: a resposta do cliente vazou do alto-falante para o microfone
    { inicio: 5.2, fim: 10.5, texto: 'fechamento demorado doze dias equipe reclama Protheus' },
    { inicio: 30, fim: 34, texto: 'Consigo mandar uma proposta até sexta-feira.' },
  ],
  cliente: [
    { inicio: 5, fim: 11, texto: 'Está demorado. São doze dias de fechamento e a equipe reclama do Protheus.' },
    { inicio: 16, fim: 28, texto: 'Doze dias, às vezes quinze. Estamos avaliando a Senior também, o budget de 200 mil está aprovado.' },
  ],
};

test('canais viram turnos em ordem de tempo, e o eco do alto-falante sai do lado do vendedor', () => {
  const { texto, ecosRemovidos } = mesclarCanais(canais, { vendedor: 'Ana Torres' });
  assert.equal(ecosRemovidos, 1);
  assert.deepEqual(texto.split('\n').map((l) => l.split(':')[0]), [
    'Ana Torres (Vendedor)',
    'Cliente',
    'Ana Torres (Vendedor)',
    'Cliente',
    'Ana Torres (Vendedor)',
  ]);
  assert.doesNotMatch(texto.split('\n')[0]!, /reclama/, 'eco não vira fala do vendedor');
});

test('fala parecida em outro momento não é eco', () => {
  const { removidos } = removerEco({
    vendedor: [{ inicio: 40, fim: 44, texto: 'são doze dias de fechamento e a equipe reclama' }],
    cliente: [{ inicio: 5, fim: 11, texto: 'São doze dias de fechamento e a equipe reclama do Protheus.' }],
  });
  assert.equal(removidos, 0);
});

test('o motor lê o canal: vendedor e cliente saem do lado certo, com talk ratio', () => {
  const { texto } = mesclarCanais(canais, { vendedor: 'Ana Torres' });
  const lados = Object.fromEntries(preparar(texto).falantes.map((f) => [f.nome, f.lado]));
  assert.deepEqual(lados, { 'Ana Torres': 'vendedor', Cliente: 'cliente' });
  const m = analisar({ texto }).conversation_metrics;
  assert.equal(typeof m.talk_ratio_seller, 'number', 'com os lados separados, talk ratio existe');
  assert.equal(typeof m.talk_ratio_customer, 'number');
  assert.ok(m.talk_ratio_customer! > m.talk_ratio_seller!, 'o cliente falou mais neste trecho');
});

test('sem nome do vendedor, o rótulo "Vendedor" ainda resolve os lados', () => {
  const { texto } = mesclarCanais(canais, { vendedor: '' });
  const lados = Object.fromEntries(preparar(texto).falantes.map((f) => [f.nome, f.lado]));
  assert.equal(lados['Vendedor'], 'vendedor');
  assert.equal(lados['Cliente'], 'cliente');
});

test('um canal só: parágrafos por pausa, sem rótulo inventado', () => {
  const t = transcricaoDeUmCanal([
    { inicio: 0, fim: 2, texto: 'Bom dia.' },
    { inicio: 2.3, fim: 4, texto: 'Vamos começar.' },
    { inicio: 7, fim: 9, texto: 'Pode sim.' },
  ]);
  assert.equal(t, 'Bom dia. Vamos começar.\nPode sim.');
});
