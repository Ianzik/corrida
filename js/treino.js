// ====================================================================
// ROTINA DE MOBILIDADE
// Recebe o que você escolheu (tipo, modalidade, parte do corpo, tempo)
// e o seu teste de mobilidade, e devolve a sequência de exercícios.
// Não mexe na tela: pode ser testado sozinho.
//
// Como a sequência é montada:
//  1. Filtra a biblioteca por tipo, modalidade e parte do corpo.
//  2. Dá nota a cada exercício: pesa mais o que trabalha um movimento
//     em que o seu teste foi fraco, e menos o que você fez há pouco.
//  3. Vai pegando os melhores até caber no tempo escolhido.
//  4. Ordena: do chão para em pé (ativar e diário) ou de pé para o
//     chão (recuperar).
// ====================================================================

import { EXERCICIOS, MOVIMENTOS, REGIOES } from './biblioteca.js';

export const TIPOS = [
  { id: 'ativar', nome: 'Ativar' },
  { id: 'recuperar', nome: 'Recuperar' },
  { id: 'diario', nome: 'Diário' },
];
export const MODALIDADES = [
  { id: 'corrida', nome: 'Corrida' },
  { id: 'musculacao', nome: 'Musculação' },
  { id: 'futevolei', nome: 'Futevôlei' },
];
export const PARTES = [
  { id: 'full', nome: 'Corpo todo' },
  { id: 'peitoral', nome: 'Peitoral' },
  { id: 'costas', nome: 'Costas' },
  { id: 'bracos', nome: 'Braços' },
  { id: 'ombros', nome: 'Ombros' },
  { id: 'pernas', nome: 'Pernas' },
];
export const TEMPOS = [3, 6, 10];

// Nota do teste (0 a 100) abaixo da qual o movimento entra no foco.
export const LIMITE_FOCO = 80;

// Antes de cada exercício há uma contagem de preparo (para se posicionar
// e para o app dizer qual vem). Ela entra no tempo escolhido: 3, 6 ou 10 min.
export const PREPARO_SEGUNDOS = 5;

const PESO_FOCO = 3;
const PESO_PARTE = 1.5;
const PESO_RECENTE = 1.5;
const PESO_REPETIDO = 0.75;
const TETO_FOCO = 1.5;
const MEMORIA_RECENTES = 12;

const ORDEM_POSTURA = { chao: 0, joelhos: 1, em_pe: 2 };
const ORDEM_MODO = { relaxamento: -1, passivo: 0, ativacao: 1, ativo: 2 };

// ---------------- perfil de mobilidade ----------------
// perfil = { ombro_rot_interna: [45, 38], overhead: [84], ... }
// Aceita lixo (null, texto, números fora de 0..100) e devolve só o que presta.
export function normalizarPerfil(dados) {
  const perfil = {};
  if (!dados || typeof dados !== 'object') return perfil;
  Object.keys(MOVIMENTOS).forEach(chave => {
    const bruto = dados[chave];
    if (!Array.isArray(bruto)) return;
    const valores = bruto
      .slice(0, 2)
      .filter(v => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100);
    if (valores.length > 0) perfil[chave] = valores;
  });
  return perfil;
}

// Dois testes de mobilidade têm exatamente as mesmas notas?
export function perfisIguais(a, b) {
  const x = normalizarPerfil(a);
  const y = normalizarPerfil(b);
  return Object.keys(MOVIMENTOS).every(k => JSON.stringify(x[k] || null) === JSON.stringify(y[k] || null));
}

function media(valores) {
  return valores.reduce((s, v) => s + v, 0) / valores.length;
}

// Nota de um movimento (média dos lados) ou null se não há dado.
export function notaDoMovimento(perfil, chave) {
  const v = perfil && perfil[chave];
  return Array.isArray(v) && v.length > 0 ? media(v) : null;
}

// Nota por região = média de todos os valores dos movimentos dela.
export function notasPorRegiao(perfil) {
  const resultado = {};
  Object.keys(REGIOES).forEach(regiao => {
    const valores = [];
    Object.keys(MOVIMENTOS).forEach(chave => {
      if (MOVIMENTOS[chave].regiao === regiao && perfil && Array.isArray(perfil[chave])) {
        valores.push(...perfil[chave]);
      }
    });
    resultado[regiao] = valores.length > 0 ? Math.round(media(valores)) : null;
  });
  return resultado;
}

// Quanto cada movimento precisa de atenção: 0 (nada) a 1 (muito).
export function necessidades(perfil) {
  const n = {};
  Object.keys(MOVIMENTOS).forEach(chave => {
    const nota = notaDoMovimento(perfil, chave);
    n[chave] = nota === null ? 0 : Math.max(0, (LIMITE_FOCO - nota) / LIMITE_FOCO);
  });
  return n;
}

