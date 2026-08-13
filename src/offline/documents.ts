export const DOCUMENT_CACHE_NAME = 'voya-documents-v1'

function cacheKey(fileUrl: string) {
  return new Request(new URL(fileUrl, window.location.origin), { credentials: 'include' })
}

export function supportsOfflineDocuments() {
  return 'caches' in window && 'fetch' in window
}

export async function isDocumentAvailableOffline(fileUrl: string) {
  if (!supportsOfflineDocuments()) return false
  const cache = await caches.open(DOCUMENT_CACHE_NAME)
  return Boolean(await cache.match(cacheKey(fileUrl)))
}

export async function storeDocumentOffline(
  fileUrl: string,
  onProgress: (progress: number | null) => void,
) {
  if (!supportsOfflineDocuments()) {
    throw new Error('Este navegador não permite guardar documentos offline.')
  }

  let response: Response
  try {
    response = await fetch(fileUrl, {
      credentials: 'include',
      cache: 'no-store',
    })
  } catch {
    throw new Error('Verifique a ligação à internet e tente novamente.')
  }
  if (!response.ok) throw new Error('Não foi possível descarregar o documento.')

  const total = Number(response.headers.get('Content-Length')) || 0
  const reader = response.body?.getReader()
  if (!reader) {
    const cache = await caches.open(DOCUMENT_CACHE_NAME)
    await cache.put(cacheKey(fileUrl), response)
    onProgress(100)
    return
  }

  const chunks: Uint8Array[] = []
  let received = 0
  onProgress(total ? 0 : null)

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    onProgress(total ? Math.min(99, Math.round((received / total) * 100)) : null)
  }

  const parts = chunks.map((chunk) => {
    const part = new ArrayBuffer(chunk.byteLength)
    new Uint8Array(part).set(chunk)
    return part
  })
  const blob = new Blob(parts, { type: response.headers.get('Content-Type') ?? 'application/octet-stream' })
  const headers = new Headers(response.headers)
  headers.set('Content-Length', String(blob.size))
  const cachedResponse = new Response(blob, { status: 200, headers })
  const cache = await caches.open(DOCUMENT_CACHE_NAME)

  try {
    await cache.put(cacheKey(fileUrl), cachedResponse)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      throw new Error('Não há espaço suficiente no dispositivo para este documento.')
    }
    throw error
  }
  onProgress(100)
}

export async function removeDocumentOffline(fileUrl: string) {
  if (!supportsOfflineDocuments()) return
  const cache = await caches.open(DOCUMENT_CACHE_NAME)
  await cache.delete(cacheKey(fileUrl))
}

export async function getOfflineDocumentUrl(fileUrl: string) {
  if (!supportsOfflineDocuments()) return null
  const cache = await caches.open(DOCUMENT_CACHE_NAME)
  const response = await cache.match(cacheKey(fileUrl))
  return response ? URL.createObjectURL(await response.blob()) : null
}
