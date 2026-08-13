const extensionsByMimeType: Record<string, string> = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
}

export function documentFilename(filename: string | undefined, title: string, mimeType: string) {
  const extension = extensionsByMimeType[mimeType] ?? ''
  const fallback = `${title}${extension}`
  return (filename?.trim() || fallback)
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]+/g, '_')
    .slice(0, 160)
}
