import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EXERCICIOS, MOVIMENTOS } from '../js/biblioteca.js';
import {
  TIPOS, MODALIDADES, PARTES, TEMPOS,
  normalizarPerfil, notasPorRegiao, necessidades, focosDoPerfil,
  gerarRotina, lembrarRecentes, custoDoExercicio, montarEtapas, tipoDeTroca,
  rotuloAvancar, rotuloVoltar, planoDeVoltar, custoComPreparo, PREPARO_SEGUNDOS,
  perfisIguais, regioesTrabalhadas,
} from '../js/treino.js';
import { reconciliar } from '../js/sessao.js';

// localStorage falso para testar o armazenamento no Node
const mem = new Map();
globalThis.localStorage = {
  getItem: k => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: k => mem.delete(k),
};
const arm = await import('../js/armazenamento.js');

// Perfil de teste com a mesma forma de um teste real: cadeia posterior
// e rotação interna do ombro fracas, o resto bom.
const PERFIL_FRACO = {
  ombro_rot_interna: [45, 38],
  ombro_rot_externa: [100, 100],
  overhead: [84],
  torax_rotacao: [72, 75],
  quadris: [92],
  cadeia_posterior_flex: [39, 33],
  tornozelo_flexao: [100, 100],
};

// ---------------- biblioteca ----------------
test('biblioteca: ids únicos e campos válidos', () => {
  const ids = new Set();
  for (const e of EXERCICIOS) {
    assert.ok(!ids.has(e.id), 'id repetido: ' + e.id);
    ids.add(e.id);
    assert.ok(e.nome && e.instrucao, 'sem nome ou instrução: ' + e.id);
    assert.ok(e.segundos > 0, 'sem duração: ' + e.id);
    e.tipos.forEach(t => assert.ok(TIPOS.some(x => x.id === t), e.id + ' tipo ' + t));
    e.modalidades.forEach(m => assert.ok(MODALIDADES.some(x => x.id === m), e.id + ' modalidade ' + m));
    e.partes.forEach(p => assert.ok(PARTES.some(x => x.id === p), e.id + ' parte ' + p));
    e.movimentos.forEach(m => assert.ok(MOVIMENTOS[m], e.id + ' movimento ' + m));
    assert.ok(['passivo', 'ativo', 'ativacao', 'relaxamento'].includes(e.modo), e.id + ' modo');
    assert.ok(['chao', 'joelhos', 'em_pe'].includes(e.postura), e.id + ' postura');
  }
});

test('biblioteca: cada tipo e modalidade tem exercícios suficientes', () => {
  for (const t of TIPOS) for (const m of MODALIDADES) {
    const n = EXERCICIOS.filter(e => e.tipos.includes(t.id) && e.modalidades.includes(m.id)).length;
    assert.ok(n >= 6, t.id + ' + ' + m.id + ' tem só ' + n);
  }
});

// ---------------- perfil ----------------
test('perfil: lixo vira perfil vazio, números fora de 0..100 são descartados', () => {
  assert.deepEqual(normalizarPerfil(null), {});
  assert.deepEqual(normalizarPerfil('texto'), {});
  assert.deepEqual(normalizarPerfil({ overhead: [150, -3, 'a'], quadris: [80] }), { quadris: [80] });
  assert.deepEqual(normalizarPerfil({ chave_inventada: [50] }), {});
});

test('perfil: nota da região é a média dos valores dos movimentos', () => {
  const r = notasPorRegiao(PERFIL_FRACO);
  assert.equal(r.cadeiaPosterior, 36);
  assert.equal(r.ombros, 71);
  assert.equal(r.torax, 74);
  assert.equal(r.tornozelos, 100);
});

test('perfil: foco só inclui o que está abaixo do limite, do pior para o melhor', () => {
  // overhead 84 e quadris 92 estão acima de 80: não entram.
  const f = focosDoPerfil(PERFIL_FRACO, 5);
  assert.deepEqual(f.map(x => x.chave), ['cadeia_posterior_flex', 'ombro_rot_interna', 'torax_rotacao']);
  assert.equal(necessidades(PERFIL_FRACO).tornozelo_flexao, 0);
  assert.deepEqual(focosDoPerfil({}, 3), []);
});

