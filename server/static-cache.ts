export function staticCacheControl(pathName: string) {
  const normalizedPath = pathName.replaceAll('\\', '/')

  if (normalizedPath.includes('/assets/')) {
    return 'public, max-age=31536000, immutable'
  }
  if (normalizedPath.endsWith('/index.html') || normalizedPath.endsWith('/sw.js')) {
    return 'no-cache'
  }
  if (normalizedPath.endsWith('/manifest.webmanifest')) {
    return 'public, max-age=3600'
  }
  if (normalizedPath.includes('/icons/')) {
    return 'public, max-age=604800'
  }
  return 'public, max-age=0'
}
