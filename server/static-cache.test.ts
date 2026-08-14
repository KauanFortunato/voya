import assert from 'node:assert/strict'
import test from 'node:test'

import { staticCacheControl } from './static-cache.ts'

test('keeps versioned assets immutable and update entry points fresh', () => {
  assert.equal(
    staticCacheControl('/app/dist/assets/index-AbCd1234.js'),
    'public, max-age=31536000, immutable',
  )
  assert.equal(staticCacheControl('/app/dist/index.html'), 'no-cache')
  assert.equal(staticCacheControl('/app/dist/sw.js'), 'no-cache')
  assert.equal(staticCacheControl('/app/dist/manifest.webmanifest'), 'public, max-age=3600')
  assert.equal(staticCacheControl('C:\\app\\dist\\icons\\voya-192.png'), 'public, max-age=604800')
})