// ---------------- geração ----------------
test('rotina: todas as combinações cabem no tempo e não vêm vazias', () => {
  for (const t of TIPOS) for (const m of MODALIDADES) for (const p of PARTES) for (const min of TEMPOS) {
    for (const perfil of [{}, PERFIL_FRACO]) {
      const r = gerarRotina({ tipo: t.id, modalidade: m.id, parte: p.id, minutos: min, perfil });
      const rotulo = [t.id, m.id, p.id, min].join('/');
      assert.ok(r.exercicios.length > 0, 'vazia: ' + rotulo);
      assert.ok(r.totalSegundos <= min * 60, 'estourou: ' + rotulo);
      // o menor exercício custa 35 s (30 + preparo) e o maior que cabe deixa até ~70 s
      assert.ok(min * 60 - r.totalSegundos < 70, 'sobrou tempo demais: ' + rotulo);
      // o total é a soma dos exercícios mais um preparo antes de cada um
      const soma = r.exercicios.reduce((s, e) => s + e.segundos + PREPARO_SEGUNDOS, 0);
      assert.equal(soma, r.totalSegundos, 'soma errada: ' + rotulo);
      assert.equal(new Set(r.exercicios.map(e => e.id)).size, r.exercicios.length, 'repetiu: ' + rotulo);
    }
  }
});

test('rotina: o que o teste mostrou fraco entra na rotina', () => {
  const r = gerarRotina({ tipo: 'diario', modalidade: 'corrida', parte: 'full', minutos: 6, perfil: PERFIL_FRACO });
  assert.ok(r.exercicios.some(e => e.movimentos.includes('cadeia_posterior_flex')));
  assert.ok(r.exercicios.some(e => e.movimentos.includes('ombro_rot_interna')));
  const fraco = r.exercicios.find(e => e.movimentos.includes('cadeia_posterior_flex'));
  assert.ok(fraco.motivos.includes('Cadeia posterior: flexibilidade'));
});

test('rotina: sem teste preenchido ainda funciona, sem foco', () => {
  const r = gerarRotina({ tipo: 'ativar', modalidade: 'corrida', parte: 'full', minutos: 3, perfil: {} });
  assert.ok(r.exercicios.length >= 2);
  assert.deepEqual(r.focos, []);
  assert.ok(r.exercicios.every(e => e.motivos.length === 0));
});

test('rotina: parte do corpo escolhida tem prioridade', () => {
  const r = gerarRotina({ tipo: 'diario', modalidade: 'musculacao', parte: 'ombros', minutos: 6, perfil: {} });
  const ombros = r.exercicios.filter(e => EXERCICIOS.find(x => x.id === e.id).partes.includes('ombros'));
  assert.ok(ombros.length >= Math.ceil(r.exercicios.length / 2));
});

test('rotina: ativar não traz alongamento passivo', () => {
  for (const m of MODALIDADES) for (const p of PARTES) {
    const r = gerarRotina({ tipo: 'ativar', modalidade: m.id, parte: p.id, minutos: 10, perfil: PERFIL_FRACO });
    assert.ok(r.exercicios.every(e => e.modo !== 'passivo'), m.id + '/' + p.id);
  }
});

test('rotina: ordem do chão para em pé, e o inverso em recuperar', () => {
  const ordem = { chao: 0, joelhos: 1, em_pe: 2 };
  const sobe = gerarRotina({ tipo: 'diario', modalidade: 'corrida', parte: 'full', minutos: 10, perfil: PERFIL_FRACO });
  const posturasSobe = sobe.exercicios.map(e => ordem[e.postura]);
  assert.deepEqual(posturasSobe, posturasSobe.slice().sort((a, b) => a - b));

  const desce = gerarRotina({ tipo: 'recuperar', modalidade: 'corrida', parte: 'full', minutos: 10, perfil: PERFIL_FRACO });
  const posturasDesce = desce.exercicios.map(e => ordem[e.postura]);
  assert.deepEqual(posturasDesce, posturasDesce.slice().sort((a, b) => b - a));
});

test('rotina: é determinística com as mesmas entradas', () => {
  const o = { tipo: 'recuperar', modalidade: 'futevolei', parte: 'pernas', minutos: 6, perfil: PERFIL_FRACO, recentes: ['pombo'] };
  assert.deepEqual(gerarRotina(o), gerarRotina(o));
});

test('rotina: mostrar de novo troca parte dos exercícios (rodízio)', () => {
  const base = { tipo: 'diario', modalidade: 'corrida', parte: 'full', minutos: 10, perfil: {} };
  const a = gerarRotina(base);
  const recentes = lembrarRecentes([], a);
  const b = gerarRotina({ ...base, recentes });
  const idsA = new Set(a.exercicios.map(e => e.id));
  assert.ok(b.exercicios.some(e => !idsA.has(e.id)), 'segunda rotina igual à primeira');
});

test('rotina: opção inválida dá erro claro', () => {
  assert.throws(() => gerarRotina({ tipo: 'x', modalidade: 'corrida', parte: 'full', minutos: 6 }), /tipo inválido/);
  assert.throws(() => gerarRotina({ tipo: 'ativar', modalidade: 'corrida', parte: 'full', minutos: 7 }), /tempo inválido/);
});

