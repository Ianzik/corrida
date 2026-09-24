// ====================================================================
// APP: liga a lógica (plano, relógio, armazenamento, alertas) à tela.
// ====================================================================

import {
  TOTAL_SESSOES, intervalosDaPosicao, duracaoTotal, nomeDaSessao,
  formatarTempo, formatarRelogio,
} from './plano.js';
import { reconciliar, segundosDecorridos } from './sessao.js';
import {
  carregarProgresso, salvarProgresso, zerarProgresso,
  registrarConclusao, desfazerConclusao,
  carregarSessaoAtiva, salvarSessaoAtiva, limparSessaoAtiva,
} from './armazenamento.js';
import * as alertas from './alertas.js';

const $ = id => document.getElementById(id);
const RAIO = 110;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

// ---------------- estado ----------------
let progresso = carregarProgresso();
let posicaoAtual = 0;
let intervalos = [];
let totalSegundos = 0;
let indice = 0;
let segundosRestantes = 0;
let fimDoIntervalo = 0;
let rodando = false;
let concluida = false;
let jaIniciou = false;
let iniciadaEm = null;
let timerId = null;
let ultimoSegundoBip = null;
let desfazer = null; // { posicao, anterior } da última conclusão automática

// ---------------- persistência ----------------
function persistir() {
  if (jaIniciou && !concluida) {
    salvarSessaoAtiva({
      posicao: posicaoAtual, indice, rodando, fimDoIntervalo,
      segundosRestantes, iniciadaEm, atualizadaEm: Date.now(),
    });
  } else {
    limparSessaoAtiva();
  }
}

// ---------------- timer ----------------
function ligarTimer() {
  desligarTimer();
  timerId = setInterval(tick, 250);
}
function desligarTimer() {
  if (timerId !== null) { clearInterval(timerId); timerId = null; }
}

function tick() {
  if (!rodando) return;
  const r = reconciliar(intervalos, { indice, rodando, fimDoIntervalo, segundosRestantes }, Date.now());

  if (r.concluida) {
    concluirSessao('completa', r.terminouEm, false);
    return;
  }

  indice = r.indice;
  fimDoIntervalo = r.fimDoIntervalo;
  segundosRestantes = r.segundosRestantes;

  if (r.avancou > 0) {
    // Mesmo que vários blocos tenham passado (app congelado),
    // toca só UM aviso: o do bloco em que você está agora.
    ultimoSegundoBip = null;
    alertas.alertarBloco(intervalos[indice].tipo);
    persistir();
  } else if (segundosRestantes <= 3 && segundosRestantes > 0 && segundosRestantes !== ultimoSegundoBip) {
    ultimoSegundoBip = segundosRestantes;
    alertas.bipContagem();
  }
  atualizarTela();
}

// ---------------- ações ----------------
function prepararSessao(posicao) {
  desligarTimer();
  soltarWakeLock();
  destravarToques();
  posicaoAtual = Math.max(0, Math.min(posicao, TOTAL_SESSOES - 1));
  intervalos = intervalosDaPosicao(posicaoAtual);
  totalSegundos = duracaoTotal(intervalos);
  indice = 0;
  segundosRestantes = intervalos[0].segundos;
  fimDoIntervalo = 0;
  rodando = false;
  concluida = false;
  jaIniciou = false;
  iniciadaEm = null;
  ultimoSegundoBip = null;
  limparSessaoAtiva();
  desenharTrilho();
  renderizarLista();
  atualizarTela();
}

function botaoPrincipal() {
  alertas.destravarAudio();
  if (concluida) {
    if (posicaoAtual < TOTAL_SESSOES - 1) irParaSessao(posicaoAtual + 1, true);
    return;
  }
  if (rodando) pausar(); else iniciar();
}

function iniciar() {
  rodando = true;
  jaIniciou = true;
  if (iniciadaEm === null) iniciadaEm = Date.now();
  fimDoIntervalo = Date.now() + segundosRestantes * 1000;
  ligarTimer();
  pegarWakeLock();
  persistir();
  atualizarTela();
}

function pausar() {
  if (rodando) {
    segundosRestantes = Math.max(Math.ceil((fimDoIntervalo - Date.now()) / 1000), 0);
  }
  rodando = false;
  desligarTimer();
  soltarWakeLock();
  persistir();
  atualizarTela();
}

