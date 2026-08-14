export type TripDateOption = {
  isoDate: string
}

function dateInTimezone(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function findCurrentTripDate(days: TripDateOption[], timeZone: string) {
  if (!days.length) return ''
  const today = dateInTimezone(timeZone)
  return days.find((day) => day.isoDate >= today)?.isoDate ?? days.at(-1)!.isoDate
}
