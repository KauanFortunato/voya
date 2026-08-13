const DOCUMENT_CACHE = 'voya-documents-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  const isDocumentFile = event.request.method === 'GET'
    && url.origin === self.location.origin
    && /^\/api\/documents\/[^/]+\/file$/.test(url.pathname)

  if (!isDocumentFile) return

  event.respondWith((async () => {
    try {
      return await fetch(event.request)
    } catch {
      const cached = await caches.open(DOCUMENT_CACHE).then((cache) => cache.match(event.request))
      return cached ?? new Response('Documento indisponível offline', {
        status: 503,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      })
    }
  })())
})
