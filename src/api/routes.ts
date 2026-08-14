export type TravelPreviewPayload = {
  distanceMeters: number
  durationSeconds: number
  mode: 'WALK'
  originTitle: string
  destinationTitle: string
  cached: boolean
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? 'Não foi possível calcular o deslocamento'
}

export async function getTravelPreview(
  originActivityId: string,
  destinationActivityId: string,
  signal?: AbortSignal,
) {
  const response = await fetch('/api/routes/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originActivityId, destinationActivityId }),
    signal,
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<TravelPreviewPayload>
}
