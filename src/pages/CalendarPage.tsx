import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronRight, Plus, TrainFront } from 'lucide-react'

import IconButton from '../components/IconButton'
import { tripDays } from '../data/itinerary'
import './CalendarPage.css'

type CalendarMode = 'Dia' | 'Semana' | 'Mês'

const modes: CalendarMode[] = ['Dia', 'Semana', 'Mês']
const weekDays = [
  { label: 'S', date: 9 },
  { label: 'T', date: 10 },
  { label: 'Q', date: 11 },
  { label: 'Q', date: 12 },
  { label: 'S', date: 13 },
  { label: 'S', date: 14 },
  { label: 'D', date: 15 },
]

function DayView() {
  const day = tripDays[0]

  return (
    <div className="calendar-view calendar-day-view">
      <div className="week-strip" aria-label="Semana de 9 a 15 de setembro">
        {weekDays.map((item) => (
          <button
            className={`week-day${item.date === day.date ? ' is-selected' : ''}`}
            key={item.date}
            type="button"
            aria-label={`${item.date} de setembro`}
            aria-pressed={item.date === day.date}
          >
            <span>{item.label}</span>
            <strong>{item.date}</strong>
            <i aria-hidden="true" />
          </button>
        ))}
      </div>

      <div className="calendar-agenda">
        {day.activities.map((activity) => (
          <article className="calendar-agenda-row" key={activity.id}>
            <time>{activity.time}</time>
            <div>
              <h2>{activity.title}</h2>
              <p>{activity.category} · {activity.address}</p>
            </div>
            <ChevronRight size={17} aria-hidden="true" />
          </article>
        ))}
      </div>
    </div>
  )
}

function WeekView() {
  return (
    <div className="calendar-view calendar-week-view">
      {tripDays.map((day) => (
        <article className="calendar-week-row" key={day.date}>
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

function MonthView() {
  const cells = Array.from({ length: 35 }, (_, index) => index - 1)

  return (
    <div className="calendar-view calendar-month-view">
      <div className="calendar-month-heading">
        <h2>Setembro 2026</h2>
        <span>7 dias de viagem</span>
      </div>
      <div className="calendar-month-grid" aria-label="Setembro de 2026">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((label, index) => (
          <span className="calendar-month-label" key={`${label}-${index}`}>{label}</span>
        ))}
        {cells.map((date, index) => {
          const validDate = date > 0 && date <= 30
          const inTrip = date >= 12 && date <= 18
          const important = [12, 14, 18].includes(date)
          return (
            <button
              className={`calendar-month-day${inTrip ? ' is-trip' : ''}${important ? ' is-important' : ''}`}
              key={index}
              type="button"
              disabled={!validDate}
              aria-label={validDate ? `${date} de setembro${inTrip ? ', durante a viagem' : ''}` : undefined}
            >
              {validDate ? date : ''}
            </button>
          )
        })}
      </div>
      <article className="calendar-milestone">
        <TrainFront size={20} aria-hidden="true" />
        <div>
          <strong>14 setembro · Roma → Veneza</strong>
          <p>Frecciarossa 9400 às 07:35</p>
        </div>
      </article>
    </div>
  )
}

export default function CalendarPage() {
  const [mode, setMode] = useState<CalendarMode>('Dia')
  const reduceMotion = useReducedMotion()

  return (
    <main className="calendar-page" id="main-content">
      <header className="calendar-header">
        <div>
          <p>12–18 setembro</p>
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

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={mode}
          initial={reduceMotion ? false : { opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
          transition={{ type: 'spring', duration: 0.2, bounce: 0 }}
        >
          {mode === 'Dia' && <DayView />}
          {mode === 'Semana' && <WeekView />}
          {mode === 'Mês' && <MonthView />}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