function pularBloco(direcao) {
  if (concluida) return;
  const novo = indice + direcao;
  if (novo < 0 || novo >= intervalos.length) return;
  alertas.destravarAudio();
  indice = novo;
  segundosRestantes = intervalos[indice].segundos;
  fimDoIntervalo = Date.now() + segundosRestantes * 1000;
  ultimoSegundoBip = null;
  alertas.alertarBloco(intervalos[indice].tipo);
  persistir();
  atualizarTela();
}

function concluirSessao(tipo, quando, silencioso) {
  desligarTimer();
  soltarWakeLock();
  destravarToques();
  rodando = false;
  concluida = true;
  indice = intervalos.length - 1;
  segundosRestantes = 0;
  const { novo, anterior } = registrarConclusao(progresso, posicaoAtual, quando, tipo);
  progresso = novo;
  salvarProgresso(progresso);
  limparSessaoAtiva();
  if (!silencioso) alertas.alertarFim();
  atualizarTela();
  return anterior;
}

function concluirManual() {
  if (concluida) return;
  if (!confirm('Encerrar a sessão agora e marcá-la como concluída?')) return;
  concluirSessao('manual', Date.now(), false);
}

function reiniciar() {
  if (jaIniciou && !concluida && !confirm('Recomeçar esta sessão do zero?')) return;
  prepararSessao(posicaoAtual);
}

function irParaSessao(posicao, semPerguntar) {
  if (rodando) return;
  if (!semPerguntar && jaIniciou && !concluida && !confirm('Descartar a sessão em andamento?')) return;
  esconderBanner();
  prepararSessao(posicao);
}

function zerar() {
  if (rodando) return;
  if (!confirm('Zerar todo o progresso e o histórico, voltando para a Semana 1?')) return;
  zerarProgresso();
  progresso = carregarProgresso();
  esconderBanner();
  prepararSessao(0);
}

// ---------------- banner "concluída enquanto o app estava fechado" ----------------
function mostrarBanner(posicao, quando, anterior) {
  desfazer = { posicao, anterior };
  $('bannerTexto').textContent =
    '✓ ' + nomeDaSessao(posicao) + ' concluída às ' + formatarHora(quando) + '.';
  $('banner').hidden = false;
}
function esconderBanner() {
  desfazer = null;
  $('banner').hidden = true;
}
function desfazerConclusaoAutomatica() {
  if (!desfazer) return;
  progresso = desfazerConclusao(progresso, desfazer.anterior);
  salvarProgresso(progresso);
  const pos = desfazer.posicao;
  esconderBanner();
  prepararSessao(pos);
}

// ---------------- wake lock ----------------
let wakeLock = null;
async function pegarWakeLock() {
  if (!('wakeLock' in navigator)) {
    $('avisoTela').textContent = 'Mantenha a tela acesa manualmente';
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    $('avisoTela').textContent = 'Tela travada acesa durante o treino';
    wakeLock.addEventListener('release', () => { if (!rodando) $('avisoTela').textContent = ''; });
  } catch (e) {
    $('avisoTela').textContent = 'Não foi possível manter a tela acesa';
  }
}
async function soltarWakeLock() {
  if (wakeLock !== null) {
    try { await wakeLock.release(); } catch (e) {}
    wakeLock = null;
  }
  $('avisoTela').textContent = '';
}

// ---------------- trava de toques ----------------
let travaTimer = null;
function travarToques() {
  $('trava').hidden = false;
}
function destravarToques() {
  cancelarDestrave();
  $('trava').hidden = true;
}
function comecarDestrave(e) {
  e.preventDefault();
  $('trava').classList.add('segurando');
  travaTimer = setTimeout(destravarToques, 2000);
}
function cancelarDestrave() {
  if (travaTimer !== null) { clearTimeout(travaTimer); travaTimer = null; }
  $('trava').classList.remove('segurando');
}

// ---------------- desenho ----------------
function corDaFase(fase) {
  const css = getComputedStyle(document.documentElement);
  if (fase === 'corrida') return css.getPropertyValue('--seg-corre').trim();
  if (fase === 'caminhada') return css.getPropertyValue('--seg-caminha').trim();
  return css.getPropertyValue('--seg-aquece').trim();
}

