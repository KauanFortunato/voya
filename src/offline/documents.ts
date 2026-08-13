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

async function responseToBlob(response: Response, onProgress: (progress: number | null) => void) {
  if (!response.ok) throw new Error('Não foi possível descarregar o documento.')

  const total = Number(response.headers.get('Content-Length')) || 0
  const reader = response.body?.getReader()
  if (!reader) {
    onProgress(100)
    return response.blob()
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
  onProgress(100)
  return blob
}

export async function readDocumentBlob(
  fileUrl: string,
  onProgress: (progress: number | null) => void,
) {
  if (supportsOfflineDocuments()) {
    const cache = await caches.open(DOCUMENT_CACHE_NAME)
    const cached = await cache.match(cacheKey(fileUrl))
    if (cached) {
      onProgress(100)
      return cached.blob()
    }
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
  return responseToBlob(response, onProgress)
}

export async function storeDocumentOffline(
  fileUrl: string,
  onProgress: (progress: number | null) => void,
) {
  if (!supportsOfflineDocuments()) {
    throw new Error('Este navegador não permite guardar documentos offline.')
  }

  const blob = await readDocumentBlob(fileUrl, onProgress)
  const cachedResponse = new Response(blob, {
    status: 200,
    headers: {
      'Content-Type': blob.type || 'application/octet-stream',
      'Content-Length': String(blob.size),
    },
  })
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
