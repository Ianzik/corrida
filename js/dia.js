// ====================================================================
// O DIA DE TREINO
// Em dia de corrida o fluxo é ativar, correr e recuperar. Este módulo
// diz quais passos já foram feitos hoje e qual é o próximo.
// Não mexe na tela: pode ser testado sozinho.
//
// Os passos são deduzidos de registros que já existem (o histórico da
// corrida e as rotinas de mobilidade concluídas), então não há um
// "estado do dia" para ficar fora de sincronia.
// ====================================================================

export const PASSOS = ['ativar', 'corrida', 'recuperar'];

// Dois horários caem no mesmo dia do calendário (no fuso do aparelho)?
export function mesmoDia(a, b) {
  const x = new Date(a);
  const y = new Date(b);
  return x.getFullYear() === y.getFullYear()
    && x.getMonth() === y.getMonth()
    && x.getDate() === y.getDate();
}

// rotinas:  [{ tipo, modalidade, em }]   rotinas de mobilidade concluídas
// historico: [{ posicao, em, tipo }]      sessões de corrida concluídas
// Devolve { ativar, corrida, recuperar } com true/false.
export function passosDeHoje(rotinas, historico, agora) {
  const hoje = em => typeof em === 'number' && mesmoDia(em, agora);
  const rotinaDeCorrida = tipo =>
    (rotinas || []).some(r => r && r.tipo === tipo && r.modalidade === 'corrida' && hoje(r.em));
  return {
    ativar: rotinaDeCorrida('ativar'),
    corrida: (historico || []).some(h => h && hoje(h.em)),
    recuperar: rotinaDeCorrida('recuperar'),
  };
}

// O próximo passo do dia de corrida, ou null se o dia está concluído.
// Se você já correu, ativar deixa de fazer sentido: o próximo é recuperar.
export function proximoPasso(feitos) {
  if (feitos.corrida) return feitos.recuperar ? null : 'recuperar';
  return feitos.ativar ? 'corrida' : 'ativar';
}
