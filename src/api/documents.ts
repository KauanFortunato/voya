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
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? 'Não foi possível carregar os documentos'
}

export async function listDocuments(signal?: AbortSignal) {
  const response = await fetch('/api/documents', { signal })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{ trip: { id: string; title: string }; documents: ApiDocument[] }>
}

export function uploadDocument(
  file: File,
  metadata: { title: string; category: string; travelerIds: string[] },
  onProgress: (progress: number) => void,
) {
  return new Promise<ApiDocument>((resolve, reject) => {
    const request = new XMLHttpRequest()
    const body = new FormData()
    body.append('title', metadata.title)
    body.append('category', metadata.category)
    body.append('travelerIds', JSON.stringify(metadata.travelerIds))
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
