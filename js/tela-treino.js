// ====================================================================
// TELA DA ROTINA DE MOBILIDADE
// Liga a lógica de treino.js (e o teste salvo no aparelho) à página
// "Mobilidade". Também roda o cronômetro por exercício, com o mesmo
// relógio da corrida (sessao.js): a verdade é o horário real, não um
// contador, então pausar e voltar de outro app não desajusta a contagem.
// A rotina em andamento não é guardada se o app for fechado.
// ====================================================================

import { MOVIMENTOS, REGIOES } from './biblioteca.js';
import {
  TIPOS, MODALIDADES, PARTES, TEMPOS,
  gerarRotina, lembrarRecentes, notasPorRegiao, montarEtapas, tipoDeTroca,
  rotuloAvancar, rotuloVoltar, planoDeVoltar, perfisIguais, regioesTrabalhadas,
} from './treino.js';
import {
  carregarPerfilMobilidade, salvarPerfilMobilidade,
  carregarRotina, salvarRotina,
  registrarRotinaFeita, carregarSessaoAtiva,
} from './armazenamento.js';
import { formatarTempo, formatarRelogio } from './plano.js';
import { reconciliar, segundosDecorridos } from './sessao.js';
import { confirmar } from './dialogo.js';
import * as som from './som-rotina.js';
import { modoAtual, tocaTom, aoMudarDeModo } from './som-modo.js';

const $ = id => document.getElementById(id);

const ROTULO_MODO = { passivo: 'alongamento', ativo: 'movimento', ativacao: 'ativação', relaxamento: 'relaxamento' };
const AJUDA_TIPO = {
  ativar: 'Ativar: prepara o corpo antes do treino. Só movimentos, sem alongamento parado.',
  recuperar: 'Recuperar: solta o corpo depois do treino, com alongamentos e respiração.',
  diario: 'Diário: mobilidade geral, para qualquer hora do dia.',
};
const ESCOLHA_INICIAL = { tipo: 'ativar', modalidade: 'corrida', parte: 'full', minutos: 6 };
const RAIO = 110;
const CIRCUNFERENCIA = 2 * Math.PI * RAIO;

let perfil = carregarPerfilMobilidade();
let rotina = carregarRotina();

// ---- estado do cronômetro ----
let resultado = null;     // última rotina montada
let escolhaDaRotina = null; // { tipo, modalidade, parte, minutos } com que ela foi montada
let etapas = [];
let totalSegundos = 0;
let indice = 0;
let segundosRestantes = 0;
let fimDoIntervalo = 0;
let rodando = false;
let iniciada = false;
let concluida = false;
let timerId = null;
let ultimoBip = null;
let wakeLock = null;
let telaAcesaIndisponivel = false; // o navegador não deixou manter a tela acesa
let itens = [];           // um <li> por exercício

function preencherSelect(id, opcoes, valorAtual) {
  const sel = $(id);
  sel.innerHTML = '';
  opcoes.forEach(o => {
    const op = document.createElement('option');
    op.value = String(o.valor);
    op.textContent = o.texto;
    sel.appendChild(op);
  });
  sel.value = String(valorAtual);
}

function lerEscolha() {
  return {
    tipo: $('selTipo').value,
    modalidade: $('selModalidade').value,
    parte: $('selParte').value,
    minutos: Number($('selTempo').value),
  };
}

// 45 -> "45s", 60 -> "1 min", 595 -> "9 min 55s"
function formatarDuracao(segundos) {
  return segundos < 60 ? segundos + 's' : formatarTempo(segundos);
}

// Total da rotina para o resumo: 600 -> "10 min", 595 -> "cerca de 10 min"
function descreverTotal(segundos) {
  if (segundos % 60 === 0) return Math.round(segundos / 60) + ' min';
  return 'cerca de ' + Math.max(1, Math.round(segundos / 60)) + ' min';
}

// ['A'] -> "A", ['A','B'] -> "A e B", ['A','B','C'] -> "A, B e C"
function listaEmPortugues(itens) {
  if (itens.length <= 1) return itens.join('');
  return itens.slice(0, -1).join(', ') + ' e ' + itens[itens.length - 1];
}

function nomeDe(lista, id) {
  const item = lista.find(x => x.id === id);
  return item ? item.nome : id;
}

// ---------------- entrada ----------------
function atualizarAjudaDoTipo() {
  $('ajudaTipo').textContent = AJUDA_TIPO[$('selTipo').value] || '';
}

