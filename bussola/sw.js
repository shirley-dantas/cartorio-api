// Service worker próprio do Bússola, com escopo /bussola/. É ele (junto com o
// manifest.json desta pasta) que faz o Bússola ser um aplicativo separado: sem
// isso, o painel — instalado com escopo "/" — reclamava a página para si, e o
// "Instalar" abria o painel. Não guarda nada em cache: só repassa.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request)); });
