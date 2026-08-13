export type ReminderLeadMinutes = 15 | 30 | 60 | 1440

export type ReminderPreferences = {
  enabled: boolean
  defaultLeadMinutes: ReminderLeadMinutes
  updatedAt: string | null
  schedule: {
    scheduledCount: number
    nextScheduledFor: string | null
  }
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? 'Não foi possível guardar as preferências'
}

export async function getReminderPreferences(signal?: AbortSignal) {
  const response = await fetch('/api/reminder-preferences', { signal })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<ReminderPreferences>
}

export async function updateReminderPreferences(preferences: Pick<ReminderPreferences, 'enabled' | 'defaultLeadMinutes'>) {
  const response = await fetch('/api/reminder-preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(preferences),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<ReminderPreferences>
}