// "Repetir a última": um toque para a escolha mais recente.
function atualizarRepetirUltima() {
  const e = rotina.escolha;
  const botao = $('btnRepetirUltima');
  botao.hidden = !e;
  if (!e) return;
  botao.textContent = 'Repetir a última: ' +
    [nomeDe(TIPOS, e.tipo), nomeDe(MODALIDADES, e.modalidade), nomeDe(PARTES, e.parte), e.minutos + ' min'].join(' · ');
}

async function repetirUltima() {
  const e = rotina.escolha;
  if (!e) return;
  $('selTipo').value = e.tipo;
  $('selModalidade').value = e.modalidade;
  $('selParte').value = e.parte;
  $('selTempo').value = String(e.minutos);
  atualizarAjudaDoTipo();
  await montarRotina();
}

// ---------------- montar e mostrar a rotina ----------------
async function montarRotina() {
  if (emAndamento()) {
    const sim = await confirmar({
      titulo: 'Descartar a rotina em andamento?',
      texto: 'O cronômetro desta rotina será perdido.',
      ok: 'Descartar',
    });
    if (!sim) return;
  }
  pararTudo();
  const escolha = lerEscolha();
  resultado = gerarRotina({ ...escolha, perfil, recentes: rotina.recentes });
  escolhaDaRotina = escolha;
  rotina = { escolha, recentes: lembrarRecentes(rotina.recentes, resultado) };
  salvarRotina(rotina);
  atualizarRepetirUltima();
  mostrarResultado(resultado);
}

function mostrarResultado(r) {
  $('avisoRotinaVelha').hidden = true;
  const resumo = $('rotinaResumo');
  const semTeste = Object.keys(perfil).length === 0;
  let foco = '';
  if (r.focos.length > 0) {
    foco = '\nFoco pelo seu teste: ' + r.focos.map(f => f.nome + ' (' + f.nota + ')').join(', ');
  } else if (semTeste) {
    foco = '\nSem teste preenchido: a ordem é a padrão.';
  } else {
    foco = '\nSeu teste não mostra nenhum movimento abaixo de 80.';
  }
  resumo.textContent = r.exercicios.length + ' exercícios · ' + descreverTotal(r.totalSegundos) + foco;
  resumo.hidden = false;
  $('btnAbrirTeste').hidden = !semTeste;

  const lista = $('listaRotina');
  lista.innerHTML = '';
  itens = r.exercicios.map(e => {
    const li = document.createElement('li');
    li.className = 'exercicio';

    const topo = document.createElement('div');
    topo.className = 'exercicioTopo';
    const nome = document.createElement('span');
    nome.className = 'exercicioNome';
    nome.textContent = e.nome;
    const tempo = document.createElement('span');
    tempo.className = 'tempo';
    tempo.textContent = e.porLado ? e.segundosPorLado + 's cada lado' : formatarDuracao(e.segundos);
    topo.append(nome, tempo);

    const instrucao = document.createElement('div');
    instrucao.className = 'exercicioTexto';
    instrucao.textContent = e.instrucao;

    const etiquetas = document.createElement('div');
    etiquetas.className = 'exercicioEtiquetas';
    etiquetas.textContent = [ROTULO_MODO[e.modo]]
      .concat(e.motivos.map(m => 'trabalha ' + m.toLowerCase()))
      .join(' · ');

    li.append(topo, instrucao, etiquetas);
    lista.appendChild(li);
    return li;
  });

  esconderFecho();
  $('btnIniciarRotina').textContent = 'Iniciar rotina';
  $('btnIniciarRotina').hidden = false;
}

// ---------------- cronômetro ----------------
function emAndamento() { return iniciada && !concluida; }

function ligarTimer() { desligarTimer(); timerId = setInterval(tick, 250); }
function desligarTimer() {
  if (timerId !== null) { clearInterval(timerId); timerId = null; }
}

function avisarEntrada(tipo) {
  const nome = resultado.exercicios[etapas[indice].exercicio].nome;
  if (tipo === 'lado') som.avisarLado();
  else if (tipo === 'exercicio') som.avisarExercicio();
  else if (tipo === 'preparo') som.avisarPreparo(nome, false);
  else if (tipo === 'inicio') som.avisarPreparo(nome, true);
}

