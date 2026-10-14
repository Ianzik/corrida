// ====================================================================
// NAVEGAÇÃO E INÍCIO
// Três telas na mesma página: início, corrida e mobilidade. A tela
// aparece conforme o endereço (#corrida, #mobilidade, vazio = início).
// Assim o botão voltar do Android leva ao início, e o cronômetro da
// corrida continua rodando se você olhar a mobilidade.
//
// A tela inicial é organizada em torno do dia de treino: em dia de
// corrida, ativar > correr > recuperar; em dia de musculação, só ativar
// ou só recuperar. Também mostra uma faixa quando algo está rodando
// em outra tela.
// ====================================================================

import { carregarProgresso, carregarSessaoAtiva, carregarRotinasFeitas } from './armazenamento.js';
import { TOTAL_SESSOES, nomeDaSessao, intervalosDaPosicao, formatarRelogio } from './plano.js';
import { passosDeHoje, proximoPasso } from './dia.js';
import { abrirRotina, estadoRotina } from './tela-treino.js';

const PAGINAS = { home: 'paginaHome', corrida: 'paginaCorrida', mobilidade: 'paginaMobilidade' };

const $ = id => document.getElementById(id);

function paginaAtual() {
  const nome = location.hash.replace('#', '');
  return PAGINAS[nome] ? nome : 'home';
}

// ---------------- o dia ----------------
function proximaSessao() {
  const progresso = carregarProgresso();
  return { progresso, posicao: Math.min(progresso.concluidas, TOTAL_SESSOES - 1) };
}

function atualizarHome() {
  const { progresso, posicao } = proximaSessao();
  const feitos = passosDeHoje(carregarRotinasFeitas(), progresso.historico, Date.now());
  const proximo = proximoPasso(feitos);
  const emAndamento = !!carregarSessaoAtiva();

  document.querySelectorAll('#passosDia li').forEach(li => {
    const passo = li.dataset.passo;
    li.classList.toggle('feito', feitos[passo]);
    li.classList.toggle('proximo', passo === proximo);
    li.querySelector('.passoMarca').textContent = feitos[passo] ? '✓' : '';
  });
  $('passoCorridaSub').textContent = feitos.corrida
    ? 'feita hoje'
    : (emAndamento ? 'em andamento · ' : '') + nomeDaSessao(posicao);

  const rotulos = {
    ativar: 'Começar: Ativar',
    corrida: (emAndamento ? 'Continuar a corrida' : 'Correr') + ': ' + nomeDaSessao(posicao),
    recuperar: 'Recuperar',
  };
  const botao = $('diaProximo');
  botao.textContent = proximo ? rotulos[proximo] : '✓ Dia de corrida concluído';
  botao.dataset.passo = proximo || '';
  botao.disabled = proximo === null;
}

function irParaPasso(passo) {
  if (passo === 'corrida') { location.hash = '#corrida'; return; }
  if (passo === 'ativar' || passo === 'recuperar') {
    abrirRotina({ tipo: passo, modalidade: 'corrida', montar: true });
  }
}

// ---------------- faixa "em andamento" ----------------
function estadoCorrida() {
  const s = carregarSessaoAtiva();
  if (!s || s.posicao < 0 || s.posicao >= TOTAL_SESSOES) return null;
  const bloco = intervalosDaPosicao(s.posicao)[s.indice];
  if (!bloco) return null;
  return {
    rodando: !!s.rodando,
    descricao: bloco.descricao,
    segundosRestantes: s.rodando
      ? Math.max(Math.ceil((s.fimDoIntervalo - Date.now()) / 1000), 0)
      : s.segundosRestantes,
  };
}

function mostrarFaixa(id, nome, estado) {
  const el = $(id);
  el.hidden = !estado;
  if (!estado) return;
  el.textContent = nome + (estado.rodando ? ' em andamento' : ' pausada') +
    ' · ' + estado.descricao + ' · ' + formatarRelogio(estado.segundosRestantes) + ' ›';
}

function atualizarFaixas() {
  const pagina = paginaAtual();
  const corrida = pagina === 'corrida' ? null : estadoCorrida();
  const rotina = pagina === 'mobilidade' ? null : estadoRotina();
  mostrarFaixa('faixaCorrida', 'Corrida', corrida);
  mostrarFaixa('faixaRotina', 'Rotina', rotina);
  // Bolinha na aba da atividade que está rodando em outra tela.
  $('abaCorrida').classList.toggle('emAndamento', corrida !== null);
  $('abaMobilidade').classList.toggle('emAndamento', rotina !== null);
}

// ---------------- páginas ----------------
function mostrar() {
  const atual = paginaAtual();
  Object.keys(PAGINAS).forEach(nome => { $(PAGINAS[nome]).hidden = nome !== atual; });
  document.querySelectorAll('.aba').forEach(aba => {
    if (aba.dataset.pagina === atual) aba.setAttribute('aria-current', 'page');
    else aba.removeAttribute('aria-current');
  });
  if (atual === 'home') atualizarHome();
  atualizarFaixas();
  window.scrollTo(0, 0);
}

export function iniciarNavegacao() {
  window.addEventListener('hashchange', mostrar);

  $('diaProximo').addEventListener('click', () => irParaPasso($('diaProximo').dataset.passo));
  document.querySelectorAll('#passosDia li button').forEach(b => {
    b.addEventListener('click', () => irParaPasso(b.closest('li').dataset.passo));
  });
  $('atalhoAtivar').addEventListener('click', () =>
    abrirRotina({ tipo: 'ativar', modalidade: 'musculacao', montar: false }));
  $('atalhoRecuperar').addEventListener('click', () =>
    abrirRotina({ tipo: 'recuperar', modalidade: 'musculacao', montar: false }));

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (paginaAtual() === 'home') atualizarHome();
    atualizarFaixas();
  });
  setInterval(() => { if (document.visibilityState === 'visible') atualizarFaixas(); }, 1000);

  mostrar();
}
