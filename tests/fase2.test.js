import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gerarIntervalos, SEMANAS } from '../js/plano.js';
import { falaDoBloco, montarAgenda } from '../js/avisos.js';
import { gerarExportacao, lerImportacao, juntarProgressos, aplicarConclusoes } from '../js/transferencia.js';
import { ehAppNativo } from '../js/nativo.js';

const semana1 = gerarIntervalos(SEMANAS[0]);

test('falas em português para cada tipo de bloco', () => {
  assert.equal(falaDoBloco(semana1, 0), 'Aquecimento, 5 minutos');
  assert.equal(falaDoBloco(semana1, 1), 'Corra, 1 de 6');
  assert.equal(falaDoBloco(semana1, 5), 'Corra, 3 de 6');
  assert.equal(falaDoBloco(semana1, 2), 'Caminhe');
  assert.equal(falaDoBloco(semana1, semana1.length - 1), 'Últimos 5 minutos de desaquecimento');
  assert.equal(falaDoBloco(semana1, semana1.length), 'Sessão concluída');
  // semana final: corrida única, sem "1 de 1"
  assert.equal(falaDoBloco(gerarIntervalos(SEMANAS[13]), 1), 'Corra');
});

test('agenda: 3 bipes antes de cada troca, no segundo exato', () => {
  const inicio = 1_000_000;
  const fim0 = inicio + 300_000; // aquecimento de 5 min
  const agenda = montarAgenda(semana1, 0, fim0);
  // 12 trocas + fim = 13 eventos, cada um com 3 bipes
  assert.equal(agenda.length, 13 * 4);
  assert.deepEqual(agenda.slice(0, 4).map(a => [a.em - fim0, a.acao]), [
    [-3000, 'bip'], [-2000, 'bip'], [-1000, 'bip'], [0, 'troca'],
  ]);
  const primeira = agenda[3];
  assert.equal(primeira.tipo, 'corrida');
  assert.equal(primeira.fala, 'Corra, 1 de 6');
  assert.equal(primeira.fimDoBloco, fim0 + 60_000);
  const ultimo = agenda[agenda.length - 1];
  assert.equal(ultimo.acao, 'fim');
  assert.equal(ultimo.fala, 'Sessão concluída');
  assert.equal(ultimo.fimDoBloco, null);
  // semana 1 dura 26 min no total (5 + 6×1 + 5×2 + 5)
  assert.equal(ultimo.em - inicio, 26 * 60_000);
});

test('agenda a partir do meio da sessão só tem o que falta', () => {
  const agenda = montarAgenda(semana1, 11, 5_000_000); // último bloco de corrida
  const trocas = agenda.filter(a => a.acao !== 'bip');
  assert.deepEqual(trocas.map(t => t.fala), ['Últimos 5 minutos de desaquecimento', 'Sessão concluída']);
  assert.equal(trocas[1].em, 5_000_000 + 300_000);
});

test('exportar e importar devolve o mesmo progresso', () => {
  const p = { versao: 2, concluidas: 7, historico: [{ posicao: 6, em: 123, tipo: 'completa' }] };
  const r = lerImportacao(gerarExportacao(p, 999));
  assert.equal(r.ok, true);
  assert.deepEqual(r.progresso, p);
});

test('importar texto errado dá mensagem em vez de quebrar', () => {
  assert.equal(lerImportacao('bla').ok, false);
  assert.equal(lerImportacao('{"a":1}').ok, false);
  assert.equal(lerImportacao(JSON.stringify({ formato: 'treino-corrida', progresso: { concluidas: 99 } })).ok, false);
  assert.match(lerImportacao('').erro, /copiou tudo/);
});

test('juntar fica com o maior avanço e soma os históricos sem repetir', () => {
  const chrome = { versao: 2, concluidas: 5, historico: [
    { posicao: 3, em: 1_000_000, tipo: 'completa' },
    { posicao: 4, em: 2_000_000, tipo: 'completa' },
  ] };
  const app = { versao: 2, concluidas: 4, historico: [
    { posicao: 3, em: 1_030_000, tipo: 'automatica' }, // mesma sessão, 30 s de diferença
    { posicao: 1, em: 500_000, tipo: 'completa' },
  ] };
  const j = juntarProgressos(app, chrome);
  assert.equal(j.concluidas, 5);
  assert.deepEqual(j.historico.map(h => h.posicao), [1, 3, 4]);
  // juntar de novo não muda nada
  assert.deepEqual(juntarProgressos(j, chrome), j);
});

test('conclusões do serviço Android: aplica uma vez só', () => {
  const p = { versao: 2, concluidas: 2, historico: [] };
  const pend = [{ posicao: 2, em: 10_000_000, tipo: 'completa' }];
  const r1 = aplicarConclusoes(p, pend);
  assert.equal(r1.progresso.concluidas, 3);
  assert.equal(r1.aplicadas.length, 1);
  assert.equal(r1.aplicadas[0].anterior, 2);
  // o site já tinha registrado a mesma sessão (cronômetro do site terminou junto)
  const r2 = aplicarConclusoes(r1.progresso, [{ posicao: 2, em: 10_000_800, tipo: 'completa' }]);
  assert.equal(r2.aplicadas.length, 0);
  assert.equal(r2.progresso.historico.length, 1);
  // lixo é ignorado
  const r3 = aplicarConclusoes(p, [null, { posicao: 'x' }, { posicao: 500, em: 1 }]);
  assert.equal(r3.aplicadas.length, 0);
});

test('fora do app Android, nada nativo é ativado', async () => {
  assert.equal(ehAppNativo(), false);
  const alertas = await import('../js/alertas.js');
  assert.equal(alertas.precisaTelaAcesa(), true);
  assert.equal(await alertas.lerEstadoExterno(), null);
  alertas.sincronizar({ ativa: true }); // não pode quebrar nem chamar nada
});
