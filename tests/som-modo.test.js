import { test } from 'node:test';
import assert from 'node:assert/strict';

// localStorage falso, definido antes de importar o módulo
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
};
mem.set('treinoCorrida.somModo', 'alertas'); // salvo de uma sessão anterior

const m = await import('../js/som-modo.js');
const { montarAgenda, agendaParaModo } = await import('../js/avisos.js');
const { gerarIntervalos, SEMANAS } = await import('../js/plano.js');

test('modo salvo é lido ao carregar', () => {
  assert.equal(m.modoAtual(), 'alertas');
});

test('ciclo: voz, só alertas, sem som, e volta', () => {
  assert.deepEqual(m.MODOS, ['voz', 'alertas', 'mudo']);
  assert.equal(m.proximoModo('voz'), 'alertas');
  assert.equal(m.proximoModo('alertas'), 'mudo');
  assert.equal(m.proximoModo('mudo'), 'voz');
});

test('valor inválido vira "voz" (o comportamento de antes)', () => {
  assert.equal(m.normalizarModo('qualquer'), 'voz');
  assert.equal(m.normalizarModo(null), 'voz');
  assert.equal(m.proximoModo('lixo'), 'alertas');
});

test('o que cada modo permite', () => {
  assert.equal(m.tocaTom('voz'), true);
  assert.equal(m.tocaTom('alertas'), true);
  assert.equal(m.tocaTom('mudo'), false);
  assert.equal(m.falaVoz('voz'), true);
  assert.equal(m.falaVoz('alertas'), false);
  assert.equal(m.falaVoz('mudo'), false);
});

test('código para o serviço Android', () => {
  assert.equal(m.codigoNativo('mudo'), 0);
  assert.equal(m.codigoNativo('alertas'), 1);
  assert.equal(m.codigoNativo('voz'), 2);
  assert.equal(m.codigoNativo('lixo'), 2);
});

test('definir e alternar salvam, e os ouvintes são avisados', () => {
  const vistos = [];
  m.aoMudarDeModo(x => vistos.push(x));
  assert.equal(m.definirModo('mudo'), 'mudo');
  assert.equal(localStorage.getItem(m.CHAVE_SOM), 'mudo');
  assert.equal(m.alternarModo(), 'voz');
  assert.deepEqual(vistos, ['mudo', 'voz']);
});

test('texto dos blocos: "Corra · 1 de 6", e a voz continua dizendo "Corra, 1 de 6"', async () => {
  const { falaDoBloco } = await import('../js/avisos.js');
  const s = gerarIntervalos(SEMANAS[0]);
  assert.deepEqual(s.slice(0, 4).map(b => b.descricao), ['Aquecimento', 'Corra · 1 de 6', 'Caminhe · 1 de 5', 'Corra · 2 de 6']);
  assert.equal(falaDoBloco(s, 1), 'Corra, 1 de 6');
  assert.equal(falaDoBloco(s, 3), 'Corra, 2 de 6');
  assert.equal(falaDoBloco(s, 2), 'Caminhe');
});

test('agenda: só "voz" mantém a fala; os outros modos tocam só o tom', () => {
  const intervalos = gerarIntervalos(SEMANAS[0]);
  const agenda = montarAgenda(intervalos, 0, 1_000_000);
  const comFala = agenda.filter(i => i.fala);
  assert.ok(comFala.length > 0, 'a agenda de teste precisa ter fala');

  const voz = agendaParaModo(agenda, 'voz');
  assert.deepEqual(voz, agenda);

  for (const modo of ['alertas', 'mudo']) {
    const sem = agendaParaModo(agenda, modo);
    assert.equal(sem.length, agenda.length, 'não pode perder itens (o "fim" conclui a sessão)');
    assert.ok(sem.every(i => !i.fala), modo + ' ainda tem fala');
    assert.deepEqual(sem.map(i => [i.em, i.acao, i.indice]), agenda.map(i => [i.em, i.acao, i.indice]));
  }
  // a original não é alterada
  assert.ok(agenda.some(i => i.fala));
});
