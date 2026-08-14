import { getJsonWithOfflineFallback } from '../offline/data'

export type ApiDocument = {
  id: string
  title: string
  category: string
  bookingCode: string | null
  status: 'draft' | 'confirmed' | 'attention' | 'expired'
  startsAt: string | null
  originalFilename: string
  mimeType: string
  fileSize: string | number
  createdAt: string
  travelerIds: string[]
  activityIds: string[]
}

export type ApiItineraryActivity = {
  id: string
  sourceKey: string | null
  title: string
  category: string
  dayDate: string
  city: string
  time: string | null
  endTime: string | null
  address: string | null
  notes: string | null
  status: 'planned' | 'current' | 'completed' | 'cancelled'
  isImportant: boolean
  reminderLeadMinutes: 15 | 30 | 60 | 1440 | null
  reminderRecipientIds: string[]
  position: number
  dayPosition: number
}

type DocumentsPayload = {
  trip: { id: string; title: string; timezone: string }
  documents: ApiDocument[]
  activities: ApiItineraryActivity[]
}

const documentsCacheDurationMs = 30_000
let documentsCache: { payload: DocumentsPayload; expiresAt: number } | null = null
let documentsRequest: Promise<DocumentsPayload> | null = null
let documentsCacheVersion = 0

export function invalidateDocumentsCache() {
  documentsCacheVersion += 1
  documentsCache = null
  documentsRequest = null
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? 'Não foi possível carregar os documentos'
}

export async function listDocuments(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Pedido cancelado', 'AbortError')
  if (documentsCache && documentsCache.expiresAt > Date.now()) return documentsCache.payload

  if (!documentsRequest) {
    const requestVersion = documentsCacheVersion
    const pendingRequest = getJsonWithOfflineFallback<DocumentsPayload>(
      'documents',
      '/api/documents',
      { errorMessage: 'Não foi possível carregar os documentos' },
    ).then((payload) => {
        if (requestVersion === documentsCacheVersion) {
          documentsCache = { payload, expiresAt: Date.now() + documentsCacheDurationMs }
        }
        return payload
      })
    const trackedRequest = pendingRequest.finally(() => {
      if (documentsRequest === trackedRequest) documentsRequest = null
    })
    documentsRequest = trackedRequest
  }

  const payload = await documentsRequest
  if (signal?.aborted) throw new DOMException('Pedido cancelado', 'AbortError')
  return payload
}

export function uploadDocument(
  file: File,
  metadata: { title: string; category: string; travelerIds: string[]; activityIds: string[] },
  onProgress: (progress: number) => void,
) {
  return new Promise<ApiDocument>((resolve, reject) => {
    const request = new XMLHttpRequest()
    const body = new FormData()
    body.append('title', metadata.title)
    body.append('category', metadata.category)
    body.append('travelerIds', JSON.stringify(metadata.travelerIds))
    body.append('activityIds', JSON.stringify(metadata.activityIds))
    body.append('file', file)

    request.open('POST', '/api/documents')
    request.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    })
    request.addEventListener('load', () => {
      let payload: { document?: ApiDocument; error?: string } = {}
      try {
        payload = JSON.parse(request.responseText) as typeof payload
      } catch {
        // The generic message below covers invalid or empty responses.
      }
      if (request.status >= 200 && request.status < 300 && payload.document) {
        invalidateDocumentsCache()
        onProgress(100)
        resolve(payload.document)
        return
      }
      reject(new Error(payload.error ?? 'Não foi possível importar o documento'))
    })
    request.addEventListener('error', () => reject(new Error('A ligação ao servidor foi interrompida')))
    request.addEventListener('abort', () => reject(new Error('O envio foi cancelado')))
    request.send(body)
  })
}

export async function updateDocumentActivities(documentId: string, ids: string[]) {
  const response = await fetch(`/api/documents/${documentId}/activities`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!response.ok) throw new Error(await readError(response))
  invalidateDocumentsCache()
  return response.json() as Promise<{ activityIds: string[] }>
}

export async function updateActivityDocuments(activityId: string, ids: string[]) {
  const response = await fetch(`/api/activities/${activityId}/documents`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  })
  if (!response.ok) throw new Error(await readError(response))
  invalidateDocumentsCache()
  return response.json() as Promise<{ documentIds: string[] }>
}

export async function deleteDocument(documentId: string) {
  const response = await fetch(`/api/documents/${documentId}`, { method: 'DELETE' })
  if (!response.ok) throw new Error(await readError(response))
  invalidateDocumentsCache()
}