function desenharTrilho() {
  const g = $('ringSegmentos');
  g.innerHTML = '';
  const folga = 4;
  let pos = 0;
  intervalos.forEach(bloco => {
    const comprimento = (bloco.segundos / totalSegundos) * CIRCUNFERENCIA;
    const visivel = Math.max(comprimento - folga, 1);
    const arco = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    arco.setAttribute('class', 'ringSeg');
    arco.setAttribute('cx', '120'); arco.setAttribute('cy', '120'); arco.setAttribute('r', String(RAIO));
    arco.setAttribute('stroke', corDaFase(bloco.fase));
    arco.setAttribute('stroke-dasharray', visivel + ' ' + (CIRCUNFERENCIA - visivel));
    arco.setAttribute('stroke-dashoffset', String(-pos));
    g.appendChild(arco);
    pos += comprimento;
  });
}

let itensLista = [];
function renderizarLista() {
  const lista = $('listaIntervalos');
  lista.innerHTML = '';
  itensLista = intervalos.map(bloco => {
    const li = document.createElement('li');
    li.className = bloco.tipo;
    const nome = document.createElement('span');
    nome.textContent = bloco.descricao;
    const tempo = document.createElement('span');
    tempo.className = 'tempo';
    tempo.textContent = formatarTempo(bloco.segundos);
    li.append(nome, tempo);
    lista.appendChild(li);
    return li;
  });
}

