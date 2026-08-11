import { randomUUID } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { extname, resolve, sep } from 'node:path'
import { Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

const allowedMimeTypes = new Map([
  ['application/pdf', '.pdf'],
  ['image/jpeg', '.jpg'],
  ['image/png', '.png'],
  ['image/webp', '.webp'],
])

function getSafeStoragePath(root: string, storagePath: string) {
  const absoluteRoot = resolve(root)
  const absolutePath = resolve(absoluteRoot, storagePath)
  if (!absolutePath.startsWith(`${absoluteRoot}${sep}`)) {
    throw new Error('Caminho de documento inválido')
  }
  return absolutePath
}

export function isAllowedDocumentMimeType(mimeType: string) {
  return allowedMimeTypes.has(mimeType)
}

export async function ensureDocumentsStorage(root: string) {
  await mkdir(resolve(root), { recursive: true })
}

export async function storeDocumentFile(
  root: string,
  tripId: string,
  mimeType: string,
  source: NodeJS.ReadableStream,
) {
  const extension = allowedMimeTypes.get(mimeType)
  if (!extension) throw new Error('Tipo de ficheiro não permitido')

  const directory = resolve(root, tripId)
  await mkdir(directory, { recursive: true })

  const fileId = randomUUID()
  const storagePath = `${tripId}/${fileId}${extension}`
  const finalPath = getSafeStoragePath(root, storagePath)
  const temporaryPath = `${finalPath}.${randomUUID()}.uploading`
  let fileSize = 0

  const counter = new Transform({
    transform(chunk, _encoding, callback) {
      fileSize += chunk.length
      callback(null, chunk)
    },
  })

  try {
    await pipeline(source, counter, createWriteStream(temporaryPath, { flags: 'wx' }))
    await rename(temporaryPath, finalPath)
    return { storagePath, fileSize }
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => undefined)
    throw error
  }
}

export async function removeDocumentFile(root: string, storagePath: string) {
  await rm(getSafeStoragePath(root, storagePath), { force: true })
}

export async function openDocumentFile(root: string, storagePath: string) {
  const absolutePath = getSafeStoragePath(root, storagePath)
  const details = await stat(absolutePath)
  return { stream: createReadStream(absolutePath), size: details.size }
}

export function normalizeOriginalFilename(filename: string) {
  const extension = extname(filename)
  const base = filename.slice(0, Math.max(0, filename.length - extension.length))
  const safeBase = base.normalize('NFKC').replace(/[^\p{L}\p{N}._ -]+/gu, '_').trim().slice(0, 120)
  const safeExtension = extension.replace(/[^a-zA-Z0-9.]/g, '').slice(0, 10)
  return `${safeBase || 'documento'}${safeExtension}`
}