async function iniciarRotina() {
  if (!resultado || resultado.exercicios.length === 0) return;
  som.destravar();
  // A corrida está rodando? Dois cronômetros avisando juntos confundem: pergunta antes.
  const corrida = carregarSessaoAtiva();
  if (corrida && corrida.rodando) {
    const sim = await confirmar({
      titulo: 'A corrida está rodando',
      texto: 'Se iniciar a rotina agora, os avisos dos dois cronômetros vão tocar juntos.',
      ok: 'Iniciar a rotina mesmo assim',
    });
    if (!sim) return;
  }
  pararTudo();
  etapas = montarEtapas(resultado);
  totalSegundos = etapas.reduce((s, e) => s + e.segundos, 0);
  indice = 0;
  segundosRestantes = etapas[0].segundos;
  fimDoIntervalo = Date.now() + segundosRestantes * 1000;
  rodando = true;
  iniciada = true;
  concluida = false;
  ultimoBip = null;
  $('btnIniciarRotina').hidden = true;
  esconderFecho();
  ligarTimer();
  pegarWakeLock();
  atualizarCronometro();
  mostrarExecucao();
  avisarEntrada('inicio');
}

function tick() {
  if (!rodando) return;
  const r = reconciliar(etapas, { indice, rodando, fimDoIntervalo, segundosRestantes }, Date.now());

  if (r.concluida) {
    concluirRotina();
    return;
  }

  indice = r.indice;
  fimDoIntervalo = r.fimDoIntervalo;
  segundosRestantes = r.segundosRestantes;

  if (r.avancou > 0) {
    // Mesmo que várias etapas tenham passado (app congelado), avisa só a atual.
    ultimoBip = null;
    avisarEntrada(tipoDeTroca(etapas, indice));
  } else if (segundosRestantes <= 3 && segundosRestantes > 0 && segundosRestantes !== ultimoBip) {
    ultimoBip = segundosRestantes;
    som.bipContagem();
  }
  atualizarCronometro();
}

function alternarPausa() {
  if (!emAndamento()) return;
  if (rodando) {
    segundosRestantes = Math.max(Math.ceil((fimDoIntervalo - Date.now()) / 1000), 0);
    rodando = false;
    desligarTimer();
    soltarWakeLock();
  } else {
    som.destravar();
    fimDoIntervalo = Date.now() + segundosRestantes * 1000;
    rodando = true;
    ligarTimer();
    pegarWakeLock();
  }
  atualizarCronometro();
}

function irParaEtapa(novoIndice) {
  const tipo = tipoDeTroca(etapas, novoIndice);
  indice = novoIndice;
  segundosRestantes = etapas[indice].segundos;
  fimDoIntervalo = Date.now() + segundosRestantes * 1000;
  ultimoBip = null;
  avisarEntrada(tipo);
  atualizarCronometro();
}

function avancar() {
  if (!emAndamento() || indice >= etapas.length - 1) return;
  som.destravar();
  irParaEtapa(indice + 1);
}

// Como num player de música: se a etapa já passou de 2 segundos, reinicia
// a etapa; se acabou de começar, volta para a anterior (pulando o preparo).
function retroceder() {
  if (!emAndamento()) return;
  som.destravar();
  const plano = planoDeVoltar(etapas, indice, segundosRestantes);
  if (plano.acao === 'recomecar') {
    segundosRestantes = etapas[indice].segundos;
    fimDoIntervalo = Date.now() + segundosRestantes * 1000;
    ultimoBip = null;
    atualizarCronometro();
  } else if (plano.acao === 'ir') {
    irParaEtapa(plano.alvo);
  }
}

function concluirRotina() {
  desligarTimer();
  soltarWakeLock();
  rodando = false;
  concluida = true;
  segundosRestantes = 0;
  indice = etapas.length - 1;
  som.avisarFim();
  atualizarCronometro();
  if (escolhaDaRotina) registrarRotinaFeita(escolhaDaRotina.tipo, escolhaDaRotina.modalidade, Date.now());
  mostrarFecho();
}

