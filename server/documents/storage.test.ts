import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'

import {
  normalizeOriginalFilename,
  openDocumentFile,
  removeDocumentFile,
  stageDocumentRemoval,
  storeDocumentFile,
} from './storage.ts'

async function readStream(file: Awaited<ReturnType<typeof openDocumentFile>>) {
  const chunks: Buffer[] = []
  for await (const chunk of file.stream) chunks.push(Buffer.from(chunk))
  return Buffer.concat(chunks)
}

test('stores and opens a document inside its trip directory', async () => {
  const root = await mkdtemp(join(tmpdir(), 'voya-documents-'))
  try {
    const stored = await storeDocumentFile(
      root,
      'trip-id',
      'application/pdf',
      Readable.from(Buffer.from('%PDF-1.4\n%%EOF\n')),
    )
    assert.match(stored.storagePath, /^trip-id\/[0-9a-f-]+\.pdf$/)
    assert.equal(stored.fileSize, 15)

    const opened = await openDocumentFile(root, stored.storagePath)
    assert.equal(opened.size, 15)
    opened.stream.destroy()

    await removeDocumentFile(root, stored.storagePath)
    await assert.rejects(openDocumentFile(root, stored.storagePath))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('rejects paths outside the configured storage root', async () => {
  const root = await mkdtemp(join(tmpdir(), 'voya-documents-'))
  try {
    await assert.rejects(openDocumentFile(root, '../private-file.pdf'), /Caminho de documento inválido/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('normalizes untrusted original filenames', () => {
  assert.equal(normalizeOriginalFilename('../../Bilhete: Roma?.PDF'), '.._.._Bilhete_ Roma_.PDF')
})

test('stages deletion and can restore or commit it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'voya-documents-'))
  try {
    const first = await storeDocumentFile(root, 'trip-id', 'application/pdf', Readable.from('restore'))
    const stagedFirst = await stageDocumentRemoval(root, first.storagePath)
    await assert.rejects(openDocumentFile(root, first.storagePath))
    await stagedFirst.rollback()
    assert.equal((await readStream(await openDocumentFile(root, first.storagePath))).toString(), 'restore')

    const second = await storeDocumentFile(root, 'trip-id', 'application/pdf', Readable.from('delete'))
    const stagedSecond = await stageDocumentRemoval(root, second.storagePath)
    await stagedSecond.commit()
    await assert.rejects(openDocumentFile(root, second.storagePath))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
