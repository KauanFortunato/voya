import { privateTrip, type RawTripActivity } from './privateTrip'

export type CalendarActivity = {
  id: string
  time: string
  endTime?: string
  durationMinutes?: number
  title: string
  category: string
  address: string
  note?: string
  isFreeSlot: boolean
  isConfirmed: boolean
  isImportant: boolean
  reminderLeadMinutes?: 15 | 30 | 60 | 1440
  reminderRecipientIds?: string[]
  categoryKey?: string
  serverId?: string
  documentIds?: string[]
}

export type CalendarDay = {
  date: number
  isoDate: string
  weekday: string
  month: string
  city: string
  summary: string
  activities: CalendarActivity[]
  transport?: string
  freeMinutes: number
}

const categoryLabels: Record<string, string> = {
  atracao: 'Atração',
  comboio: 'Comboio',
  deslocamento: 'Deslocamento',
  hospedagem: 'Hospedagem',
  passeio: 'Passeio',
  refeicao: 'Refeição',
  tempo_livre: 'Tempo livre',
  voo: 'Voo',
}

function dateParts(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return {
    date: date.getUTCDate(),
    weekday: new Intl.DateTimeFormat('pt-PT', { weekday: 'short', timeZone: 'UTC' })
      .format(date)
      .replace('.', ''),
    month: new Intl.DateTimeFormat('pt-PT', { month: 'short', timeZone: 'UTC' })
      .format(date)
      .replace('.', ''),
  }
}

function mapActivity(activity: RawTripActivity, isoDate: string): CalendarActivity {
  return {
    id: `${isoDate}-${activity.ordem}`,
    time: activity.horario_inicio ?? 'A definir',
    endTime: activity.horario_fim ?? undefined,
    durationMinutes: activity.duracao_minutos ?? undefined,
    title: activity.titulo,
    category: categoryLabels[activity.categoria] ?? activity.categoria,
    address: activity.endereco ?? '',
    note: activity.observacoes ?? undefined,
    isFreeSlot: activity.categoria === 'tempo_livre',
    isConfirmed: activity.status === 'confirmado',
    isImportant: false,
    reminderRecipientIds: [],
    categoryKey: activity.categoria,
  }
}

const importedDays: CalendarDay[] = (privateTrip?.roteiro ?? []).map((day) => {
  const activities = day.atividades.map((activity) => mapActivity(activity, day.data))
  const freeMinutes = activities
    .filter((activity) => activity.isFreeSlot)
    .reduce((total, activity) => total + (activity.durationMinutes ?? 0), 0)
  const confirmed = activities.filter((activity) => activity.isConfirmed).length
  const transportActivity = activities.find((activity) => ['Voo', 'Comboio'].includes(activity.category))

  return {
    ...dateParts(day.data),
    isoDate: day.data,
    city: day.cidade,
    summary: `${activities.length} atividades${freeMinutes ? ` · ${formatDuration(freeMinutes)} livres` : ''}`,
    activities,
    transport: transportActivity
      ? `${transportActivity.title} · ${transportActivity.time}`
      : confirmed
        ? `${confirmed} ${confirmed === 1 ? 'reserva confirmada' : 'reservas confirmadas'}`
        : undefined,
    freeMinutes,
  }
})

const fallbackDays: CalendarDay[] = [
  {
    date: 12,
    isoDate: '2026-09-12',
    weekday: 'sáb',
    month: 'set',
    city: 'Roma',
    summary: '2 atividades · 4h livres',
    freeMinutes: 240,
    activities: [
      { id: 'colosseum', time: '10:00', endTime: '12:00', title: 'Coliseu e Fórum Romano', category: 'Atração', categoryKey: 'atracao', address: 'Piazza del Colosseo, 1', isFreeSlot: false, isConfirmed: true, isImportant: false, reminderRecipientIds: [] },
      { id: 'free', time: '14:00', endTime: '18:00', durationMinutes: 240, title: 'Tarde livre', category: 'Tempo livre', categoryKey: 'tempo_livre', address: '', isFreeSlot: true, isConfirmed: false, isImportant: false, reminderRecipientIds: [] },
    ],
  },
]

export function formatDuration(minutes: number) {
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60
  if (!hours) return `${remaining} min`
  return remaining ? `${hours}h${String(remaining).padStart(2, '0')}` : `${hours}h`
}

export const tripDays = importedDays.length ? importedDays : fallbackDays
export const tripName = privateTrip?.viagem.nome ?? 'Viagem'
export const tripDateLabel = privateTrip
  ? '17–26 agosto'
  : '12 setembro'
