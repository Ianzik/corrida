// ====================================================================
// ALERTAS (som, voz e vibração)
// Tudo que "avisa" você passa por aqui.
//  - No navegador: bipes do próprio site, com a tela acesa.
//  - No app Android: a sessão inteira vai para um serviço nativo, que
//    toca cada aviso na hora certa com a tela apagada, abaixando a
//    música por um instante. Os bipes do site ficam mudos para não
//    tocar duas vezes.
// O resto do app chama as mesmas funções nos dois casos.
// ====================================================================

import { ehAppNativo, chamar, ouvir } from './nativo.js';
import { montarAgenda, falaDoBloco } from './avisos.js';
import { nomeDaSessao } from './plano.js';
import { prepararPermissoes } from './permissoes.js';

const NATIVO = ehAppNativo();

let audioCtx = null;

// O navegador só libera som depois de um toque na tela.
export function destravarAudio() {
  if (NATIVO) return;
  try {
    if (audioCtx === null) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}

export function audioLiberado() {
  if (NATIVO) return true;
  return audioCtx !== null && audioCtx.state === 'running';
}

function tocarSequencia(notas) {
  if (!audioLiberado()) return;
  let inicio = audioCtx.currentTime;
  notas.forEach(nota => {
    const osc = audioCtx.createOscillator();
    const ganho = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = nota.freq;
    osc.connect(ganho);
    ganho.connect(audioCtx.destination);
    const dur = nota.dur / 1000;
    const vol = nota.vol || 0.3;
    ganho.gain.setValueAtTime(0.0001, inicio);
    ganho.gain.exponentialRampToValueAtTime(vol, inicio + 0.01);
    ganho.gain.exponentialRampToValueAtTime(0.0001, inicio + dur);
    osc.start(inicio);
    osc.stop(inicio + dur);
    inicio += dur + (nota.gap || 0) / 1000;
  });
}

function vibrar(padrao) {
  if (NATIVO) return;
  try { if (navigator.vibrate) navigator.vibrate(padrao); } catch (e) {}
}

function alertarCorrida() {
  tocarSequencia([{ freq: 660, dur: 150, gap: 40 }, { freq: 880, dur: 280 }]);
  vibrar([200, 100, 200]);
}
function alertarCaminhada() {
  tocarSequencia([{ freq: 440, dur: 150, gap: 40 }, { freq: 330, dur: 280 }]);
  vibrar(400);
}
export function alertarFim() {
  if (NATIVO) { chamar('tocar', { tipo: 'fim', fala: 'Sessão concluída' }).catch(() => {}); return; }
  tocarSequencia([{ freq: 523, dur: 150, gap: 30 }, { freq: 659, dur: 150, gap: 30 }, { freq: 784, dur: 450 }]);
  vibrar([300, 100, 300, 100, 300]);
}
export function bipContagem() {
  // No app, os bipes de contagem são tocados pelo serviço nativo.
  if (NATIVO) return;
  tocarSequencia([{ freq: 520, dur: 90, vol: 0.2 }]);
  vibrar(80);
}
// Aviso de entrada no bloco "indice" (troca natural ou pulo manual).
export function alertarBloco(intervalos, indice) {
  const bloco = intervalos[indice];
  if (NATIVO) {
    // O serviço ignora se ele mesmo acabou de anunciar este bloco.
    chamar('tocar', { tipo: bloco.tipo, indice, fala: falaDoBloco(intervalos, indice) }).catch(() => {});
    return;
  }
  if (bloco.tipo === 'corrida') alertarCorrida(); else alertarCaminhada();
}

// ---------------- integração com o serviço nativo ----------------

// No app a tela pode apagar: quem avisa é o serviço. No navegador,
// a tela precisa ficar acesa para os bipes tocarem.
export function precisaTelaAcesa() {
  return !NATIVO;
}

// Antes de iniciar um treino: no app, confere as permissões.
export async function prepararInicio() {
  if (NATIVO) await prepararPermissoes();
}

// O app chama isto a cada mudança do treino (iniciar, pausar, pular,
// trocar de bloco, encerrar). No navegador não faz nada.
// estado: { ativa, posicao, intervalos, indice, rodando, fimDoIntervalo,
//           segundosRestantes, iniciadaEm, atualizadaEm }
let pendente = null;
export function sincronizar(estado) {
  if (!NATIVO) return;
  // Várias mudanças seguidas viram uma chamada só (vale a última).
  const agendar = pendente === null;
  pendente = estado;
  if (agendar) setTimeout(enviarPendente, 0);
}

function enviarPendente() {
  const e = pendente;
  pendente = null;
  if (!e.ativa) {
    chamar('parar', {}).catch(() => {});
    return;
  }
  // Pausado: monta a agenda como se continuasse agora; o serviço
  // desloca os horários quando você apertar Continuar.
  const fim = e.rodando ? e.fimDoIntervalo : e.atualizadaEm + e.segundosRestantes * 1000;
  chamar('sincronizar', {
    posicao: e.posicao,
    titulo: nomeDaSessao(e.posicao),
    indice: e.indice,
    rodando: e.rodando,
    fimDoIntervalo: fim,
    segundosRestantes: e.segundosRestantes,
    iniciadaEm: e.iniciadaEm,
    atualizadaEm: e.atualizadaEm,
    blocoAtual: { descricao: e.intervalos[e.indice].descricao, tipo: e.intervalos[e.indice].tipo },
    agenda: montarAgenda(e.intervalos, e.indice, fim),
  }).catch(() => {});
}

// O que o serviço fez sem o app ver (pausou pela notificação, concluiu
// com o app fechado). No navegador devolve null.
// Formato: { sessao: {...} | null, conclusoes: [{ posicao, em, tipo }] }
export async function lerEstadoExterno() {
  if (!NATIVO) return null;
  try { return await chamar('obterEstado'); } catch (e) { return null; }
}

// Depois que o app gravou as conclusões no progresso, avisa o serviço
// para não entregá-las de novo.
export function confirmarConclusoes() {
  if (NATIVO) chamar('limparConclusoes', {}).catch(() => {});
}

// Registra quem deve ser avisado quando o serviço mudar algo com o
// app aberto (ex.: você tocou em Pausar na notificação).
export function aoMudarDeFora(callback) {
  if (!NATIVO) return;
  ouvir('mudou', () => { lerEstadoExterno().then(ext => { if (ext) callback(ext); }); });
}
