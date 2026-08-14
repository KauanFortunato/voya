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

export async function getToday(date?: string, signal?: AbortSignal) {
  const query = date ? `?date=${encodeURIComponent(date)}` : ''
  const response = await fetch(`/api/today${query}`, { signal })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<TodayPayload>
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
