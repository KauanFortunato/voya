import { readdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function offlinePrecache(): Plugin {
  return {
    name: 'voya-offline-precache',
    apply: 'build',
    async closeBundle() {
      const assetsDirectory = resolve('dist/assets')
      const serviceWorkerPath = resolve('dist/sw.js')
      const assets = await readdir(assetsDirectory, { recursive: true })
      const urls = assets.map((asset) => `/assets/${asset}`).sort()
      const serviceWorker = await readFile(serviceWorkerPath, 'utf8')
      await writeFile(
        serviceWorkerPath,
        serviceWorker.replace('"__VOYA_BUILD_ASSETS__"', JSON.stringify(urls)),
      )
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), offlinePrecache()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://127.0.0.1:3333',
    },
  },
  preview: {
    host: '0.0.0.0',
  },
})
