// ====================================================================
// PLANO DE TREINO
// Dados do plano e a fábrica que transforma uma semana em blocos.
// Não mexe na tela: pode ser testado sozinho.
// ====================================================================

export const SEMANAS = [
  { runSeconds: 60,   runReps: 6, walkBetweenSeconds: 120 },
  { runSeconds: 90,   runReps: 6, walkBetweenSeconds: 120 },
  { runSeconds: 120,  runReps: 6, walkBetweenSeconds: 120 },
  { runSeconds: 180,  runReps: 5, walkBetweenSeconds: 120 },
  { runSeconds: 240,  runReps: 4, walkBetweenSeconds: 120 },
  { runSeconds: 300,  runReps: 4, walkBetweenSeconds: 120 },
  { runSeconds: 420,  runReps: 3, walkBetweenSeconds: 120 },
  { runSeconds: 540,  runReps: 3, walkBetweenSeconds: 120 },
  { runSeconds: 720,  runReps: 2, walkBetweenSeconds: 120 },
  { runSeconds: 900,  runReps: 2, walkBetweenSeconds: 120 },
  { runSeconds: 1080, runReps: 1, walkBetweenSeconds: 0 },
  { runSeconds: 1320, runReps: 1, walkBetweenSeconds: 0 },
  { runSeconds: 1560, runReps: 1, walkBetweenSeconds: 0 },
  { runSeconds: 1800, runReps: 1, walkBetweenSeconds: 0 },
];

export const AQUECIMENTO = 300;
export const DESAQUECIMENTO = 300;
export const SESSOES_POR_SEMANA = 3;
export const TOTAL_SESSOES = SEMANAS.length * SESSOES_POR_SEMANA;

// posição 0..41 -> { semana (0..13), sessao (1..3) }
export function descreverPosicao(posicao) {
  return {
    semana: Math.floor(posicao / SESSOES_POR_SEMANA),
    sessao: (posicao % SESSOES_POR_SEMANA) + 1,
  };
}

export function nomeDaSessao(posicao) {
  const d = descreverPosicao(posicao);
  return 'Semana ' + (d.semana + 1) + ' · Sessão ' + d.sessao;
}

export function gerarIntervalos(semana) {
  const intervalos = [];
  const totalCaminhadas = semana.walkBetweenSeconds > 0 ? semana.runReps - 1 : 0;

  intervalos.push({ tipo: 'caminhada', fase: 'aquecimento', segundos: AQUECIMENTO, descricao: 'Aquecimento' });

  let caminhadaN = 0;
  for (let i = 0; i < semana.runReps; i++) {
    intervalos.push({
      tipo: 'corrida', fase: 'corrida', segundos: semana.runSeconds,
      descricao: semana.runReps > 1 ? 'Corra ' + (i + 1) + '/' + semana.runReps : 'Corra',
    });
    const ehUltima = i === semana.runReps - 1;
    if (!ehUltima && semana.walkBetweenSeconds > 0) {
      caminhadaN++;
      intervalos.push({
        tipo: 'caminhada', fase: 'caminhada', segundos: semana.walkBetweenSeconds,
        descricao: totalCaminhadas > 1 ? 'Caminhe ' + caminhadaN + '/' + totalCaminhadas : 'Caminhe',
      });
    }
  }

  intervalos.push({ tipo: 'caminhada', fase: 'desaquecimento', segundos: DESAQUECIMENTO, descricao: 'Desaquecimento' });
  return intervalos;
}

export function intervalosDaPosicao(posicao) {
  return gerarIntervalos(SEMANAS[descreverPosicao(posicao).semana]);
}

export function duracaoTotal(intervalos) {
  return intervalos.reduce((soma, b) => soma + b.segundos, 0);
}

// ---- formatação ----
export function formatarTempo(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return s === 0 ? m + ' min' : m + ' min ' + s + 's';
}

export function formatarRelogio(segundos) {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}
