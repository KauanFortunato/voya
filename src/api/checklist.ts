import { getJsonWithOfflineFallback } from '../offline/data'

export type ChecklistScope = 'family' | 'personal'

export type ApiChecklistItem = {
  id: string
  title: string
  completed: boolean
  completedAt: string | null
  completedByName: string | null
  position: number
}

export type ApiChecklistGroup = {
  id: string
  title: string
  scope: ChecklistScope
  ownerUserId: string | null
  ownerName: string | null
  canAddItems: boolean
  items: ApiChecklistItem[]
}

export type ChecklistPayload = {
  trip: { id: string; title: string }
  currentUser: { id: string; displayName: string; role: 'organizer' | 'traveler' }
  groups: ApiChecklistGroup[]
}

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? 'Não foi possível concluir o pedido'
}

export async function getChecklist(signal?: AbortSignal) {
  return getJsonWithOfflineFallback<ChecklistPayload>('checklist', '/api/checklist', {
    signal,
    errorMessage: 'Não foi possível carregar o checklist',
  })
}

export async function setChecklistItemCompletion(itemId: string, completed: boolean) {
  const response = await fetch(`/api/checklist/items/${itemId}/completion`, {
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

export async function createChecklistItem(groupId: string, title: string) {
  const response = await fetch('/api/checklist/items', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ groupId, title }),
  })
  if (!response.ok) throw new Error(await readError(response))
  return response.json() as Promise<{ item: ApiChecklistItem }>
}