// Fecho da rotina: diz o que vem a seguir no dia de corrida.
function mostrarFecho() {
  const e = escolhaDaRotina || {};
  let texto = '✓ Rotina concluída';
  let acao = { texto: 'Voltar ao início', hash: '' };
  if (e.modalidade === 'corrida' && e.tipo === 'ativar') {
    texto = '✓ Ativação concluída. Hora de correr.';
    acao = { texto: 'Ir para a corrida', hash: '#corrida' };
  } else if (e.modalidade === 'corrida' && e.tipo === 'recuperar') {
    texto = '✓ Recuperação concluída. Dia de corrida completo.';
  }
  $('rotinaFimTexto').textContent = texto;
  // O que foi trabalhado e por quanto tempo: o fim não é só "acabou".
  const regioes = regioesTrabalhadas(resultado);
  const tempo = descreverTotal(totalSegundos);
  $('rotinaFimTrabalho').textContent = regioes.length > 0
    ? 'Você trabalhou: ' + listaEmPortugues(regioes) + ' · ' + tempo
    : 'Tempo total: ' + tempo;
  const botao = $('btnFimAcao');
  botao.textContent = acao.texto;
  botao.dataset.hash = acao.hash;
  $('rotinaFim').hidden = false;
  // O fecho é fixo na base da tela: aparece onde você estiver, sem rolagem.
  $('paginaMobilidade').classList.add('comFecho');
  botao.focus({ preventScroll: true });
}

function esconderFecho() {
  $('rotinaFim').hidden = true;
  $('paginaMobilidade').classList.remove('comFecho');
}

async function encerrar() {
  if (!emAndamento()) return;
  const sim = await confirmar({
    titulo: 'Encerrar a rotina agora?',
    texto: 'Ela não será registrada como concluída.',
    ok: 'Encerrar rotina',
    cancelar: 'Continuar rotina',
  });
  if (!sim || !emAndamento()) return;
  pararTudo();
  $('btnIniciarRotina').textContent = 'Iniciar rotina';
  $('btnIniciarRotina').hidden = false;
}

// Volta ao estado "só a lista", sem cronômetro.
function pararTudo() {
  desligarTimer();
  soltarWakeLock();
  rodando = false;
  iniciada = false;
  concluida = false;
  esconderExecucao();
  itens.forEach(li => li.classList.remove('ativoRotina', 'feito'));
  esconderFecho();
}

// ---------------- wake lock (tela acesa durante os exercícios) ----------------
async function pegarWakeLock() {
  if (wakeLock !== null) return;
  if (!('wakeLock' in navigator)) {
    telaAcesaIndisponivel = true;
    atualizarAvisosExecucao();
    return;
  }
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    telaAcesaIndisponivel = false;
  } catch (e) {
    wakeLock = null;
    telaAcesaIndisponivel = true;
  }
  atualizarAvisosExecucao();
}
async function soltarWakeLock() {
  if (wakeLock === null) return;
  try { await wakeLock.release(); } catch (e) {}
  wakeLock = null;
}

// ---------------- execução em tela cheia ----------------
const POSTURA_TEXTO = { chao: 'no chão', joelhos: 'de joelhos', em_pe: 'em pé' };

// Avisos de coisas que, sem isso, falham em silêncio: som bloqueado pelo
// navegador e tela que não dá para manter acesa.
function atualizarAvisosExecucao() {
  // "Sem som" é escolha sua: não é o navegador bloqueando.
  const semSom = tocaTom(modoAtual()) && !som.audioLiberado();
  let texto = '';
  if (semSom) texto = 'Som desligado pelo navegador: os avisos não vão tocar.';
  else if (telaAcesaIndisponivel) texto = 'Não consegui manter a tela acesa. Se ela apagar, os avisos param.';
  $('execAvisoTexto').textContent = texto;
  $('btnExecAviso').hidden = !semSom;
  $('execAviso').hidden = texto === '';
}

function mostrarExecucao() {
  $('execucao').hidden = false;
  document.body.classList.add('emExecucao');
  $('btnExecPausar').focus({ preventScroll: true });
}

function esconderExecucao() {
  $('execucao').hidden = true;
  document.body.classList.remove('emExecucao');
}

