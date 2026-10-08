self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
// Só repassa o que é do próprio painel. Pedidos para fora (Firebase, Google Agenda,
// e-mail de ajuda) seguem direto, sem passar por aqui.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(fetch(e.request));
});
