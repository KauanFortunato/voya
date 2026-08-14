import assert from 'node:assert/strict'
import test from 'node:test'

import { invalidateDocumentsCache, listDocuments } from './documents.ts'

const payload = {
  trip: { id: 'trip-1', title: 'Itália', timezone: 'Europe/Rome' },
  documents: [],
  activities: [],
}

test('shares a recent documents request and invalidates it after a mutation', async () => {
  const originalFetch = globalThis.fetch
  let requestCount = 0
  globalThis.fetch = async () => {
    requestCount += 1
    return Response.json(payload)
  }

  try {
    invalidateDocumentsCache()
    const [first, second] = await Promise.all([listDocuments(), listDocuments()])
    assert.deepEqual(first, payload)
    assert.deepEqual(second, payload)
    assert.equal(requestCount, 1)

    await listDocuments()
    assert.equal(requestCount, 1)

    invalidateDocumentsCache()
    await listDocuments()
    assert.equal(requestCount, 2)
  } finally {
    invalidateDocumentsCache()
    globalThis.fetch = originalFetch
  }
})