// Os movimentos que mais precisam de atenção, do pior para o melhor.
export function focosDoPerfil(perfil, maximo) {
  const n = necessidades(perfil);
  return Object.keys(MOVIMENTOS)
    .filter(chave => n[chave] > 0)
    .map(chave => ({
      chave,
      nome: MOVIMENTOS[chave].nome,
      nota: Math.round(notaDoMovimento(perfil, chave)),
      necessidade: n[chave],
    }))
    .sort((a, b) => b.necessidade - a.necessidade || (a.chave < b.chave ? -1 : 1))
    .slice(0, maximo || 3);
}

// ---------------- rotina ----------------
export function custoDoExercicio(e) {
  return e.porLado ? e.segundos * 2 : e.segundos;
}

// O que o exercício consome do tempo da rotina: ele mesmo mais o preparo.
export function custoComPreparo(e) {
  return custoDoExercicio(e) + PREPARO_SEGUNDOS;
}

function notaDeParte(e, parte) {
  if (parte === 'full') return 1;
  if (e.partes.includes(parte)) return 2;
  if (e.partes.includes('full')) return 1;
  return 0;
}

function focoDoExercicio(e, n) {
  const soma = e.movimentos.reduce((s, m) => s + (n[m] || 0), 0);
  return Math.min(soma, TETO_FOCO);
}

function validar(lista, id, rotulo) {
  if (!lista.some(item => (item.id !== undefined ? item.id : item) === id)) {
    throw new Error(rotulo + ' inválido: ' + id);
  }
}

// opcoes: { tipo, modalidade, parte, minutos, perfil, recentes }
//  recentes: ids dos últimos exercícios mostrados (o mais novo por último)
export function gerarRotina(opcoes) {
  const { tipo, modalidade, parte, minutos } = opcoes;
  validar(TIPOS, tipo, 'tipo');
  validar(MODALIDADES, modalidade, 'modalidade');
  validar(PARTES, parte, 'parte do corpo');
  validar(TEMPOS, minutos, 'tempo');

  const perfil = normalizarPerfil(opcoes.perfil);
  const recentes = Array.isArray(opcoes.recentes) ? opcoes.recentes : [];
  const orcamento = minutos * 60;
  const n = necessidades(perfil);

  const base = EXERCICIOS.filter(e => e.tipos.includes(tipo) && e.modalidades.includes(modalidade));
  let pool = parte === 'full' ? base : base.filter(e => notaDeParte(e, parte) > 0);
  // Poucos exercícios para a parte pedida: completa com os demais do tipo.
  if (pool.reduce((s, e) => s + custoComPreparo(e), 0) < orcamento) pool = base;

  const escolhidos = [];
  let restante = orcamento;
  const movimentosUsados = {};
  const recentesAtivos = recentes.slice(-MEMORIA_RECENTES);

  // Pega o melhor exercício do grupo que ainda cabe, até não caber mais.
  function preencher(grupo) {
    while (true) {
      let melhor = null;
      let melhorNota = -Infinity;
      for (const e of grupo) {
        if (escolhidos.includes(e) || custoComPreparo(e) > restante) continue;
        const repetidos = e.movimentos.reduce((s, m) => s + (movimentosUsados[m] || 0), 0);
        const nota =
          PESO_FOCO * focoDoExercicio(e, n) +
          PESO_PARTE * notaDeParte(e, parte) +
          (e.modalidades.length < 3 ? 0.5 : 0) -
          (recentesAtivos.includes(e.id) ? PESO_RECENTE : 0) -
          PESO_REPETIDO * repetidos;
        if (nota > melhorNota) { melhor = e; melhorNota = nota; }
      }
      if (melhor === null) return;
      escolhidos.push(melhor);
      restante -= custoComPreparo(melhor);
      melhor.movimentos.forEach(m => { movimentosUsados[m] = (movimentosUsados[m] || 0) + 1; });
    }
  }

  preencher(pool);
  // Sobrou tempo e nada da parte pedida cabe: completa com o resto do tipo.
  if (pool !== base) preencher(base);

  // Ordem: ativar e diário vão do chão para em pé; recuperar faz o contrário.
  const sentido = tipo === 'recuperar' ? -1 : 1;
  const ordenados = escolhidos
    .map((e, i) => ({ e, i }))
    .sort((a, b) =>
      sentido * (ORDEM_POSTURA[a.e.postura] - ORDEM_POSTURA[b.e.postura]) ||
      sentido * (ORDEM_MODO[a.e.modo] - ORDEM_MODO[b.e.modo]) ||
      a.i - b.i)
    .map(x => x.e);

  const exercicios = ordenados.map(e => {
    const motivos = e.movimentos
      .filter(m => n[m] > 0)
      .map(m => MOVIMENTOS[m].nome);
    return {
      id: e.id,
      nome: e.nome,
      instrucao: e.instrucao,
      modo: e.modo,
      postura: e.postura,
      porLado: e.porLado,
      segundosPorLado: e.segundos,
      segundos: custoDoExercicio(e),
      preparoSegundos: PREPARO_SEGUNDOS,
      movimentos: e.movimentos.slice(),
      motivos,
    };
  });

  return {
    exercicios,
    orcamentoSegundos: orcamento,
    // inclui os preparos: é o tempo real da rotina, do toque em Iniciar ao fim
    totalSegundos: orcamento - restante,
    focos: focosDoPerfil(perfil, 3),
  };
}

