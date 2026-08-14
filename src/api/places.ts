import { getJsonWithOfflineFallback } from '../offline/data'

export type PlaceStatus = 'saved' | 'planned' | 'visited'
export type NearbyTravelMode = 'WALK' | 'TRANSIT' | 'DRIVE'

export type NearbyPlaceEstimate = {
  placeId: string
  distanceMeters: number
  durationSeconds: number
  mode: NearbyTravelMode
}

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
  return getJsonWithOfflineFallback<{ places: Place[] }>('places', '/api/places', {
    signal,
    errorMessage: 'Não foi possível carregar os lugares',
  })
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

export async function listNearbyPlaces(
  location: { latitude: number; longitude: number },
  mode: NearbyTravelMode,
  signal?: AbortSignal,
) {
  const response = await fetch('/api/places/nearby', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...location, mode }),
    signal,
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{
    estimates: NearbyPlaceEstimate[]
    mode: NearbyTravelMode
    cached: boolean
    attribution: string
  }>
}
