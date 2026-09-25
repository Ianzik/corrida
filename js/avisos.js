// ====================================================================
// AGENDA DE AVISOS
// Transforma a sessão em uma lista de "o que tocar e quando", em
// horário absoluto do relógio. No app Android essa lista vai inteira
// para o serviço nativo, que toca cada item na hora certa mesmo com a
// tela apagada. Aqui só tem lógica pura, para poder ser testada.
// ====================================================================

import { DESAQUECIMENTO } from './plano.js';
import { linhaDoTempo } from './sessao.js';

// Quantos bipes de contagem antes de cada troca (3, 2, 1).
export const BIPES_CONTAGEM = 3;

// O que a voz fala ao entrar em cada bloco.
export function falaDoBloco(intervalos, indice) {
  if (indice >= intervalos.length) return 'Sessão concluída';
  const bloco = intervalos[indice];
  if (bloco.fase === 'aquecimento') {
    return 'Aquecimento, ' + minutos(bloco.segundos);
  }
  if (bloco.fase === 'desaquecimento') {
    return 'Últimos ' + minutos(DESAQUECIMENTO) + ' de desaquecimento';
  }
  if (bloco.tipo === 'corrida') {
    // "Corra 3/6" vira "Corra, 3 de 6"
    const m = /(\d+)\/(\d+)/.exec(bloco.descricao);
    return m ? 'Corra, ' + m[1] + ' de ' + m[2] : 'Corra';
  }
  return 'Caminhe';
}

function minutos(segundos) {
  const m = Math.round(segundos / 60);
  return m === 1 ? '1 minuto' : m + ' minutos';
}

// Lista de avisos a partir do bloco atual.
// Cada troca vira: bipe, bipe, bipe (3, 2, 1 segundos antes) + troca.
// Cada item: { em, acao: 'bip'|'troca'|'fim', indice, tipo, fala, descricao, fimDoBloco }
export function montarAgenda(intervalos, indice, fimDoIntervalo) {
  const agenda = [];
  const trocas = linhaDoTempo(intervalos, indice, fimDoIntervalo);
  trocas.forEach((troca, n) => {
    for (let s = BIPES_CONTAGEM; s >= 1; s--) {
      agenda.push({ em: troca.em - s * 1000, acao: 'bip', indice: troca.indice });
    }
    const proxima = trocas[n + 1];
    agenda.push({
      em: troca.em,
      acao: troca.tipo === 'fim' ? 'fim' : 'troca',
      indice: troca.indice,
      tipo: troca.tipo,
      descricao: troca.descricao,
      fala: falaDoBloco(intervalos, troca.indice),
      fimDoBloco: proxima ? proxima.em : null,
    });
  });
  return agenda;
}
