// ====================================================================
// SERVICE WORKER: faz o app abrir mesmo sem internet.
// Estratégia "rede primeiro": com sinal, sempre pega a versão mais nova
// do GitHub; sem sinal, usa a cópia guardada. Assim você nunca fica
// preso numa versão velha depois de uma atualização.
// ====================================================================

const CACHE = 'treino-v2';
const ARQUIVOS = [
  './',
  './index.html',
  './manifest.json',
  './css/estilo.css',
  './js/app.js',
  './js/plano.js',
  './js/sessao.js',
  './js/armazenamento.js',
  './js/alertas.js',
  './icons/icone-192.png',
  './icons/icone-512.png',
  './icons/icone-maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then(resposta => {
        if (resposta.ok && new URL(event.request.url).origin === self.location.origin) {
          const copia = resposta.clone();
          caches.open(CACHE).then(c => c.put(event.request, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});
