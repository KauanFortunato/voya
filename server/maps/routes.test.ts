import assert from 'node:assert/strict'
import test from 'node:test'

import { computeTravelPreview, googleWaypoint, GoogleRoutesError } from './routes.ts'

test('uses coordinates when a location has them', () => {
  assert.deepEqual(googleWaypoint({
    address: 'Via dei Giubbonari, 21', city: 'Roma', latitude: '41.894220', longitude: '12.474260',
  }), {
    location: { latLng: { latitude: 41.89422, longitude: 12.47426 } },
  })
})

test('falls back to an address and city waypoint', () => {
  assert.deepEqual(googleWaypoint({
    address: 'Coliseu', city: 'Roma', latitude: null, longitude: null,
  }), { address: 'Coliseu, Roma' })
})

test('requests duration and distance for the selected travel mode', async () => {
  let requestBody: unknown
  const result = await computeTravelPreview({
    apiKey: 'test-key',
    mode: 'TRANSIT',
    origin: { address: 'Roscioli', city: 'Roma', latitude: null, longitude: null },
    destination: { address: 'Gianicolo', city: 'Roma', latitude: null, longitude: null },
    signal: new AbortController().signal,
    fetchImplementation: async (_input, init) => {
      requestBody = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ routes: [{ distanceMeters: 1729, duration: '1620s' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  })

  assert.deepEqual(requestBody, {
    origin: { address: 'Roscioli, Roma' },
    destination: { address: 'Gianicolo, Roma' },
    travelMode: 'TRANSIT',
    languageCode: 'pt-PT',
    units: 'METRIC',
  })
  assert.deepEqual(result, { distanceMeters: 1729, durationSeconds: 1620, mode: 'TRANSIT' })
})

test('normalizes Google API failures', async () => {
  await assert.rejects(
    computeTravelPreview({
      apiKey: 'test-key',
      mode: 'DRIVE',
      origin: { address: 'Origem', city: 'Roma', latitude: null, longitude: null },
      destination: { address: 'Destino', city: 'Roma', latitude: null, longitude: null },
      signal: new AbortController().signal,
      fetchImplementation: async () => new Response(JSON.stringify({
        error: { code: 403, status: 'PERMISSION_DENIED', message: 'Blocked' },
      }), { status: 403, headers: { 'Content-Type': 'application/json' } }),
    }),
    (error: unknown) => error instanceof GoogleRoutesError && error.statusCode === 403 && error.message === 'Blocked',
  )
})
