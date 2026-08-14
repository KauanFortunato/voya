import { useEffect, useRef } from 'react'
import { CalendarClock, ChevronLeft, ChevronRight } from 'lucide-react'

import './TripDayPicker.css'

export type TripDayPickerDay = {
  isoDate: string
  city: string
}

type TripDayPickerProps = {
  days: TripDayPickerDay[]
  selectedIsoDate: string
  currentIsoDate: string
  reduceMotion: boolean
  loading?: boolean
  onSelectDay: (isoDate: string) => void
}

function dateParts(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00Z`)
  return {
    date: date.getUTCDate(),
    weekday: new Intl.DateTimeFormat('pt-PT', { weekday: 'short', timeZone: 'UTC' }).format(date).replace('.', ''),
    month: new Intl.DateTimeFormat('pt-PT', { month: 'short', timeZone: 'UTC' }).format(date).replace('.', ''),
  }
}

export default function TripDayPicker({
  days,
  selectedIsoDate,
  currentIsoDate,
  reduceMotion,
  loading = false,
  onSelectDay,
}: TripDayPickerProps) {
  const stripRef = useRef<HTMLDivElement>(null)
  const buttonRefs = useRef(new Map<string, HTMLButtonElement>())
  const selectedIndex = Math.max(0, days.findIndex((day) => day.isoDate === selectedIsoDate))
  const isOnCurrentDay = selectedIsoDate === currentIsoDate

  useEffect(() => {
    const strip = stripRef.current
    const selectedButton = buttonRefs.current.get(selectedIsoDate)
    if (!strip || !selectedButton) return

    const centeredLeft = selectedButton.offsetLeft - (strip.clientWidth - selectedButton.offsetWidth) / 2
    const maxLeft = strip.scrollWidth - strip.clientWidth
    strip.scrollTo({
      left: Math.max(0, Math.min(centeredLeft, maxLeft)),
      behavior: reduceMotion ? 'auto' : 'smooth',
    })
  }, [days, reduceMotion, selectedIsoDate])

  const selectOffset = (offset: -1 | 1) => {
    const target = days[selectedIndex + offset]
    if (target) onSelectDay(target.isoDate)
  }

  return (
    <nav className={`trip-day-picker${loading ? ' is-loading' : ''}`} aria-label="Escolher dia da viagem" aria-busy={loading}>
      <button
        className="trip-day-picker__arrow is-previous"
        type="button"
        aria-label="Dia anterior"
        disabled={selectedIndex === 0 || loading}
        onClick={() => selectOffset(-1)}
      >
        <ChevronLeft size={19} aria-hidden="true" />
      </button>
      <div className="trip-day-picker__strip" ref={stripRef} role="tablist" aria-label={`${days.length} dias da viagem`}>
        {days.map((day) => {
          const selected = day.isoDate === selectedIsoDate
          const current = day.isoDate === currentIsoDate
          const parts = dateParts(day.isoDate)
          return (
            <button
              className={`trip-day-option${selected ? ' is-selected' : ''}${current ? ' is-current' : ''}`}
              key={day.isoDate}
              ref={(element) => {
                if (element) buttonRefs.current.set(day.isoDate, element)
                else buttonRefs.current.delete(day.isoDate)
              }}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-label={`${parts.weekday}, ${parts.date} de ${parts.month}, ${day.city}${current ? ', dia atual' : ''}`}
              disabled={loading}
              onClick={() => onSelectDay(day.isoDate)}
            >
              <span>{parts.weekday.slice(0, 3)}</span>
              <strong>{parts.date}</strong>
              <i aria-hidden="true" />
            </button>
          )
        })}
      </div>
      <button
        className="trip-day-picker__arrow is-next"
        type="button"
        aria-label="Próximo dia"
        disabled={selectedIndex === days.length - 1 || loading}
        onClick={() => selectOffset(1)}
      >
        <ChevronRight size={19} aria-hidden="true" />
      </button>
      <button
        className="trip-day-picker__current-action"
        type="button"
        aria-label={isOnCurrentDay ? 'Você já está no dia atual da viagem' : 'Voltar ao dia atual da viagem'}
        title={isOnCurrentDay ? 'Dia atual' : 'Voltar ao dia atual'}
        disabled={isOnCurrentDay || loading || !currentIsoDate}
        onClick={() => onSelectDay(currentIsoDate)}
      >
        <CalendarClock size={17} aria-hidden="true" />
      </button>
      {loading && <span className="trip-day-picker__progress" role="status">A carregar outro dia…</span>}
    </nav>
  )
}
