// ====================================================================
// EXPORTAR / IMPORTAR PROGRESSO
// O app Android e o Chrome guardam o progresso em lugares diferentes.
// Isto gera um texto que você leva de um para o outro. Ao importar,
// os dois progressos são JUNTADOS: vale o maior avanço e os históricos
// se somam, sem repetir. Nada é apagado.
// ====================================================================

import { normalizarProgresso, registrarConclusao } from './armazenamento.js';
import { TOTAL_SESSOES } from './plano.js';

const FORMATO = 'treino-corrida';

export function gerarExportacao(progresso, agora) {
  return JSON.stringify({
    formato: FORMATO,
    exportadoEm: agora,
    progresso: normalizarProgresso(progresso),
  });
}

// Devolve { ok: true, progresso } ou { ok: false, erro } com uma
// mensagem para mostrar na tela.
export function lerImportacao(texto) {
  let dados;
  try {
    dados = JSON.parse(String(texto).trim());
  } catch (e) {
    return { ok: false, erro: 'O texto não parece ser um progresso exportado. Confira se copiou tudo.' };
  }
  if (!dados || dados.formato !== FORMATO || !dados.progresso) {
    return { ok: false, erro: 'Este texto não veio do Treino de Corrida.' };
  }
  const n = dados.progresso.concluidas;
  if (typeof n !== 'number' || n < 0 || n > TOTAL_SESSOES) {
    return { ok: false, erro: 'O progresso dentro do texto está danificado.' };
  }
  return { ok: true, progresso: normalizarProgresso(dados.progresso) };
}

// Duas conclusões são "a mesma" se forem da mesma sessão e tiverem
// terminado com menos de 2 minutos de diferença.
const TOLERANCIA = 2 * 60 * 1000;

export function mesmaConclusao(a, b) {
  return a.posicao === b.posicao && Math.abs(a.em - b.em) < TOLERANCIA;
}

export function juntarProgressos(atual, importado) {
  const a = normalizarProgresso(atual);
  const b = normalizarProgresso(importado);
  const historico = a.historico.slice();
  b.historico.forEach(h => {
    if (!historico.some(x => mesmaConclusao(x, h))) historico.push(h);
  });
  historico.sort((x, y) => x.em - y.em);
  return {
    versao: 2,
    concluidas: Math.max(a.concluidas, b.concluidas),
    historico: historico.slice(-200),
  };
}

// Conclusões que o serviço do Android registrou enquanto o app estava
// fechado. Aplica cada uma que ainda não esteja no histórico.
// Devolve o progresso novo e a lista do que foi de fato aplicado,
// com o "anterior" de cada uma (para o botão Desfazer).
export function aplicarConclusoes(progresso, pendentes) {
  let atual = progresso;
  const aplicadas = [];
  (pendentes || []).forEach(c => {
    if (!c || typeof c.posicao !== 'number' || typeof c.em !== 'number') return;
    if (c.posicao < 0 || c.posicao >= TOTAL_SESSOES) return;
    if (atual.historico.some(h => mesmaConclusao(h, c))) return;
    const { novo, anterior } = registrarConclusao(atual, c.posicao, c.em, c.tipo || 'completa');
    atual = novo;
    aplicadas.push({ posicao: c.posicao, em: c.em, tipo: c.tipo, anterior });
  });
  return { progresso: atual, aplicadas };
}