function atualizarCronometro() {
  if (!iniciada) return;
  const etapa = etapas[indice];

  // A lista por trás acompanha (vale quando você sai da tela cheia).
  itens.forEach((li, i) => {
    li.classList.toggle('ativoRotina', !concluida && i === etapa.exercicio);
    li.classList.toggle('feito', concluida || i < etapa.exercicio);
  });

  if (concluida) { esconderExecucao(); return; }

  const exercicio = resultado.exercicios[etapa.exercicio];
  const proximo = resultado.exercicios[etapa.exercicio + 1];
  $('execucao').classList.toggle('preparo', etapa.preparo);

  $('execContador').textContent = 'Exercício ' + (etapa.exercicio + 1) + ' de ' + resultado.exercicios.length;
  if (etapa.preparo) {
    $('execChip').textContent = 'Prepare-se · ' + POSTURA_TEXTO[exercicio.postura];
  } else {
    $('execChip').textContent = etapa.lados === 2 ? 'Lado ' + etapa.lado + ' de 2' : '';
  }
  $('execNome').textContent = exercicio.nome;
  $('execInstrucao').textContent = exercicio.instrucao;
  $('execProximo').textContent = etapa.preparo ? '' : (proximo ? 'Próximo: ' + proximo.nome : 'Último exercício');
  $('execRelogio').textContent = formatarRelogio(segundosRestantes);

  const fracao = Math.max(0, Math.min((etapa.segundos - segundosRestantes) / etapa.segundos, 1));
  $('execProg').style.strokeDashoffset = String(CIRCUNFERENCIA * (1 - fracao));

  const decorrido = segundosDecorridos(etapas, indice, segundosRestantes);
  $('execTotal').textContent = formatarRelogio(decorrido) + ' / ' + formatarRelogio(totalSegundos);
  $('execBarra').style.width = Math.min(decorrido / totalSegundos, 1) * 100 + '%';

  $('btnExecPausar').textContent = rodando ? 'Pausar' : 'Continuar';
  // Espaço que não quebra: a seta nunca fica sozinha em outra linha.
  const rVoltar = rotuloVoltar(etapas, indice, segundosRestantes);
  $('btnExecVoltar').textContent = '‹\u00a0' + (rVoltar || 'Voltar');
  $('btnExecVoltar').disabled = rVoltar === null;
  const rPular = rotuloAvancar(etapas, indice);
  $('btnExecPular').textContent = (rPular || 'Pular') + '\u00a0›';
  $('btnExecPular').disabled = rPular === null;
  atualizarAvisosExecucao();
}

// ---------------- meu teste de mobilidade ----------------
function desenharCamposDoPerfil() {
  const area = $('perfilCampos');
  area.innerHTML = '';
  Object.keys(MOVIMENTOS).forEach(chave => {
    const m = MOVIMENTOS[chave];
    const linha = document.createElement('label');
    linha.className = 'perfilLinha';
    const nome = document.createElement('span');
    nome.textContent = m.nome;
    linha.appendChild(nome);

    const campos = document.createElement('span');
    campos.className = 'perfilNumeros';
    const quantos = m.lados ? 2 : 1;
    for (let i = 0; i < quantos; i++) {
      const input = document.createElement('input');
      input.type = 'number';
      input.inputMode = 'numeric';
      input.min = '0';
      input.max = '100';
      input.step = '1';
      input.id = 'mob_' + chave + '_' + i;
      input.setAttribute('aria-label', m.nome + (m.lados ? (i === 0 ? ' esquerdo' : ' direito') : ''));
      const v = perfil[chave] && perfil[chave][i];
      input.value = typeof v === 'number' ? String(v) : '';
      campos.appendChild(input);
    }
    linha.appendChild(campos);
    area.appendChild(linha);
  });
  mostrarNotasPorRegiao();
}

function mostrarNotasPorRegiao() {
  const notas = notasPorRegiao(perfil);
  const partes = Object.keys(REGIOES)
    .filter(r => notas[r] !== null)
    .map(r => REGIOES[r] + ' ' + notas[r]);
  $('perfilRegioes').textContent = partes.length > 0 ? 'Por região: ' + partes.join(' · ') : '';
}

function salvarPerfil() {
  const novo = {};
  let invalido = null;
  Object.keys(MOVIMENTOS).forEach(chave => {
    const quantos = MOVIMENTOS[chave].lados ? 2 : 1;
    const valores = [];
    for (let i = 0; i < quantos; i++) {
      const texto = $('mob_' + chave + '_' + i).value.trim();
      if (texto === '') continue;
      const n = Number(texto);
      if (!Number.isFinite(n) || n < 0 || n > 100) { invalido = MOVIMENTOS[chave].nome; return; }
      valores.push(Math.round(n));
    }
    if (valores.length > 0) novo[chave] = valores;
  });
  if (invalido) {
    $('perfilAviso').textContent = 'Use notas de 0 a 100 em: ' + invalido + '.';
    return;
  }
  const mudou = !perfisIguais(perfil, novo);
  perfil = novo;
  salvarPerfilMobilidade(perfil);
  mostrarNotasPorRegiao();
  if (mudou && emAndamento()) {
    $('perfilAviso').textContent = 'Teste salvo. A rotina em andamento segue como está; vale para a próxima que você montar.';
  } else {
    $('perfilAviso').textContent = 'Teste salvo neste aparelho.';
    // A rotina que já está na tela foi montada com o teste anterior: avisa e deixa você decidir.
    if (mudou && resultado) $('avisoRotinaVelha').hidden = false;
  }
}

