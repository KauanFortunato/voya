import { listDocuments, type ApiDocument, type ApiItineraryActivity } from './documents'
import { formatDuration, type CalendarDay } from '../data/itinerary'

const categoryLabels: Record<string, string> = {
  atracao: 'Atração', comboio: 'Comboio', deslocamento: 'Deslocamento', hospedagem: 'Hospedagem',
  passeio: 'Passeio', refeicao: 'Refeição', tempo_livre: 'Tempo livre', voo: 'Voo',
}

export function mapRemoteItinerary(activities: ApiItineraryActivity[], documents: ApiDocument[]): CalendarDay[] {
  const days = new Map<string, CalendarDay>()
  for (const activity of activities) {
    let day = days.get(activity.dayDate)
    if (!day) {
      const date = new Date(`${activity.dayDate}T12:00:00Z`)
      day = {
        date: date.getUTCDate(),
        isoDate: activity.dayDate,
        weekday: new Intl.DateTimeFormat('pt-PT', { weekday: 'short', timeZone: 'UTC' }).format(date).replace('.', ''),
        month: new Intl.DateTimeFormat('pt-PT', { month: 'short', timeZone: 'UTC' }).format(date).replace('.', ''),
        city: activity.city,
        summary: '',
        activities: [],
        freeMinutes: 0,
      }
      days.set(activity.dayDate, day)
    }
    const isFreeSlot = activity.category === 'tempo_livre'
    const start = activity.time?.split(':').map(Number)
    const end = activity.endTime?.split(':').map(Number)
    const durationMinutes = start && end ? (end[0] * 60 + end[1]) - (start[0] * 60 + start[1]) : undefined
    day.activities.push({
      id: activity.sourceKey ?? activity.id,
      serverId: activity.id,
      time: activity.time ?? 'A definir',
      endTime: activity.endTime ?? undefined,
      durationMinutes: durationMinutes && durationMinutes > 0 ? durationMinutes : undefined,
      title: activity.title,
      category: categoryLabels[activity.category] ?? activity.category,
      address: activity.address ?? '',
      note: activity.notes ?? undefined,
      isFreeSlot,
      isConfirmed: activity.status !== 'cancelled',
      documentIds: documents.filter((document) => document.activityIds.includes(activity.id)).map((document) => document.id),
    })
  }
  return [...days.values()]
    .sort((first, second) => first.isoDate.localeCompare(second.isoDate))
    .map((day) => {
      day.freeMinutes = day.activities.filter((activity) => activity.isFreeSlot).reduce((sum, activity) => sum + (activity.durationMinutes ?? 0), 0)
      day.summary = `${day.activities.length} atividades${day.freeMinutes ? ` · ${formatDuration(day.freeMinutes)} livres` : ''}`
      return day
    })
}

export async function getRemoteItinerary(signal?: AbortSignal) {
  const payload = await listDocuments(signal)
  return {
    trip: payload.trip,
    documents: payload.documents,
    days: mapRemoteItinerary(payload.activities, payload.documents),
  }
}
