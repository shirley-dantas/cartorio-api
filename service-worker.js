self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// "Compartilhar" do WhatsApp (e de qualquer aplicativo) para o painel: o celular manda os arquivos por POST para
// /compartilhar. Eles ficam guardados aqui, no aparelho (cache "painel-compartilhado"), e o painel abre em
// /?compartilhado=1 perguntando para qual caso são. Nada vai para a rede nesta etapa.
const CACHE_COMPARTILHADO = 'painel-compartilhado';
async function guardarCompartilhados(request) {
  const form = await request.formData();
  const arquivos = form.getAll('arquivos').filter((f) => f && typeof f !== 'string' && f.size > 0);
  const cache = await caches.open(CACHE_COMPARTILHADO);
  for (const k of await cache.keys()) await cache.delete(k);   // um compartilhamento por vez: o anterior já foi tratado ou descartado
  let i = 0;
  for (const f of arquivos) {
    await cache.put(new Request('/__compartilhado/' + (++i)), new Response(f, { headers: { 'Content-Type': f.type || 'application/octet-stream', 'X-Nome': encodeURIComponent(f.name || 'arquivo') } }));
  }
  return Response.redirect('/?compartilhado=' + (arquivos.length || 0), 303);
}

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method === 'POST' && url.pathname === '/compartilhar') { e.respondWith(guardarCompartilhados(e.request)); return; }
  e.respondWith(fetch(e.request));
});
