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
  storeDocumentFile,
} from './storage.ts'

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
