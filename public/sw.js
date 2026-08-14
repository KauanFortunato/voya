const APP_CACHE = 'voya-app-v1'
const APP_CACHE_PREFIX = 'voya-app-'
const DOCUMENT_CACHE = 'voya-documents-v1'
const APP_SHELL_RESOURCES = [
  '/manifest.webmanifest',
  '/icons/voya-192.png',
  '/icons/voya-512.png',
  '/icons/voya-maskable-192.png',
  '/icons/voya-maskable-512.png',
  '/icons/favicon-64.png',
  '/icons/apple-touch-icon.png',
]

async function cacheAppShell() {
  const cache = await caches.open(APP_CACHE)
  const response = await fetch('/', { cache: 'no-store' })
  if (!response.ok) throw new Error('Não foi possível preparar o shell offline')

  await cache.put('/', response.clone())
  const html = await response.text()
  const versionedAssets = [...html.matchAll(/(?:src|href)="(\/assets\/[^"#?]+)"/g)]
    .map((match) => match[1])
  const resources = [...new Set([...APP_SHELL_RESOURCES, ...versionedAssets])]

  await Promise.all(resources.map(async (resource) => {
    const assetResponse = await fetch(resource, { cache: 'no-store' })
    if (assetResponse.ok) await cache.put(resource, assetResponse)
  }))
}

self.addEventListener('install', (event) => {
  event.waitUntil(cacheAppShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const cacheNames = await caches.keys()
    await Promise.all(cacheNames
      .filter((name) => name.startsWith(APP_CACHE_PREFIX) && name !== APP_CACHE)
      .map((name) => caches.delete(name)))
    await self.clients.claim()
  })())
})

async function cacheFirst(request) {
  const cache = await caches.open(APP_CACHE)
  const cached = await cache.match(request)
  if (cached) return cached
  const response = await fetch(request)
  if (response.ok) await cache.put(request, response.clone())
  return response
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(APP_CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) await cache.put('/', response.clone())
    return response
  } catch {
    return (await cache.match('/')) ?? new Response('Voya indisponível offline', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return

  const isDocumentFile = /^\/api\/documents\/[^/]+\/file$/.test(url.pathname)
  if (isDocumentFile) {
    event.respondWith((async () => {
      try {
        return await fetch(request)
      } catch {
        const cached = await caches.open(DOCUMENT_CACHE).then((cache) => cache.match(request))
        return cached ?? new Response('Documento indisponível offline', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        })
      }
    })())
    return
  }

  if (url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request))
    return
  }
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(cacheFirst(request))
  }
})
