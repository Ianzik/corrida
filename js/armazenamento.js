// ====================================================================
// ARMAZENAMENTO
// Duas gavetas no localStorage:
//  1. progresso: quantas sessões você já concluiu + histórico
//  2. sessaoAtiva: o treino em andamento (para sobreviver a fechar o app)
// A chave do progresso é a mesma da versão antiga, então o seu
// avanço atual é aproveitado automaticamente.
// ====================================================================

import { TOTAL_SESSOES } from './plano.js';

export const CHAVE_PROGRESSO = 'treinoCorrida.progresso';
export const CHAVE_SESSAO = 'treinoCorrida.sessaoAtiva';

function ler(chave) {
  try {
    const t = localStorage.getItem(chave);
    return t ? JSON.parse(t) : null;
  } catch (e) { return null; }
}
function gravar(chave, valor) {
  try { localStorage.setItem(chave, JSON.stringify(valor)); } catch (e) {}
}
function apagar(chave) {
  try { localStorage.removeItem(chave); } catch (e) {}
}

// Aceita o formato antigo ({ concluidas, versao: 1 }) e o novo.
export function normalizarProgresso(dados) {
  const vazio = { versao: 2, concluidas: 0, historico: [] };
  if (!dados || typeof dados !== 'object') return vazio;
  const n = dados.concluidas;
  const concluidas = (typeof n === 'number' && n >= 0 && n <= TOTAL_SESSOES) ? Math.floor(n) : 0;
  const historico = Array.isArray(dados.historico)
    ? dados.historico.filter(h => h && typeof h.posicao === 'number' && typeof h.em === 'number')
    : [];
  return { versao: 2, concluidas, historico };
}

export function carregarProgresso() { return normalizarProgresso(ler(CHAVE_PROGRESSO)); }
export function salvarProgresso(p) { gravar(CHAVE_PROGRESSO, p); }
export function zerarProgresso() { apagar(CHAVE_PROGRESSO); apagar(CHAVE_SESSAO); }

// tipo: 'completa' (cronômetro chegou ao fim com o app aberto),
//       'automatica' (terminou enquanto o app estava fechado),
//       'manual' (você apertou Concluir)
export function registrarConclusao(progresso, posicao, em, tipo) {
  const anterior = progresso.concluidas;
  const concluidas = Math.max(progresso.concluidas, posicao + 1);
  const historico = progresso.historico.concat([{ posicao, em, tipo }]).slice(-200);
  return { novo: { versao: 2, concluidas, historico }, anterior };
}

export function desfazerConclusao(progresso, anterior) {
  return {
    versao: 2,
    concluidas: anterior,
    historico: progresso.historico.slice(0, -1),
  };
}

// ---- sessão em andamento ----
export function carregarSessaoAtiva() {
  const s = ler(CHAVE_SESSAO);
  if (!s || typeof s.posicao !== 'number' || typeof s.indice !== 'number') return null;
  return s;
}
export function salvarSessaoAtiva(s) { gravar(CHAVE_SESSAO, s); }
export function limparSessaoAtiva() { apagar(CHAVE_SESSAO); }