function formatarHora(ms) {
  return new Date(ms).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
function formatarData(ms) {
  return new Date(ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

const ROTULO_TIPO = { completa: '', automatica: 'app fechado', manual: 'encerrada antes' };

function renderizarHistorico() {
  const h = progresso.historico;
  $('cartaoHistorico').hidden = h.length === 0;
  const lista = $('listaHistorico');
  lista.innerHTML = '';
  h.slice(-6).reverse().forEach(item => {
    const li = document.createElement('li');
    li.className = 'hist';
    const nome = document.createElement('span');
    nome.textContent = nomeDaSessao(item.posicao);
    const quando = document.createElement('span');
    quando.className = 'histQuando';
    const extra = ROTULO_TIPO[item.tipo] ? ' · ' + ROTULO_TIPO[item.tipo] : '';
    quando.textContent = formatarData(item.em) + ' ' + formatarHora(item.em) + extra;
    li.append(nome, quando);
    lista.appendChild(li);
  });
}

function jaFoiConcluida(posicao) {
  return progresso.historico.some(h => h.posicao === posicao) || posicao < progresso.concluidas;
}

function atualizarTela() {
  const bloco = intervalos[indice];
  const cartao = $('acaoCartao');

  $('tituloSessao').textContent = nomeDaSessao(posicaoAtual).replace(/Sessão (\d)/, 'Sessão $1 de 3');
  $('marcaConcluida').hidden = !(jaFoiConcluida(posicaoAtual) && !concluida);

  if (concluida) {
    $('acaoTexto').textContent = 'Concluída!';
    cartao.className = 'cartao acaoCartao concluida';
  } else {
    $('acaoTexto').textContent = bloco.descricao;
    cartao.className = 'cartao acaoCartao ' + bloco.tipo;
  }

  $('tempoRestante').textContent = formatarRelogio(segundosRestantes);
  $('progressoTexto').textContent = 'Bloco ' + (indice + 1) + ' de ' + intervalos.length;

  const principal = $('btnIniciar');
  if (concluida) {
    principal.textContent = posicaoAtual < TOTAL_SESSOES - 1 ? 'Próxima sessão ›' : 'Plano concluído!';
    principal.disabled = posicaoAtual >= TOTAL_SESSOES - 1;
  } else {
    principal.textContent = rodando ? 'Pausar' : (jaIniciou ? 'Continuar' : 'Iniciar');
    principal.disabled = false;
  }

  $('btnConcluir').style.display = jaIniciou && !concluida ? 'block' : 'none';
  $('btnTravar').hidden = !rodando;
  $('btnPularAnt').disabled = concluida || indice === 0;
  $('btnPularProx').disabled = concluida || indice === intervalos.length - 1;

  const decorrido = concluida ? totalSegundos : segundosDecorridos(intervalos, indice, segundosRestantes);
  const fracao = Math.max(0, Math.min(decorrido / totalSegundos, 1));
  $('barraPreenchida').style.width = fracao * 100 + '%';
  const ring = $('ringProg');
  ring.style.strokeDasharray = CIRCUNFERENCIA;
  ring.style.strokeDashoffset = CIRCUNFERENCIA * (1 - fracao);

  $('tempoTotalDecorrido').textContent = formatarRelogio(decorrido) + ' / ' + formatarRelogio(totalSegundos);
  $('tempoTotalRestante').textContent = 'faltam ' + formatarRelogio(Math.max(totalSegundos - decorrido, 0));

  itensLista.forEach((li, i) => li.classList.toggle('ativo', i === indice && !concluida));

  $('planoProgresso').textContent = progresso.concluidas + ' de ' + TOTAL_SESSOES + ' concluídas';
  $('btnAnterior').disabled = rodando || posicaoAtual === 0;
  $('btnProxima').disabled = rodando || posicaoAtual === TOTAL_SESSOES - 1;

  $('avisoSom').hidden = !(rodando && !alertas.audioLiberado());
  renderizarHistorico();
}

// ---------------- ao abrir o app ----------------
function arrancar() {
  salvarProgresso(progresso); // grava já no formato novo (migração)
  const ativa = carregarSessaoAtiva();

  if (!ativa || ativa.posicao < 0 || ativa.posicao >= TOTAL_SESSOES) {
    prepararSessao(Math.min(progresso.concluidas, TOTAL_SESSOES - 1));
    return;
  }

  // Havia um treino em andamento: restaura e confere com o relógio real.
  prepararSessao(ativa.posicao);
  if (ativa.indice < 0 || ativa.indice >= intervalos.length) return; // dado inválido: começa limpo

  indice = ativa.indice;
  rodando = !!ativa.rodando;
  fimDoIntervalo = ativa.fimDoIntervalo || 0;
  segundosRestantes = ativa.segundosRestantes || intervalos[indice].segundos;
  iniciadaEm = ativa.iniciadaEm || null;
  jaIniciou = true;

  const r = reconciliar(intervalos, { indice, rodando, fimDoIntervalo, segundosRestantes }, Date.now());

  if (r.concluida) {
    // Terminou enquanto o app estava fechado: marca e já abre a próxima.
    const posicaoFeita = posicaoAtual;
    const anterior = concluirSessao('automatica', r.terminouEm, true);
    if (posicaoFeita < TOTAL_SESSOES - 1) prepararSessao(posicaoFeita + 1);
    mostrarBanner(posicaoFeita, r.terminouEm, anterior);
    return;
  }

  indice = r.indice;
  fimDoIntervalo = r.fimDoIntervalo;
  segundosRestantes = r.segundosRestantes;
  if (rodando) {
    ligarTimer();
    pegarWakeLock();
  }
  persistir();
  atualizarTela();
}

// ---------------- eventos ----------------
$('btnIniciar').addEventListener('click', botaoPrincipal);
$('btnReiniciar').addEventListener('click', reiniciar);
$('btnConcluir').addEventListener('click', concluirManual);
$('btnPularAnt').addEventListener('click', () => pularBloco(-1));
$('btnPularProx').addEventListener('click', () => pularBloco(1));
$('btnAnterior').addEventListener('click', () => irParaSessao(posicaoAtual - 1));
$('btnProxima').addEventListener('click', () => irParaSessao(posicaoAtual + 1));
$('btnZerar').addEventListener('click', zerar);
$('btnDesfazer').addEventListener('click', desfazerConclusaoAutomatica);
$('btnFecharBanner').addEventListener('click', esconderBanner);
$('btnTravar').addEventListener('click', travarToques);

const trava = $('trava');
trava.addEventListener('pointerdown', comecarDestrave);
['pointerup', 'pointerleave', 'pointercancel'].forEach(ev => trava.addEventListener(ev, cancelarDestrave));
trava.addEventListener('contextmenu', e => e.preventDefault());

// Qualquer toque libera o som (necessário depois que o app é reaberto).
document.addEventListener('pointerdown', () => {
  alertas.destravarAudio();
  if (rodando && wakeLock === null) pegarWakeLock();
  setTimeout(() => { $('avisoSom').hidden = !(rodando && !alertas.audioLiberado()); }, 100);
}, { capture: true });

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    if (rodando) { pegarWakeLock(); tick(); }
  } else {
    persistir();
  }
});
window.addEventListener('pagehide', persistir);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
}

arrancar();
