import type { AuthUser } from '../auth/auth'

const OFFLINE_USER_KEY = 'voya:offline-user:v1'
const OFFLINE_SYNC_KEY_PREFIX = 'voya:offline-sync:v1:'
const OFFLINE_DATA_CACHE = 'voya-data-v1'
const OFFLINE_DATA_PATH = '/__voya_offline__/data/'

const ESSENTIAL_REQUESTS = [
  { key: 'today:current', url: '/api/today' },
  { key: 'documents', url: '/api/documents' },
  { key: 'checklist', url: '/api/checklist' },
  { key: 'budget', url: '/api/budget' },
  { key: 'places', url: '/api/places' },
  { key: 'travelers', url: '/api/travelers' },
  { key: 'reminder-preferences', url: '/api/reminder-preferences' },
] as const

type CachedPayload<T> = {
  cachedAt: string
  payload: T
}

function getStorage() {
  try {
    return globalThis.localStorage
  } catch {
    return null
  }
}

function activeUserId() {
  return readOfflineUser()?.id ?? null
}

function cacheRequest(userId: string, key: string) {
  const encodedKey = encodeURIComponent(key)
  return new Request(`${globalThis.location.origin}${OFFLINE_DATA_PATH}${encodeURIComponent(userId)}/${encodedKey}`)
}

function supportsDataCache() {
  return typeof globalThis.caches !== 'undefined' && typeof globalThis.location !== 'undefined'
}

function dispatchCacheUpdate(cachedAt: string) {
  if (typeof globalThis.dispatchEvent !== 'function' || typeof CustomEvent === 'undefined') return
  globalThis.dispatchEvent(new CustomEvent('voya:offline-cache-updated', { detail: { cachedAt } }))
}

export function readOfflineUser(): AuthUser | null {
  const storage = getStorage()
  if (!storage) return null
  try {
    const value = storage.getItem(OFFLINE_USER_KEY)
    if (!value) return null
    const user = JSON.parse(value) as Partial<AuthUser>
    if (!user.id || !user.displayName || (user.role !== 'organizer' && user.role !== 'traveler')) return null
    return user as AuthUser
  } catch {
    return null
  }
}

export function rememberOfflineUser(user: AuthUser) {
  getStorage()?.setItem(OFFLINE_USER_KEY, JSON.stringify(user))
}

export function readLastOfflineSync(userId = activeUserId()) {
  if (!userId) return null
  return getStorage()?.getItem(`${OFFLINE_SYNC_KEY_PREFIX}${userId}`) ?? null
}

async function storeOfflinePayload<T>(userId: string, key: string, payload: T) {
  if (!supportsDataCache()) return
  const cachedAt = new Date().toISOString()
  const cache = await caches.open(OFFLINE_DATA_CACHE)
  await cache.put(cacheRequest(userId, key), Response.json({ cachedAt, payload } satisfies CachedPayload<T>))
  getStorage()?.setItem(`${OFFLINE_SYNC_KEY_PREFIX}${userId}`, cachedAt)
  dispatchCacheUpdate(cachedAt)
}

async function readOfflinePayload<T>(userId: string, key: string) {
  if (!supportsDataCache()) return null
  const response = await caches.open(OFFLINE_DATA_CACHE).then((cache) => cache.match(cacheRequest(userId, key)))
  if (!response) return null
  try {
    return (await response.json() as CachedPayload<T>).payload
  } catch {
    return null
  }
}

export async function clearOfflineAccess() {
  const userId = activeUserId()
  getStorage()?.removeItem(OFFLINE_USER_KEY)
  if (!userId) return

  getStorage()?.removeItem(`${OFFLINE_SYNC_KEY_PREFIX}${userId}`)
  if (supportsDataCache()) {
    const cache = await caches.open(OFFLINE_DATA_CACHE)
    const requests = await cache.keys()
    const userPath = `${OFFLINE_DATA_PATH}${encodeURIComponent(userId)}/`
    await Promise.all(requests.filter((request) => new URL(request.url).pathname.startsWith(userPath)).map((request) => cache.delete(request)))
    await caches.delete('voya-documents-v1')
  }
}

type CachedJsonOptions = {
  signal?: AbortSignal
  errorMessage: string
}

async function responseError(response: Response, fallback: string) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return new Error(payload?.error ?? fallback)
}

export async function getJsonWithOfflineFallback<T>(
  key: string,
  url: string,
  { signal, errorMessage }: CachedJsonOptions,
) {
  const userId = activeUserId()
  let response: Response

  try {
    response = await fetch(url, { signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    const cached = userId ? await readOfflinePayload<T>(userId, key) : null
    if (cached) return cached
    throw new Error('Sem ligação e sem informação guardada neste dispositivo.')
  }

  if (!response.ok) throw await responseError(response, errorMessage)
  const payload = await response.json() as T
  if (userId) await storeOfflinePayload(userId, key, payload).catch(() => undefined)
  return payload
}

export type OfflinePreparationResult = {
  completed: number
  failed: number
  total: number
}

export async function prepareEssentialOfflineData(onProgress?: (result: OfflinePreparationResult) => void) {
  const result: OfflinePreparationResult = { completed: 0, failed: 0, total: ESSENTIAL_REQUESTS.length }
  onProgress?.({ ...result })

  await Promise.all(ESSENTIAL_REQUESTS.map(async ({ key, url }) => {
    try {
      await getJsonWithOfflineFallback(key, url, { errorMessage: 'Não foi possível preparar esta área' })
      result.completed += 1
    } catch {
      result.failed += 1
    }
    onProgress?.({ ...result })
  }))

  return result
}
