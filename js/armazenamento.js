// ====================================================================
// ARMAZENAMENTO
// Duas gavetas no localStorage:
//  1. progresso: quantas sessões você já concluiu + histórico
//  2. sessaoAtiva: o treino em andamento (para sobreviver a fechar o app)
// A chave do progresso é a mesma da versão antiga, então o seu
// avanço atual é aproveitado automaticamente.
// ====================================================================

import { TOTAL_SESSOES } from './plano.js';
import { TIPOS, MODALIDADES, PARTES, TEMPOS, normalizarPerfil } from './treino.js';

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

// ---- rotina de mobilidade ----
// Seu teste de mobilidade e a última escolha ficam só neste aparelho.
// Não entram no "Exportar progresso" e o "Zerar progresso" não os apaga.
export const CHAVE_MOBILIDADE = 'treinoCorrida.mobilidade';
export const CHAVE_ROTINA = 'treinoCorrida.rotina';

export function carregarPerfilMobilidade() { return normalizarPerfil(ler(CHAVE_MOBILIDADE)); }
export function salvarPerfilMobilidade(perfil) { gravar(CHAVE_MOBILIDADE, normalizarPerfil(perfil)); }

// { escolha: { tipo, modalidade, parte, minutos } | null, recentes: [ids] }
export function carregarRotina() {
  const d = ler(CHAVE_ROTINA);
  const e = d && d.escolha;
  const valida = e
    && TIPOS.some(t => t.id === e.tipo)
    && MODALIDADES.some(m => m.id === e.modalidade)
    && PARTES.some(p => p.id === e.parte)
    && TEMPOS.includes(e.minutos);
  return {
    escolha: valida ? { tipo: e.tipo, modalidade: e.modalidade, parte: e.parte, minutos: e.minutos } : null,
    recentes: d && Array.isArray(d.recentes) ? d.recentes.filter(i => typeof i === 'string').slice(-40) : [],
  };
}
export function salvarRotina(r) { gravar(CHAVE_ROTINA, r); }

// Rotinas de mobilidade concluídas: [{ tipo, modalidade, em }].
// Alimenta o "dia de corrida" da tela inicial.
export const CHAVE_ROTINAS_FEITAS = 'treinoCorrida.rotinasFeitas';
const MAX_ROTINAS_FEITAS = 60;

export function carregarRotinasFeitas() {
  const lista = ler(CHAVE_ROTINAS_FEITAS);
  if (!Array.isArray(lista)) return [];
  return lista
    .filter(r => r && typeof r.tipo === 'string' && typeof r.modalidade === 'string' && typeof r.em === 'number')
    .map(r => ({ tipo: r.tipo, modalidade: r.modalidade, em: r.em }))
    .slice(-MAX_ROTINAS_FEITAS);
}
export function registrarRotinaFeita(tipo, modalidade, em) {
  const lista = carregarRotinasFeitas().concat([{ tipo, modalidade, em }]);
  gravar(CHAVE_ROTINAS_FEITAS, lista.slice(-MAX_ROTINAS_FEITAS));
}

// ---- sessão em andamento ----
export function carregarSessaoAtiva() {
  const s = ler(CHAVE_SESSAO);
  if (!s || typeof s.posicao !== 'number' || typeof s.indice !== 'number') return null;
  return s;
}
export function salvarSessaoAtiva(s) { gravar(CHAVE_SESSAO, s); }
export function limparSessaoAtiva() { apagar(CHAVE_SESSAO); }
