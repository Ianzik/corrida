// ====================================================================
// PONTE COM O ANDROID
// Quando o site roda dentro do app Android (Capacitor), existe um
// objeto window.Capacitor que conversa com o código nativo (Java).
// No navegador ele não existe, e tudo aqui responde "não sou nativo".
// ====================================================================

const PLUGIN = 'Treino';

function capacitor() {
  return typeof window !== 'undefined' ? window.Capacitor : undefined;
}

export function ehAppNativo() {
  const cap = capacitor();
  return !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
}

// Chama um método do plugin Java. Devolve uma Promise.
export function chamar(metodo, opcoes) {
  if (!ehAppNativo()) return Promise.reject(new Error('não é o app nativo'));
  return capacitor().nativePromise(PLUGIN, metodo, opcoes || {});
}

// Escuta eventos que o Java manda (ex.: "pausou pela notificação").
export function ouvir(evento, callback) {
  if (!ehAppNativo()) return;
  capacitor().addListener(PLUGIN, evento, callback);
}
