// ====================================================================
// SOM DA ROTINA DE MOBILIDADE
// Os avisos do cronômetro de exercícios: bipe da contagem (3, 2, 1),
// tom de troca de exercício, "Troque o lado" e o tom de fim.
// As notas são as mesmas da corrida (alertas.js).
//
// Diferença para a corrida: aqui a tela fica acesa, então os bipes
// tocam pelo próprio navegador, também dentro do app Android. Só o
// aviso de troca e a voz usam o serviço nativo, que sabe falar em
// português e abaixar a música.
// ====================================================================

import { ehAppNativo, chamar } from './nativo.js';
import { modoAtual, tocaTom, falaVoz, aoMudarDeModo } from './som-modo.js';

let audioCtx = null;

// Saiu do modo com voz no meio de uma fala: corta na hora.
aoMudarDeModo(modo => {
  if (modo === 'voz') return;
  try { window.speechSynthesis.cancel(); } catch (e) {}
});

// O navegador só libera som depois de um toque: chame ao apertar Iniciar.
export function destravar() {
  try {
    if (audioCtx === null) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch (e) {}
}

// O navegador liberou o som? (Antes do primeiro toque, ou em alguns modos
// do aparelho, ele fica bloqueado e os avisos não tocam.)
export function audioLiberado() {
  return audioCtx !== null && audioCtx.state === 'running';
}

function tocar(notas) {
  if (!tocaTom(modoAtual())) return; // "sem som": só a vibração avisa
  if (audioCtx === null || audioCtx.state !== 'running') return;
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
  try { if (navigator.vibrate) navigator.vibrate(padrao); } catch (e) {}
}

function falar(texto) {
  try {
    if (!falaVoz(modoAtual())) return; // só "alertas + voz" fala
    if (!('speechSynthesis' in window)) return;
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = 'pt-BR';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(fala);
  } catch (e) {}
}

// ---- tons (os mesmos da corrida) ----
function tomTroca() {
  tocar([{ freq: 440, dur: 150, gap: 40 }, { freq: 330, dur: 280 }]);
  vibrar(400);
}
function tomFim() {
  tocar([{ freq: 523, dur: 150, gap: 30 }, { freq: 659, dur: 150, gap: 30 }, { freq: 784, dur: 450 }]);
  vibrar([300, 100, 300, 100, 300]);
}

// ---- avisos ----

// Bipe dos últimos 3 segundos de cada etapa.
export function bipContagem() {
  tocar([{ freq: 520, dur: 90, vol: 0.2 }]);
  vibrar(80);
}

// Passou para outro exercício.
export function avisarExercicio() {
  if (ehAppNativo()) {
    if (!tocaTom(modoAtual())) { vibrar(400); return; }
    chamar('tocar', { tipo: 'caminhada', fala: '' }).catch(tomTroca);
    return;
  }
  tomTroca();
}

// Toca o tom de troca e fala o texto, conforme o modo de som. No app Android
// quem fala é o serviço nativo (voz em português, abaixa a música); no
// navegador, a voz do sistema. Sem som: só vibra.
function anunciar(fala) {
  const modo = modoAtual();
  if (ehAppNativo()) {
    if (!tocaTom(modo)) { vibrar(400); return; }
    const texto = falaVoz(modo) ? fala : '';
    chamar('tocar', { tipo: 'caminhada', fala: texto })
      .catch(() => { tomTroca(); if (texto) setTimeout(() => falar(texto), 450); });
    return;
  }
  tomTroca();
  if (falaVoz(modo)) setTimeout(() => falar(fala), 450);
}

// Mesmo exercício, agora do outro lado.
export function avisarLado() {
  anunciar('Troque o lado');
}

// Começou o preparo: diz qual exercício vem. primeiro = o da largada.
export function avisarPreparo(nomeDoExercicio, primeiro) {
  anunciar((primeiro ? 'Prepare-se. Primeiro: ' : 'Próximo: ') + nomeDoExercicio);
}

export function avisarFim() {
  if (ehAppNativo()) {
    const modo = modoAtual();
    if (!tocaTom(modo)) { vibrar([300, 100, 300, 100, 300]); return; }
    chamar('tocar', { tipo: 'fim', fala: falaVoz(modo) ? 'Rotina concluída' : '' }).catch(tomFim);
    return;
  }
  tomFim();
}
