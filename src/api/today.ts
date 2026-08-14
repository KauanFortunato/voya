import { getJsonWithOfflineFallback } from '../offline/data'

export type TodayDocument = {
  id: string
  title: string
  category: string
  bookingCode: string | null
  mimeType: string
}

export type TodayActivity = {
  id: string
  title: string
  category: string
  startsAt: string | null
  endsAt: string | null
  time: string | null
  endTime: string | null
  address: string | null
  latitude: string | null
  longitude: string | null
  notes: string | null
  status: 'planned' | 'current' | 'completed' | 'cancelled'
  position: number
  completedAt: string | null
  completedByName: string | null
  completed: boolean
  mapsUrl: string
  documents: TodayDocument[]
}

export type TodayChecklistItem = {
  id: string
  title: string
  groupTitle: string
  scope: 'family' | 'personal'
  completed: boolean
  completedAt: string | null
  completedByName: string | null
  position: number
}

export type TodayPayload = {
  user: { id: string; displayName: string }
  trip: {
    id: string
    title: string
    startDate: string
    endDate: string
    timezone: string
    currency: string
    currentDate: string
    days: Array<{ date: string; city: string }>
  }
  day: {
    date: string
    city: string
    mode: 'today' | 'upcoming' | 'past'
    previousDate: string | null
    nextDate: string | null
  }
  activities: TodayActivity[]
  highlightedActivityId: string | null
  checklist: {
    phase: 'before' | 'during' | 'after'
    pendingCount: number
    items: TodayChecklistItem[]
  }
  expenses: {
    spentForDay: number
    totalSpent: number
    budgetAmount: number
    remaining: number
  }
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? 'Não foi possível carregar este dia'
}

let initialTodayRequest: Promise<TodayPayload> | null = null

function requestToday(date?: string) {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  return getJsonWithOfflineFallback<TodayPayload>(
    `today:${date ?? 'current'}`,
    `/api/today${query}`,
    { errorMessage: 'Não foi possível carregar este dia' },
  )
}

export function prefetchToday() {
  if (initialTodayRequest) return
  initialTodayRequest = requestToday().catch((error: unknown) => {
    initialTodayRequest = null
    throw error
  })
  void initialTodayRequest.catch(() => undefined)
}

export async function getToday(date?: string, signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException('Pedido cancelado', 'AbortError')
  const request = date ? requestToday(date) : (initialTodayRequest ?? requestToday())
  if (!date) initialTodayRequest = request
  try {
    const payload = await request
    if (signal?.aborted) throw new DOMException('Pedido cancelado', 'AbortError')
    return payload
  } finally {
    if (!date && initialTodayRequest === request) initialTodayRequest = null
  }
}

export async function setActivityCompletion(activityId: string, completed: boolean) {
  const response = await fetch(`/api/activities/${activityId}/completion`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ completed }),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{
    completed: boolean
    completedAt: string | null
    completedByName: string | null
  }>
}