test('custo: exercício por lado custa o dobro', () => {
  assert.equal(custoDoExercicio({ porLado: true, segundos: 40 }), 80);
  assert.equal(custoDoExercicio({ porLado: false, segundos: 40 }), 40);
});

// ---------------- etapas do cronômetro ----------------
test('etapas: a soma das etapas é exatamente o tempo da rotina', () => {
  for (const t of TIPOS) for (const m of MODALIDADES) for (const min of TEMPOS) {
    const r = gerarRotina({ tipo: t.id, modalidade: m.id, parte: 'full', minutos: min, perfil: PERFIL_FRACO });
    const etapas = montarEtapas(r);
    assert.equal(etapas.reduce((s, e) => s + e.segundos, 0), r.totalSegundos, [t.id, m.id, min].join('/'));
  }
});

test('etapas: exercício com dois lados vira duas etapas, na ordem', () => {
  const r = { exercicios: [
    { porLado: false, segundos: 45, segundosPorLado: 45 },
    { porLado: true, segundos: 80, segundosPorLado: 40 },
    { porLado: false, segundos: 60, segundosPorLado: 60 },
  ] };
  const e = montarEtapas(r);
  // [exercício, lado, lados, segundos]; o 5 é o preparo antes de cada exercício
  assert.deepEqual(e.map(x => [x.exercicio, x.lado, x.lados, x.segundos]), [
    [0, 0, 1, 5], [0, 0, 1, 45],
    [1, 0, 1, 5], [1, 1, 2, 40], [1, 2, 2, 40],
    [2, 0, 1, 5], [2, 0, 1, 60],
  ]);
  assert.deepEqual(e.map(x => x.preparo), [true, false, true, false, false, true, false]);
  assert.deepEqual(e.map((_, i) => tipoDeTroca(e, i)),
    ['inicio', 'exercicio', 'preparo', 'exercicio', 'lado', 'preparo', 'exercicio']);
});

test('custo: cada exercício consome o preparo junto', () => {
  assert.equal(custoComPreparo({ porLado: true, segundos: 40 }), 80 + PREPARO_SEGUNDOS);
  assert.equal(PREPARO_SEGUNDOS, 5);
});

test('rotina: cada exercício é precedido de um preparo nas etapas', () => {
  const r = gerarRotina({ tipo: 'diario', modalidade: 'corrida', parte: 'full', minutos: 10, perfil: PERFIL_FRACO });
  const etapas = montarEtapas(r);
  r.exercicios.forEach((_, i) => {
    const primeira = etapas.findIndex(x => x.exercicio === i);
    assert.equal(etapas[primeira].preparo, true, 'exercício ' + i + ' sem preparo');
  });
  assert.equal(etapas.reduce((s, x) => s + x.segundos, 0), r.totalSegundos);
});

test('rótulos dos botões dizem o que o botão faz', () => {
  // exercício 0 sem lados; exercício 1 com dois lados; exercício 2 sem lados
  const e = montarEtapas({ exercicios: [
    { porLado: false, segundos: 45, segundosPorLado: 45 },
    { porLado: true, segundos: 80, segundosPorLado: 40 },
    { porLado: false, segundos: 60, segundosPorLado: 60 },
  ] });
  // etapas: 0 preparo A | 1 A | 2 preparo B | 3 B lado 1 | 4 B lado 2 | 5 preparo C | 6 C
  assert.equal(e.length, 7);
  // avançar
  assert.equal(rotuloAvancar(e, 0), 'Começar agora');      // preparo
  assert.equal(rotuloAvancar(e, 1), 'Próximo exercício');  // A -> preparo de B
  assert.equal(rotuloAvancar(e, 2), 'Começar agora');
  assert.equal(rotuloAvancar(e, 3), 'Próximo lado');       // lado 1 -> lado 2
  assert.equal(rotuloAvancar(e, 4), 'Próximo exercício');  // lado 2 -> preparo de C
  assert.equal(rotuloAvancar(e, 6), null);                 // última etapa
  // voltar: logo no começo volta (pulando o preparo); depois de 2 s recomeça
  assert.equal(rotuloVoltar(e, 0, 5), null);               // nada a fazer
  assert.equal(rotuloVoltar(e, 0, 2), 'Recomeçar');
  assert.equal(rotuloVoltar(e, 1, 45), null);              // primeiro exercício, recém começou
  assert.equal(rotuloVoltar(e, 1, 30), 'Recomeçar');
  assert.equal(rotuloVoltar(e, 2, 5), 'Exercício anterior');
  assert.equal(rotuloVoltar(e, 3, 40), 'Exercício anterior');
  assert.equal(rotuloVoltar(e, 4, 40), 'Lado anterior');
  assert.equal(rotuloVoltar(e, 4, 30), 'Recomeçar');
  assert.equal(rotuloVoltar(e, 6, 59), 'Exercício anterior'); // passou 1 s: ainda volta
  // para onde cada voltar leva (nunca para um preparo)
  assert.equal(planoDeVoltar(e, 3, 40).alvo, 1);
  assert.equal(planoDeVoltar(e, 6, 59).alvo, 4);
  assert.equal(planoDeVoltar(e, 2, 5).alvo, 1);
  assert.equal(planoDeVoltar(e, 4, 40).alvo, 3);
  assert.equal(planoDeVoltar(e, 6, 30).acao, 'recomecar');
});

