import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronRight, CircleAlert, Plus, TrainFront } from 'lucide-react'

import { getRemoteItinerary } from '../api/itinerary'
import IconButton from '../components/IconButton'
import { tripDateLabel, tripDays, type CalendarDay } from '../data/itinerary'
import './CalendarPage.css'

type CalendarMode = 'Dia' | 'Semana' | 'Mês'

const modes: CalendarMode[] = ['Dia', 'Semana', 'Mês']
type DayViewProps = {
  days: CalendarDay[]
  selectedIsoDate: string
  onSelectDay: (isoDate: string) => void
}

function DayView({ days, selectedIsoDate, onSelectDay }: DayViewProps) {
  const day = days.find((item) => item.isoDate === selectedIsoDate) ?? days[0]

  return (
    <div className="calendar-view calendar-day-view">
      <div className="week-strip" aria-label={`${days.length} dias da viagem`}>
        {days.map((item) => (
          <button
            className={`week-day${item.isoDate === day.isoDate ? ' is-selected' : ''}`}
            key={item.isoDate}
            type="button"
            aria-label={`${item.date} de agosto, ${item.city}`}
            aria-pressed={item.isoDate === day.isoDate}
            onClick={() => onSelectDay(item.isoDate)}
          >
            <span>{item.weekday.slice(0, 1).toUpperCase()}</span>
            <strong>{item.date}</strong>
            <i aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="calendar-agenda">
        {day.activities.map((activity) => (
          <article className={`calendar-agenda-row${activity.isFreeSlot ? ' is-free-slot' : ''}`} key={activity.id}>
            <time>{activity.time}{activity.endTime && <small>–{activity.endTime}</small>}</time>
            <div>
              <h2>{activity.title}</h2>
              <p>{activity.isFreeSlot ? 'Disponível para adicionar uma atividade' : `${activity.category}${activity.address ? ` · ${activity.address}` : ''}`}</p>
            </div>
            <ChevronRight size={17} aria-hidden="true" />
          </article>
        ))}
      </div>
    </div>
  )
}

function WeekView({ days }: { days: CalendarDay[] }) {
  return (
    <div className="calendar-view calendar-week-view">
      {days.map((day) => (
        <article className="calendar-week-row" key={day.isoDate}>
          <span className="calendar-date-tile">{day.date}</span>
          <div>
            <p>{day.weekday}</p>
            <h2>{day.city}</h2>
            <small>{day.summary}</small>
          </div>
          {day.transport ? (
            <TrainFront size={20} aria-label={day.transport} />
          ) : (
            <span className="calendar-count">{day.activities.length} planos</span>
          )}
        </article>
      ))}
    </div>
  )
}

function MonthView({ days, selectedIsoDate, onSelectDay }: DayViewProps) {
  const selectedDate = new Date(`${selectedIsoDate || days[0]?.isoDate}T12:00:00Z`)
  const year = selectedDate.getUTCFullYear()
  const month = selectedDate.getUTCMonth()
  const firstWeekday = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const tripDates = new Set(days.map((day) => day.isoDate))
  const importantDates = new Set(days.filter((day) => day.transport).map((day) => day.isoDate))
  const cells = Array.from({ length: 42 }, (_, index) => index - firstWeekday + 1)
  const monthLabel = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(selectedDate)

  return (
    <div className="calendar-view calendar-month-view">
      <div className="calendar-month-heading">
        <h2>{monthLabel}</h2>
        <span>{days.length} {days.length === 1 ? 'dia' : 'dias'} de viagem</span>
      </div>
      <div className="calendar-month-grid" aria-label={monthLabel}>
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((label, index) => (
          <span className="calendar-month-label" key={`${label}-${index}`}>{label}</span>
        ))}
        {cells.map((date, index) => {
          const validDate = date > 0 && date <= daysInMonth
          const isoDate = validDate ? `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')}` : ''
          const inTrip = tripDates.has(isoDate)
          const important = importantDates.has(isoDate)
          return (
            <button
              className={`calendar-month-day${inTrip ? ' is-trip' : ''}${important ? ' is-important' : ''}${isoDate === selectedIsoDate ? ' is-selected' : ''}`}
              key={index}
              type="button"
              disabled={!validDate || !inTrip}
              aria-label={validDate ? `${date} de ${monthLabel}${inTrip ? ', durante a viagem' : ''}` : undefined}
              onClick={() => inTrip && onSelectDay(isoDate)}
            >
              {validDate ? date : ''}
            </button>
          )
        })}
      </div>
      {days.find((day) => day.transport) && (() => {
        const milestone = days.find((day) => day.transport)!
        return <article className="calendar-milestone"><TrainFront size={20} aria-hidden="true" /><div><strong>{milestone.date} {milestone.month} · {milestone.city}</strong><p>{milestone.transport}</p></div></article>
      })()}
    </div>
  )
}

function CalendarSkeleton() {
  return <div className="calendar-loading" role="status" aria-label="A carregar calendário"><span /><span /><span /><span /></div>
}

function calendarDateLabel(days: CalendarDay[]) {
  if (!days.length) return tripDateLabel
  const first = new Date(`${days[0].isoDate}T12:00:00Z`)
  const last = new Date(`${days.at(-1)!.isoDate}T12:00:00Z`)
  return new Intl.DateTimeFormat('pt-PT', { day: 'numeric', month: 'long', timeZone: 'UTC' }).formatRange(first, last)
}

export default function CalendarPage() {
  const [mode, setMode] = useState<CalendarMode>('Dia')
  const [selectedIsoDate, setSelectedIsoDate] = useState(tripDays[0]?.isoDate ?? '')
  const [days, setDays] = useState<CalendarDay[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const reduceMotion = useReducedMotion()

  const load = (signal?: AbortSignal) => {
    setLoading(true)
    setError('')
    void getRemoteItinerary(signal).then((payload) => {
      if (!payload.days.length) throw new Error('O roteiro ainda não possui dias.')
      setDays(payload.days)
      setSelectedIsoDate((current) => payload.days.some((day) => day.isoDate === current) ? current : payload.days[0].isoDate)
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar o calendário.')
    }).finally(() => {
      if (!signal?.aborted) setLoading(false)
    })
  }

  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
    return () => controller.abort()
  }, [])

  const dateLabel = useMemo(() => calendarDateLabel(days), [days])

  return (
    <main className="calendar-page" id="main-content">
      <header className="calendar-header">
        <div>
          <p>{dateLabel}</p>
          <h1>Calendário</h1>
        </div>
        <IconButton icon={Plus} ariaLabel="Adicionar evento" />
      </header>

      <div className="calendar-tabs" role="tablist" aria-label="Visualização do calendário">
        {modes.map((item) => (
          <button
            className={mode === item ? 'is-active' : ''}
            key={item}
            type="button"
            role="tab"
            aria-selected={mode === item}
            onClick={() => setMode(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {loading && !days.length && <CalendarSkeleton />}
      {error && !days.length && <section className="calendar-error" role="alert"><CircleAlert size={22} /><strong>Não foi possível abrir o calendário</strong><span>{error}</span><button type="button" onClick={() => load()}>Tentar novamente</button></section>}

      <AnimatePresence mode="wait" initial={false}>
        {days.length > 0 && (
        <motion.div
          key={mode}
          initial={reduceMotion ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
          transition={{ type: 'spring', duration: 0.2, bounce: 0 }}
        >
          {mode === 'Dia' && <DayView days={days} selectedIsoDate={selectedIsoDate} onSelectDay={setSelectedIsoDate} />}
          {mode === 'Semana' && <WeekView days={days} />}
          {mode === 'Mês' && <MonthView days={days} selectedIsoDate={selectedIsoDate} onSelectDay={setSelectedIsoDate} />}
        </motion.div>
        )}
      </AnimatePresence>
    </main>
  )
}
