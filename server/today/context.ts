export type TripPhase = 'before' | 'during' | 'after'

export function tripPhase(localDate: string, startDate: string, endDate: string): TripPhase {
  if (localDate < startDate) return 'before'
  if (localDate > endDate) return 'after'
  return 'during'
}

export function contextualChecklistLimit(phase: TripPhase) {
  if (phase === 'before') return 4
  if (phase === 'during') return 3
  return 0
}
