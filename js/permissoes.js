// ====================================================================
// PERMISSÕES DO APP ANDROID
// Antes do primeiro treino, explica e pede o que o Android exige.
// Nada aqui bloqueia o treino: os avisos por som e vibração funcionam
// mesmo sem notificação. As telas só ajudam a deixar tudo redondo.
// ====================================================================

import { chamar } from './nativo.js';
import { mostrarDialogo } from './dialogo.js';

const CHAVE_BATERIA_PERGUNTADA = 'treinoCorrida.perguntouBateria';
let avisouNotificacoesNestaAbertura = false;

function abrirConfig(tipo) {
  return () => chamar('abrirConfiguracao', { tipo }).then(() => undefined, () => 'Não consegui abrir as configurações.');
}

export async function prepararPermissoes() {
  let estado;
  try { estado = await chamar('verificarPermissoes'); } catch (e) { return; }

  // 1. Notificações: mostram o treino na tela bloqueada, com Pausar e Encerrar.
  if (estado.notificacoes === 'prompt' || estado.notificacoes === 'prompt-with-rationale') {
    const r = await mostrarDialogo({
      titulo: 'Mostrar o treino nas notificações',
      texto: 'Durante o treino, o app deixa uma notificação fixa com o bloco atual, o tempo que falta e os botões Pausar e Encerrar. ' +
        'Assim você controla tudo sem desbloquear o celular. Os avisos de som, voz e vibração funcionam de qualquer jeito.',
      botoes: [
        { id: 'permitir', texto: 'Permitir notificações', principal: true },
        { id: 'depois', texto: 'Agora não' },
      ],
    });
    if (r.id === 'permitir') {
      try { estado.notificacoes = (await chamar('pedirNotificacoes')).notificacoes; } catch (e) {}
    }
  }
  if (estado.notificacoes === 'denied' && !avisouNotificacoesNestaAbertura) {
    avisouNotificacoesNestaAbertura = true;
    await mostrarDialogo({
      titulo: 'Notificações desligadas',
      texto: 'Sem notificação você não vê o treino na tela bloqueada nem tem os botões Pausar e Encerrar. ' +
        'Os avisos de som, voz e vibração continuam funcionando. Para ligar:',
      passos: [
        'Toque em "Abrir configurações" aqui embaixo.',
        'Ligue a chave "Todas as notificações de Treino de Corrida".',
        'Volte para o app (gesto de voltar).',
      ],
      botoes: [
        { id: 'abrir', texto: 'Abrir configurações', principal: true, fica: true, acao: abrirConfig('notificacoes') },
        { id: 'seguir', texto: 'Continuar sem notificação' },
      ],
    });
  }

  // 2. Bateria "Restrita": o Android não deixa o serviço do treino rodar.
  if (estado.bateriaRestrita) {
    await mostrarDialogo({
      titulo: 'A bateria do app está "Restrita"',
      texto: 'Nesse modo o Android corta o app com a tela apagada, e os avisos param. Para corrigir:',
      passos: [
        'Toque em "Abrir configurações" aqui embaixo.',
        'Toque em "Uso da bateria do app" (ou "Bateria").',
        'Escolha "Sem restrições" ou "Otimizada". Não deixe em "Restrita".',
        'Volte para o app.',
      ],
      botoes: [
        { id: 'abrir', texto: 'Abrir configurações', principal: true, fica: true, acao: abrirConfig('app') },
        { id: 'seguir', texto: 'Já ajustei, continuar' },
      ],
    });
    return;
  }

  // 3. Recomendado, perguntado uma vez só: liberar o app da economia de bateria.
  let jaPerguntou = false;
  try { jaPerguntou = localStorage.getItem(CHAVE_BATERIA_PERGUNTADA) === '1'; } catch (e) {}
  if (!estado.semOtimizacao && !jaPerguntou) {
    try { localStorage.setItem(CHAVE_BATERIA_PERGUNTADA, '1'); } catch (e) {}
    const r = await mostrarDialogo({
      titulo: 'Avisos garantidos no modo economia',
      texto: 'Recomendado: deixe o app funcionar sem restrição de bateria. O Android vai perguntar se pode; responda "Permitir". ' +
        'Isso só pesa na bateria enquanto um treino está rodando.',
      botoes: [
        { id: 'permitir', texto: 'Continuar', principal: true },
        { id: 'depois', texto: 'Agora não' },
      ],
    });
    if (r.id === 'permitir') {
      try { await chamar('pedirSemOtimizacao'); } catch (e) {}
    }
  }
}
