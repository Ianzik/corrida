import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarIntervalos, SEMANAS, duracaoTotal, TOTAL_SESSOES, nomeDaSessao } from '../js/plano.js';
import { reconciliar, linhaDoTempo } from '../js/sessao.js';

// localStorage falso para testar o armazenamento no Node
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
};
const arm = await import('../js/armazenamento.js');

test('plano tem 42 sessões e semana 1 dura 32 min', () => {
  assert.equal(TOTAL_SESSOES, 42);
  const s1 = gerarIntervalos(SEMANAS[0]);
  assert.equal(s1.length, 1 + 6 + 5 + 1);
  assert.equal(duracaoTotal(s1), 300 + 6 * 60 + 5 * 120 + 300);
  assert.equal(nomeDaSessao(4), 'Semana 2 · Sessão 2');
});

test('semana final é 30 min contínuos', () => {
  const s = gerarIntervalos(SEMANAS[13]);
  assert.deepEqual(s.map(b => b.descricao), ['Aquecimento', 'Corra', 'Desaquecimento']);
  assert.equal(s[1].segundos, 1800);
});

const blocos = [{ segundos: 10, tipo: 'caminhada' }, { segundos: 20, tipo: 'corrida' }, { segundos: 10, tipo: 'caminhada' }];

test('pausado não muda nada', () => {
  const r = reconciliar(blocos, { indice: 1, rodando: false, fimDoIntervalo: 0, segundosRestantes: 7 }, 1e12);
  assert.equal(r.indice, 1);
  assert.equal(r.segundosRestantes, 7);
  assert.equal(r.concluida, false);
});

test('meio do bloco atual', () => {
  const r = reconciliar(blocos, { indice: 0, rodando: true, fimDoIntervalo: 10_000, segundosRestantes: 10 }, 4_000);
  assert.equal(r.indice, 0);
  assert.equal(r.segundosRestantes, 6);
  assert.equal(r.avancou, 0);
});

test('app congelado atravessa blocos sem acumular atraso', () => {
  // bloco 0 terminava em 10s; agora são 35s -> bloco 2 (começou aos 30s, termina aos 40s)
  const r = reconciliar(blocos, { indice: 0, rodando: true, fimDoIntervalo: 10_000, segundosRestantes: 10 }, 35_000);
  assert.equal(r.indice, 2);
  assert.equal(r.fimDoIntervalo, 40_000);
  assert.equal(r.segundosRestantes, 5);
  assert.equal(r.avancou, 2);
});

test('app fechado até depois do fim conclui com o horário real de término', () => {
  const r = reconciliar(blocos, { indice: 0, rodando: true, fimDoIntervalo: 10_000, segundosRestantes: 10 }, 999_999);
  assert.equal(r.concluida, true);
  assert.equal(r.terminouEm, 40_000);
  assert.equal(r.rodando, false);
});

test('linha do tempo lista cada troca e o fim', () => {
  const l = linhaDoTempo(blocos, 0, 10_000);
  assert.deepEqual(l.map(e => [e.em, e.tipo]), [[10_000, 'corrida'], [30_000, 'caminhada'], [40_000, 'fim']]);
});

test('migra o progresso da versão antiga sem perder nada', () => {
  localStorage.setItem(arm.CHAVE_PROGRESSO, JSON.stringify({ concluidas: 5, versao: 1 }));
  const p = arm.carregarProgresso();
  assert.equal(p.concluidas, 5);
  assert.deepEqual(p.historico, []);
  assert.equal(p.versao, 2);
});

test('dado corrompido vira progresso zerado em vez de travar', () => {
  localStorage.setItem(arm.CHAVE_PROGRESSO, '{quebrado');
  assert.equal(arm.carregarProgresso().concluidas, 0);
  localStorage.setItem(arm.CHAVE_PROGRESSO, JSON.stringify({ concluidas: 999 }));
  assert.equal(arm.carregarProgresso().concluidas, 0);
});

test('concluir e desfazer', () => {
  const base = { versao: 2, concluidas: 3, historico: [] };
  const { novo, anterior } = arm.registrarConclusao(base, 3, 123, 'automatica');
  assert.equal(novo.concluidas, 4);
  assert.equal(novo.historico.length, 1);
  const volta = arm.desfazerConclusao(novo, anterior);
  assert.equal(volta.concluidas, 3);
  assert.equal(volta.historico.length, 0);
});

test('refazer uma sessão antiga não diminui o progresso', () => {
  const { novo } = arm.registrarConclusao({ versao: 2, concluidas: 10, historico: [] }, 2, 1, 'completa');
  assert.equal(novo.concluidas, 10);
});
