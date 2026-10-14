// ====================================================================
// MODO DO SOM
// Três estados, valendo para a Corrida e para a Mobilidade:
//   voz      alertas + voz   (bipes, tons e a voz que diz o exercício)
//   alertas  somente alertas (bipes e tons, sem voz)
//   mudo     sem som         (nada toca; a vibração continua)
// A escolha fica salva no aparelho e todos os botões de som da página
// mostram o mesmo estado.
// ====================================================================

export const MODOS = ['voz', 'alertas', 'mudo']; // ordem em que o toque alterna
export const CHAVE_SOM = 'treinoCorrida.somModo';

export const ROTULOS_SOM = {
  voz: 'Alertas + voz',
  alertas: 'Só alertas',
  mudo: 'Sem som',
};

export function normalizarModo(valor) {
  return MODOS.includes(valor) ? valor : 'voz';
}

export function proximoModo(modo) {
  return MODOS[(MODOS.indexOf(normalizarModo(modo)) + 1) % MODOS.length];
}

// Os bipes e tons tocam neste modo?
export function tocaTom(modo) { return normalizarModo(modo) !== 'mudo'; }
// A voz fala neste modo?
export function falaVoz(modo) { return normalizarModo(modo) === 'voz'; }

// Número que o serviço Android entende: 0 sem som, 1 só alertas, 2 alertas e voz.
export function codigoNativo(modo) {
  return { mudo: 0, alertas: 1, voz: 2 }[normalizarModo(modo)];
}

// ---- estado e persistência ----
function ler() {
  try { return normalizarModo(localStorage.getItem(CHAVE_SOM)); } catch (e) { return 'voz'; }
}

let atual = ler();
const ouvintes = [];

export function modoAtual() { return atual; }

export function definirModo(modo) {
  atual = normalizarModo(modo);
  try { localStorage.setItem(CHAVE_SOM, atual); } catch (e) {}
  ouvintes.forEach(f => { try { f(atual); } catch (e) {} });
  return atual;
}

export function alternarModo() { return definirModo(proximoModo(atual)); }

// Chama f(modo) sempre que o modo mudar (em qualquer botão).
export function aoMudarDeModo(f) { ouvintes.push(f); }

// ---- botão ----
// O elemento precisa ter dentro dele um <use> (ícone) e um .btnSomTexto.
export function ligarBotaoSom(botao) {
  const atualizar = modo => {
    const uso = botao.querySelector('use');
    if (uso) uso.setAttribute('href', '#i-som-' + modo);
    const texto = botao.querySelector('.btnSomTexto');
    if (texto) texto.textContent = ROTULOS_SOM[modo];
    botao.setAttribute('aria-label', 'Som: ' + ROTULOS_SOM[modo] + '. Toque para mudar.');
    botao.dataset.modo = modo;
  };
  atualizar(atual);
  aoMudarDeModo(atualizar);
  botao.addEventListener('click', () => alternarModo());
}