// ---------------- entradas e estado para o resto do app ----------------
function limparResultado() {
  resultado = null;
  escolhaDaRotina = null;
  itens = [];
  $('listaRotina').innerHTML = '';
  $('rotinaResumo').hidden = true;
  $('btnAbrirTeste').hidden = true;
  $('avisoRotinaVelha').hidden = true;
  esconderFecho();
  $('btnIniciarRotina').hidden = true;
}

// Abre a Mobilidade com Tipo e Modalidade já escolhidos. Com montar: true a
// rotina aparece pronta (falta só Iniciar); sem, você escolhe a parte do corpo.
export async function abrirRotina({ tipo, modalidade, montar }) {
  if (emAndamento()) {
    const sim = await confirmar({
      titulo: 'Descartar a rotina em andamento?',
      texto: 'O cronômetro da rotina atual será perdido.',
      ok: 'Descartar',
      cancelar: 'Continuar a atual',
    });
    if (!sim) return;
  }
  pararTudo();
  // A parte do corpo de um treino de musculação não vale para a corrida (e vice versa).
  if (rotina.escolha && rotina.escolha.modalidade !== modalidade) $('selParte').value = 'full';
  $('selTipo').value = tipo;
  $('selModalidade').value = modalidade;
  atualizarAjudaDoTipo();
  if (montar) montarRotina(); else limparResultado();
  location.hash = '#mobilidade';
}

// Para a faixa de "em andamento": null se não há rotina rodando ou pausada.
export function estadoRotina() {
  if (!emAndamento()) return null;
  const etapa = etapas[indice];
  return {
    rodando,
    descricao: 'Exercício ' + (etapa.exercicio + 1) + ' de ' + resultado.exercicios.length,
    segundosRestantes: rodando
      ? Math.max(Math.ceil((fimDoIntervalo - Date.now()) / 1000), 0)
      : segundosRestantes,
  };
}

// ---------------- início ----------------
export function iniciarTelaTreino() {
  const e = rotina.escolha || ESCOLHA_INICIAL;
  preencherSelect('selTipo', TIPOS.map(t => ({ valor: t.id, texto: t.nome })), e.tipo);
  preencherSelect('selModalidade', MODALIDADES.map(m => ({ valor: m.id, texto: m.nome })), e.modalidade);
  preencherSelect('selParte', PARTES.map(p => ({ valor: p.id, texto: p.nome })), e.parte);
  preencherSelect('selTempo', TEMPOS.map(t => ({ valor: t, texto: t + ' min' })), e.minutos);
  desenharCamposDoPerfil();

  atualizarAjudaDoTipo();
  atualizarRepetirUltima();
  $('selTipo').addEventListener('change', atualizarAjudaDoTipo);
  $('btnRepetirUltima').addEventListener('click', repetirUltima);
  $('btnAbrirTeste').addEventListener('click', () => {
    const detalhes = $('perfilMobilidade');
    detalhes.open = true;
    detalhes.scrollIntoView({ block: 'start' });
  });

  $('btnMontarRotina').addEventListener('click', montarRotina);
  $('btnIniciarRotina').addEventListener('click', iniciarRotina);
  $('btnSalvarPerfil').addEventListener('click', salvarPerfil);
  $('btnFimAcao').addEventListener('click', () => { location.hash = $('btnFimAcao').dataset.hash || ''; });
  $('btnRepetir').addEventListener('click', iniciarRotina);
  $('btnExecPausar').addEventListener('click', alternarPausa);
  $('btnExecVoltar').addEventListener('click', retroceder);
  $('btnExecPular').addEventListener('click', avancar);
  $('btnExecEncerrar').addEventListener('click', encerrar);
  $('btnExecAviso').addEventListener('click', () => { som.destravar(); setTimeout(atualizarAvisosExecucao, 150); });
  $('btnRemontar').addEventListener('click', montarRotina);
  aoMudarDeModo(atualizarAvisosExecucao);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && rodando) { pegarWakeLock(); tick(); }
  });
}
