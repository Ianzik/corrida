import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PASSOS, mesmoDia, passosDeHoje, proximoPasso } from '../js/dia.js';

// localStorage falso para testar o armazenamento no Node
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
};
const arm = await import('../js/armazenamento.js');

const dia = (a, m, d, h = 12, min = 0) => new Date(a, m - 1, d, h, min).getTime();
const AGORA = dia(2026, 10, 14, 17, 30);

test('mesmo dia: vira à meia-noite no horário do aparelho', () => {
  assert.equal(mesmoDia(dia(2026, 10, 14, 0, 1), dia(2026, 10, 14, 23, 59)), true);
  assert.equal(mesmoDia(dia(2026, 10, 14, 23, 59), dia(2026, 10, 15, 0, 1)), false);
  assert.equal(mesmoDia(dia(2026, 10, 14), dia(2025, 10, 14)), false);
});

test('passos do dia: nada feito hoje', () => {
  const f = passosDeHoje([], [], AGORA);
  assert.deepEqual(f, { ativar: false, corrida: false, recuperar: false });
  assert.equal(proximoPasso(f), 'ativar');
});

test('passos do dia: vem de rotinas e do histórico de hoje, não de ontem', () => {
  const rotinas = [
    { tipo: 'ativar', modalidade: 'corrida', em: dia(2026, 10, 14, 7) },
    { tipo: 'recuperar', modalidade: 'corrida', em: dia(2026, 10, 13, 8) },
  ];
  const historico = [{ posicao: 3, em: dia(2026, 10, 13, 8), tipo: 'completa' }];
  const f = passosDeHoje(rotinas, historico, AGORA);
  assert.deepEqual(f, { ativar: true, corrida: false, recuperar: false });
  assert.equal(proximoPasso(f), 'corrida');
});

test('rotina de musculação não conta para o dia de corrida', () => {
  const rotinas = [
    { tipo: 'ativar', modalidade: 'musculacao', em: dia(2026, 10, 14, 7) },
    { tipo: 'recuperar', modalidade: 'musculacao', em: dia(2026, 10, 14, 9) },
  ];
  const f = passosDeHoje(rotinas, [], AGORA);
  assert.deepEqual(f, { ativar: false, corrida: false, recuperar: false });
});

test('sequência completa: ativar, corrida, recuperar, dia concluído', () => {
  const ordem = [];
  let rotinas = [];
  let historico = [];
  for (let i = 0; i < 4; i++) {
    const p = proximoPasso(passosDeHoje(rotinas, historico, AGORA));
    ordem.push(p);
    if (p === 'ativar' || p === 'recuperar') rotinas = rotinas.concat([{ tipo: p, modalidade: 'corrida', em: AGORA }]);
    if (p === 'corrida') historico = historico.concat([{ posicao: 0, em: AGORA, tipo: 'completa' }]);
  }
  assert.deepEqual(ordem, ['ativar', 'corrida', 'recuperar', null]);
  assert.deepEqual(PASSOS, ['ativar', 'corrida', 'recuperar']);
});

test('quem correu sem ativar vai direto para recuperar', () => {
  const f = passosDeHoje([], [{ posicao: 0, em: AGORA, tipo: 'manual' }], AGORA);
  assert.equal(proximoPasso(f), 'recuperar');
});

test('registros estranhos não quebram', () => {
  const f = passosDeHoje([null, { tipo: 'ativar' }, 'x'], [null, { em: 'ontem' }], AGORA);
  assert.deepEqual(f, { ativar: false, corrida: false, recuperar: false });
  assert.deepEqual(passosDeHoje(undefined, undefined, AGORA), f);
});

// ---------------- armazenamento ----------------
test('armazenamento: rotina concluída é registrada e volta igual', () => {
  arm.registrarRotinaFeita('recuperar', 'corrida', AGORA);
  arm.registrarRotinaFeita('ativar', 'musculacao', AGORA + 1000);
  const r = arm.carregarRotinasFeitas();
  assert.equal(r.length, 2);
  assert.deepEqual(r[0], { tipo: 'recuperar', modalidade: 'corrida', em: AGORA });
});

test('armazenamento: lixo vira lista vazia e a lista não cresce sem limite', () => {
  localStorage.setItem(arm.CHAVE_ROTINAS_FEITAS, '{quebrado');
  assert.deepEqual(arm.carregarRotinasFeitas(), []);
  localStorage.setItem(arm.CHAVE_ROTINAS_FEITAS, JSON.stringify([{ tipo: 'x' }, 5, null]));
  assert.deepEqual(arm.carregarRotinasFeitas(), []);
  for (let i = 0; i < 100; i++) arm.registrarRotinaFeita('ativar', 'corrida', AGORA + i);
  assert.ok(arm.carregarRotinasFeitas().length <= 60);
});

test('armazenamento: zerar o progresso da corrida não apaga as rotinas feitas', () => {
  arm.registrarRotinaFeita('ativar', 'corrida', AGORA);
  arm.zerarProgresso();
  assert.ok(arm.carregarRotinasFeitas().length >= 1);
});
