import { z } from 'zod'

const googleRoutesResponseSchema = z.object({
  routes: z.array(z.object({
    distanceMeters: z.number().int().nonnegative(),
    duration: z.string().regex(/^\d+(?:\.\d+)?s$/),
  })).min(1),
})

const googleRoutesErrorSchema = z.object({
  error: z.object({
    code: z.number().optional(),
    status: z.string().optional(),
    message: z.string().optional(),
  }).optional(),
})

const googleRouteMatrixSchema = z.array(z.object({
  originIndex: z.number().int().nonnegative().default(0),
  destinationIndex: z.number().int().nonnegative().default(0),
  status: z.object({
    code: z.number().optional(),
    message: z.string().optional(),
  }).optional(),
  condition: z.string().optional(),
  distanceMeters: z.number().int().nonnegative().optional(),
  duration: z.string().regex(/^\d+(?:\.\d+)?s$/).optional(),
}))

export type RouteLocation = {
  address: string
  city: string
  latitude: string | null
  longitude: string | null
}

export type TravelMode = 'WALK' | 'TRANSIT' | 'DRIVE'

export type TravelPreview = {
  distanceMeters: number
  durationSeconds: number
  mode: TravelMode
}

export type RouteMatrixDestination = RouteLocation & { id: string }

export type NearbyPlaceEstimate = TravelPreview & {
  placeId: string
}

export class GoogleRoutesError extends Error {
  readonly statusCode: number

  constructor(statusCode: number, message: string) {
    super(message)
    this.name = 'GoogleRoutesError'
    this.statusCode = statusCode
  }
}

export function googleWaypoint(location: RouteLocation) {
  const latitude = Number(location.latitude)
  const longitude = Number(location.longitude)
  if (location.latitude && location.longitude && Number.isFinite(latitude) && Number.isFinite(longitude)) {
    return { location: { latLng: { latitude, longitude } } }
  }
  return { address: [location.address, location.city].filter(Boolean).join(', ') }
}

export async function computeTravelPreview({
  apiKey,
  origin,
  destination,
  mode,
  fetchImplementation = fetch,
  signal = AbortSignal.timeout(10_000),
}: {
  apiKey: string
  origin: RouteLocation
  destination: RouteLocation
  mode: TravelMode
  fetchImplementation?: typeof fetch
  signal?: AbortSignal
}): Promise<TravelPreview> {
  const response = await fetchImplementation('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
    },
    body: JSON.stringify({
      origin: googleWaypoint(origin),
      destination: googleWaypoint(destination),
      travelMode: mode,
      languageCode: 'pt-PT',
      units: 'METRIC',
    }),
    signal,
  })

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const upstream = googleRoutesErrorSchema.safeParse(payload)
    throw new GoogleRoutesError(
      response.status,
      upstream.success ? (upstream.data.error?.message ?? 'A Google Routes API recusou o pedido') : 'Resposta inválida da Google Routes API',
    )
  }

  const parsed = googleRoutesResponseSchema.safeParse(payload)
  if (!parsed.success) throw new GoogleRoutesError(502, 'A Google Routes API não encontrou um percurso válido')
  const route = parsed.data.routes[0]
  return {
    distanceMeters: route.distanceMeters,
    durationSeconds: Math.ceil(Number.parseFloat(route.duration.slice(0, -1))),
    mode,
  }
}

export async function computeNearbyPlaceEstimates({
  apiKey,
  latitude,
  longitude,
  destinations,
  mode,
  fetchImplementation = fetch,
  signal = AbortSignal.timeout(15_000),
}: {
  apiKey: string
  latitude: number
  longitude: number
  destinations: RouteMatrixDestination[]
  mode: TravelMode
  fetchImplementation?: typeof fetch
  signal?: AbortSignal
}): Promise<NearbyPlaceEstimate[]> {
  if (!destinations.length) return []
  const response = await fetchImplementation('https://routes.googleapis.com/distanceMatrix/v2:computeRouteMatrix', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'originIndex,destinationIndex,status,condition,distanceMeters,duration',
    },
    body: JSON.stringify({
      origins: [{ waypoint: { location: { latLng: { latitude, longitude } } } }],
      destinations: destinations.map((destination) => ({ waypoint: googleWaypoint(destination) })),
      travelMode: mode,
      languageCode: 'pt-PT',
      units: 'METRIC',
      ...(mode === 'DRIVE' ? { routingPreference: 'TRAFFIC_AWARE' } : {}),
    }),
    signal,
  })

  const payload: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const upstream = googleRoutesErrorSchema.safeParse(payload)
    throw new GoogleRoutesError(
      response.status,
      upstream.success ? (upstream.data.error?.message ?? 'A Google Routes API recusou o pedido') : 'Resposta inválida da Google Routes API',
    )
  }
  const parsed = googleRouteMatrixSchema.safeParse(payload)
  if (!parsed.success) throw new GoogleRoutesError(502, 'A Google Routes API devolveu uma matriz inválida')

  return parsed.data.flatMap((element) => {
    const destination = destinations[element.destinationIndex]
    if (!destination || element.condition !== 'ROUTE_EXISTS' || !element.duration || element.distanceMeters === undefined) return []
    return [{
      placeId: destination.id,
      distanceMeters: element.distanceMeters,
      durationSeconds: Math.ceil(Number.parseFloat(element.duration.slice(0, -1))),
      mode,
    }]
  }).sort((left, right) => left.durationSeconds - right.durationSeconds || left.distanceMeters - right.distanceMeters)
}
