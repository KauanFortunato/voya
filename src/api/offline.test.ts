import assert from 'node:assert/strict'
import test from 'node:test'

import {
  getJsonWithOfflineFallback,
  readLastOfflineSync,
  rememberOfflineUser,
} from '../offline/data.ts'

class MemoryStorage {
  private values = new Map<string, string>()

  getItem(key: string) { return this.values.get(key) ?? null }
  setItem(key: string, value: string) { this.values.set(key, value) }
  removeItem(key: string) { this.values.delete(key) }
}

class MemoryCache {
  private responses = new Map<string, Response>()

  async put(request: Request, response: Response) {
    this.responses.set(request.url, response.clone())
  }

  async match(request: Request) {
    return this.responses.get(request.url)?.clone()
  }

  async keys() {
    return [...this.responses.keys()].map((url) => new Request(url))
  }

  async delete(request: Request) {
    return this.responses.delete(request.url)
  }
}

test('returns the last user-scoped response when the network is unavailable', async () => {
  const originalFetch = globalThis.fetch
  const descriptors = {
    caches: Object.getOwnPropertyDescriptor(globalThis, 'caches'),
    localStorage: Object.getOwnPropertyDescriptor(globalThis, 'localStorage'),
    location: Object.getOwnPropertyDescriptor(globalThis, 'location'),
  }
  const cache = new MemoryCache()
  Object.defineProperty(globalThis, 'caches', {
    configurable: true,
    value: { open: async () => cache, delete: async () => true },
  })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() })
  Object.defineProperty(globalThis, 'location', { configurable: true, value: new URL('https://voya.test') })

  try {
    rememberOfflineUser({ id: 'kauan', displayName: 'Kauan', role: 'organizer' })
    globalThis.fetch = async () => Response.json({ trip: 'Roma' })
    const online = await getJsonWithOfflineFallback<{ trip: string }>('trip', '/api/trip', {
      errorMessage: 'Falhou',
    })
    assert.deepEqual(online, { trip: 'Roma' })
    assert.ok(readLastOfflineSync('kauan'))

    globalThis.fetch = async () => { throw new TypeError('network unavailable') }
    const offline = await getJsonWithOfflineFallback<{ trip: string }>('trip', '/api/trip', {
      errorMessage: 'Falhou',
    })
    assert.deepEqual(offline, { trip: 'Roma' })

    rememberOfflineUser({ id: 'kairon', displayName: 'Kairon', role: 'traveler' })
    await assert.rejects(
      getJsonWithOfflineFallback('trip', '/api/trip', { errorMessage: 'Falhou' }),
      /sem informação guardada/i,
    )
  } finally {
    globalThis.fetch = originalFetch
    for (const [key, descriptor] of Object.entries(descriptors)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
