// ====================================================================
// ALERTAS (som + vibração)
// Tudo que "avisa" você passa por aqui. Na versão Android este é o
// único arquivo que muda: os bipes viram notificações agendadas.
// ====================================================================

let audioCtx = null;

// O navegador só libera som depois de um toque na tela.
export function destravarAudio() {
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
  try { if (navigator.vibrate) navigator.vibrate(padrao); } catch (e) {}
}

export function alertarCorrida() {
  tocarSequencia([{ freq: 660, dur: 150, gap: 40 }, { freq: 880, dur: 280 }]);
  vibrar([200, 100, 200]);
}
export function alertarCaminhada() {
  tocarSequencia([{ freq: 440, dur: 150, gap: 40 }, { freq: 330, dur: 280 }]);
  vibrar(400);
}
export function alertarFim() {
  tocarSequencia([{ freq: 523, dur: 150, gap: 30 }, { freq: 659, dur: 150, gap: 30 }, { freq: 784, dur: 450 }]);
  vibrar([300, 100, 300, 100, 300]);
}
export function bipContagem() {
  tocarSequencia([{ freq: 520, dur: 90, vol: 0.2 }]);
  vibrar(80);
}
export function alertarBloco(tipo) {
  if (tipo === 'corrida') alertarCorrida(); else alertarCaminhada();
}
