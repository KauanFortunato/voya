import assert from 'node:assert/strict'
import test from 'node:test'

import { googleMapsDirectionsUrl, googleMapsSearchUrl, mapDestination } from './urls.ts'

test('prefers persisted coordinates for map destinations', () => {
  const location = {
    title: 'Roscioli',
    city: 'Roma',
    address: 'Via dei Giubbonari, 21',
    latitude: '41.894220',
    longitude: '12.474260',
  }

  assert.equal(mapDestination(location), '41.894220,12.474260')
  assert.equal(
    googleMapsDirectionsUrl(location),
    'https://www.google.com/maps/dir/?api=1&destination=41.894220%2C12.474260',
  )
})

test('falls back to an encoded address when coordinates are unavailable', () => {
  const location = {
    title: "Sant'Eustachio Il Caffè",
    city: 'Roma',
    address: 'Piazza di S. Eustachio, 82',
    latitude: null,
    longitude: null,
  }

  assert.equal(mapDestination(location), "Piazza di S. Eustachio, 82, Roma, Sant'Eustachio Il Caffè")
  assert.equal(
    googleMapsSearchUrl(location),
    "https://www.google.com/maps/search/?api=1&query=Piazza%20di%20S.%20Eustachio%2C%2082%2C%20Roma%2C%20Sant'Eustachio%20Il%20Caff%C3%A8",
  )
})
