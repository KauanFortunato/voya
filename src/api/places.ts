export type PlaceStatus = 'saved' | 'planned' | 'visited'

export type Place = {
  id: string
  name: string
  category: string
  city: string | null
  address: string | null
  latitude: string | null
  longitude: string | null
  mapsUrl: string
  directionsUrl: string
  status: PlaceStatus
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? 'Não foi possível carregar os lugares'
}

export async function listPlaces(signal?: AbortSignal) {
  const response = await fetch('/api/places', { signal })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{ places: Place[] }>
}

export async function updatePlaceStatus(placeId: string, status: PlaceStatus) {
  const response = await fetch(`/api/places/${placeId}/status`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{ id: string; status: PlaceStatus }>
}