test('perfis: comparar notas ignora lixo e ordem das chaves', () => {
  assert.equal(perfisIguais({}, {}), true);
  assert.equal(perfisIguais(PERFIL_FRACO, { ...PERFIL_FRACO }), true);
  assert.equal(perfisIguais(PERFIL_FRACO, { ...PERFIL_FRACO, overhead: [85] }), false);
  assert.equal(perfisIguais(PERFIL_FRACO, {}), false);
  assert.equal(perfisIguais({ overhead: [84], lixo: 1 }, { overhead: [84] }), true);
  assert.equal(perfisIguais(null, {}), true);
});

test('regiões trabalhadas: ordena por tempo e ignora o que não tem movimento', () => {
  const rotina = { exercicios: [
    { segundos: 80, movimentos: ['cadeia_posterior_flex'] },
    { segundos: 60, movimentos: ['quadris', 'tornozelo_flexao'] }, // 30 s para cada região
    { segundos: 40, movimentos: ['quadris'] },
    { segundos: 60, movimentos: [] },                              // respiração: não conta
  ] };
  // cadeia posterior 80, quadris 70, tornozelos 30
  assert.deepEqual(regioesTrabalhadas(rotina), ['Cadeia posterior', 'Quadris', 'Tornozelos']);
  assert.deepEqual(regioesTrabalhadas(rotina, 2), ['Cadeia posterior', 'Quadris']);
  assert.deepEqual(regioesTrabalhadas({ exercicios: [{ segundos: 60, movimentos: [] }] }), []);
});

test('regiões trabalhadas: funciona com uma rotina gerada de verdade', () => {
  const r = gerarRotina({ tipo: 'recuperar', modalidade: 'corrida', parte: 'pernas', minutos: 10, perfil: PERFIL_FRACO });
  const regioes = regioesTrabalhadas(r);
  assert.ok(regioes.length >= 1 && regioes.length <= 4);
  assert.equal(new Set(regioes).size, regioes.length);
});

test('etapas: funcionam no relógio da corrida (reconciliar)', () => {
  const etapas = [{ segundos: 10 }, { segundos: 20 }, { segundos: 10 }];
  const a = reconciliar(etapas, { indice: 0, rodando: true, fimDoIntervalo: 10_000, segundosRestantes: 10 }, 12_000);
  assert.equal(a.indice, 1);
  assert.equal(a.segundosRestantes, 18);
  assert.equal(a.avancou, 1);
  const fim = reconciliar(etapas, { indice: 0, rodando: true, fimDoIntervalo: 10_000, segundosRestantes: 10 }, 99_000);
  assert.equal(fim.concluida, true);
});

// ---------------- armazenamento ----------------
test('armazenamento: perfil salvo volta igual e lixo vira vazio', () => {
  arm.salvarPerfilMobilidade(PERFIL_FRACO);
  assert.deepEqual(arm.carregarPerfilMobilidade(), PERFIL_FRACO);
  localStorage.setItem(arm.CHAVE_MOBILIDADE, '{quebrado');
  assert.deepEqual(arm.carregarPerfilMobilidade(), {});
});

test('armazenamento: rotina guarda escolha e recentes, e valida o formato', () => {
  arm.salvarRotina({ escolha: { tipo: 'recuperar', modalidade: 'corrida', parte: 'pernas', minutos: 10 }, recentes: ['pombo', 'borboleta'] });
  const r = arm.carregarRotina();
  assert.equal(r.escolha.tipo, 'recuperar');
  assert.deepEqual(r.recentes, ['pombo', 'borboleta']);

  localStorage.setItem(arm.CHAVE_ROTINA, JSON.stringify({ escolha: { tipo: 'invalido' }, recentes: 'nao-lista' }));
  const ruim = arm.carregarRotina();
  assert.equal(ruim.escolha, null);
  assert.deepEqual(ruim.recentes, []);
});

test('armazenamento: zerar o progresso não apaga o perfil de mobilidade', () => {
  arm.salvarPerfilMobilidade(PERFIL_FRACO);
  arm.zerarProgresso();
  assert.deepEqual(arm.carregarPerfilMobilidade(), PERFIL_FRACO);
});
