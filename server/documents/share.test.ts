import assert from 'node:assert/strict'
import test from 'node:test'

import { documentFilename } from '../../src/documents/filename.ts'

test('keeps a safe uploaded filename for sharing', () => {
  assert.equal(
    documentFilename('bilhetes-lisboa.pdf', 'Voo Lisboa', 'application/pdf'),
    'bilhetes-lisboa.pdf',
  )
})

test('creates and sanitizes a fallback filename', () => {
  assert.equal(
    documentFilename(undefined, 'Roma / Veneza: reserva', 'image/jpeg'),
    'Roma _ Veneza_ reserva.jpg',
  )
})