// Transforma a rotina em etapas de cronômetro. Cada exercício vem precedido
// de uma etapa de preparo; exercício feito dos dois lados vira duas etapas
// seguidas. Cada etapa: { segundos, exercicio (posição na rotina),
// lado (1 ou 2; 0 se não tem lados), lados (1 ou 2), preparo (true/false) }.
// Tem o campo "segundos", então serve ao mesmo relógio da corrida.
export function montarEtapas(rotina) {
  const etapas = [];
  rotina.exercicios.forEach((e, exercicio) => {
    etapas.push({
      segundos: e.preparoSegundos === undefined ? PREPARO_SEGUNDOS : e.preparoSegundos,
      exercicio, lado: 0, lados: 1, preparo: true,
    });
    if (e.porLado) {
      for (let lado = 1; lado <= 2; lado++) {
        etapas.push({ segundos: e.segundosPorLado, exercicio, lado, lados: 2, preparo: false });
      }
    } else {
      etapas.push({ segundos: e.segundos, exercicio, lado: 0, lados: 1, preparo: false });
    }
  });
  return etapas;
}

// O que avisar ao entrar na etapa "indice":
//  'inicio'    a primeira etapa (o preparo do primeiro exercício)
//  'preparo'   começou o preparo do próximo exercício: dizer qual é
//  'exercicio' o preparo acabou e o exercício começa
//  'lado'      mesmo exercício, agora do outro lado
export function tipoDeTroca(etapas, indice) {
  if (indice <= 0) return 'inicio';
  const atual = etapas[indice];
  if (atual.preparo) return 'preparo';
  return etapas[indice - 1].exercicio === atual.exercicio && !etapas[indice - 1].preparo
    ? 'lado'
    : 'exercicio';
}

// Rótulos dos botões do cronômetro, conforme o que cada um faz de verdade.
// Devolvem null quando o botão não tem o que fazer (fica desabilitado).
export function rotuloAvancar(etapas, indice) {
  const proxima = etapas[indice + 1];
  if (!proxima) return null;
  const atual = etapas[indice];
  if (atual.preparo) return 'Começar agora';
  return proxima.exercicio === atual.exercicio ? 'Próximo lado' : 'Próximo exercício';
}

// O que o botão de voltar faz: se a etapa já passou de 2 s, recomeça; senão
// volta uma etapa, pulando o preparo (voltar para uma contagem de 5 s não
// ajuda ninguém). { acao: 'recomecar' | 'ir' | null, alvo, rotulo }
export function planoDeVoltar(etapas, indice, segundosRestantes) {
  const atual = etapas[indice];
  const passou = atual.segundos - segundosRestantes;
  if (passou > 2) return { acao: 'recomecar', alvo: indice, rotulo: 'Recomeçar' };

  let alvo = indice - 1;
  if (alvo >= 0 && etapas[alvo].preparo && !atual.preparo) alvo -= 1;
  if (alvo < 0) {
    return passou > 0
      ? { acao: 'recomecar', alvo: indice, rotulo: 'Recomeçar' }
      : { acao: null, alvo: null, rotulo: null };
  }
  const mesmoExercicio = etapas[alvo].exercicio === atual.exercicio;
  return { acao: 'ir', alvo, rotulo: mesmoExercicio ? 'Lado anterior' : 'Exercício anterior' };
}

export function rotuloVoltar(etapas, indice, segundosRestantes) {
  return planoDeVoltar(etapas, indice, segundosRestantes).rotulo;
}

// Quais regiões do corpo a rotina trabalhou, da que mais ganhou tempo para a
// que menos ganhou (tempo do exercício dividido entre os movimentos dele).
// Exercícios sem movimento do teste (respiração, caminhada) não contam.
export function regioesTrabalhadas(rotina, maximo) {
  const peso = {};
  rotina.exercicios.forEach(e => {
    const movs = (e.movimentos || []).filter(m => MOVIMENTOS[m]);
    movs.forEach(m => {
      const regiao = MOVIMENTOS[m].regiao;
      peso[regiao] = (peso[regiao] || 0) + e.segundos / movs.length;
    });
  });
  return Object.keys(peso)
    .sort((a, b) => peso[b] - peso[a] || (a < b ? -1 : 1))
    .slice(0, maximo || 4)
    .map(r => REGIOES[r]);
}

// Junta os ids da rotina nova aos recentes, sem estourar a memória.
export function lembrarRecentes(recentes, rotina) {
  const antigos = Array.isArray(recentes) ? recentes : [];
  return antigos.concat(rotina.exercicios.map(e => e.id)).slice(-MEMORIA_RECENTES * 2);
}
