// ====================================================================
// RELÓGIO DA SESSÃO
// A verdade do treino é o relógio real (Date.now), não um contador.
// Assim, se o celular congelar ou matar o app, ao reabrir basta
// perguntar "que horas são?" e descobrir em que bloco você está.
// Funções puras: recebem o estado e o horário, devolvem o novo estado.
// ====================================================================

// estado: { indice, rodando, fimDoIntervalo (ms), segundosRestantes }
// Devolve o estado atualizado + quantos blocos foram atravessados.
export function reconciliar(intervalos, estado, agora) {
  if (!estado.rodando) {
    return { ...estado, concluida: false, avancou: 0 };
  }

  let indice = estado.indice;
  let fim = estado.fimDoIntervalo;
  let avancou = 0;

  // Cada bloco começa exatamente onde o anterior terminou.
  // Isso evita acumular atraso quando o celular "dorme".
  while (fim <= agora) {
    indice++;
    avancou++;
    if (indice >= intervalos.length) {
      return {
        indice: intervalos.length - 1,
        rodando: false,
        fimDoIntervalo: fim,
        segundosRestantes: 0,
        concluida: true,
        terminouEm: fim,
        avancou,
      };
    }
    fim += intervalos[indice].segundos * 1000;
  }

  return {
    indice,
    rodando: true,
    fimDoIntervalo: fim,
    segundosRestantes: Math.max(Math.ceil((fim - agora) / 1000), 0),
    concluida: false,
    avancou,
  };
}

export function segundosDecorridos(intervalos, indice, segundosRestantes) {
  let total = 0;
  for (let i = 0; i < indice; i++) total += intervalos[i].segundos;
  return total + (intervalos[indice].segundos - segundosRestantes);
}

// Horários absolutos de cada troca de bloco a partir de agora.
// Hoje serve para conferência; na versão Android vira a lista de
// notificações agendadas (toca mesmo com a tela apagada).
export function linhaDoTempo(intervalos, indice, fimDoIntervalo) {
  const eventos = [];
  let momento = fimDoIntervalo;
  for (let i = indice + 1; i < intervalos.length; i++) {
    eventos.push({ em: momento, indice: i, tipo: intervalos[i].tipo, descricao: intervalos[i].descricao });
    momento += intervalos[i].segundos * 1000;
  }
  eventos.push({ em: momento, indice: intervalos.length, tipo: 'fim', descricao: 'Sessão concluída' });
  return eventos;
}
