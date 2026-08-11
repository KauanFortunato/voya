export type TravelPace = 'relaxed' | 'balanced' | 'intense'
export type TravelerInterest = 'art' | 'history' | 'food' | 'nature' | 'shopping' | 'photography'

export type ApiTraveler = {
  id: string
  displayName: string
  role: 'organizer' | 'traveler'
  travelPace: TravelPace
  interests: TravelerInterest[]
  dietaryNotes: string
  accessibilityNotes: string
  emergencyContactName: string
  emergencyContactPhone: string
  notes: string
  updatedAt: string | null
  canEdit: boolean
}

export type TravelerProfileInput = Pick<
  ApiTraveler,
  | 'travelPace'
  | 'interests'
  | 'dietaryNotes'
  | 'accessibilityNotes'
  | 'emergencyContactName'
  | 'emergencyContactPhone'
  | 'notes'
>

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? 'Não foi possível carregar os viajantes'
}

export async function listTravelers(signal?: AbortSignal) {
  const response = await fetch('/api/travelers', { signal })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{
    trip: { id: string; title: string }
    travelers: ApiTraveler[]
  }>
}

export async function updateTravelerProfile(travelerId: string, profile: TravelerProfileInput) {
  const response = await fetch(`/api/travelers/${travelerId}/profile`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(profile),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{ profile: TravelerProfileInput & { updatedAt: string } }>
}
