import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { ChevronRight, Plus, TrainFront } from 'lucide-react'

import IconButton from '../components/IconButton'
import { tripDateLabel, tripDays } from '../data/itinerary'
import './CalendarPage.css'

type CalendarMode = 'Dia' | 'Semana' | 'Mês'

const modes: CalendarMode[] = ['Dia', 'Semana', 'Mês']
type DayViewProps = {
  selectedIsoDate: string
  onSelectDay: (isoDate: string) => void
}

function DayView({ selectedIsoDate, onSelectDay }: DayViewProps) {
  const day = tripDays.find((item) => item.isoDate === selectedIsoDate) ?? tripDays[0]

  return (
    <div className="calendar-view calendar-day-view">
      <div className="week-strip" aria-label="Dias da viagem, de 17 a 26 de agosto">
        {tripDays.map((item) => (
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

function WeekView() {
  return (
    <div className="calendar-view calendar-week-view">
      {tripDays.map((day) => (
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

function MonthView() {
  const cells = Array.from({ length: 42 }, (_, index) => index - 4)

  return (
    <div className="calendar-view calendar-month-view">
      <div className="calendar-month-heading">
        <h2>Agosto 2026</h2>
        <span>10 dias de viagem</span>
      </div>
      <div className="calendar-month-grid" aria-label="Agosto de 2026">
        {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((label, index) => (
          <span className="calendar-month-label" key={`${label}-${index}`}>{label}</span>
        ))}
        {cells.map((date, index) => {
          const validDate = date > 0 && date <= 31
          const inTrip = date >= 17 && date <= 26
          const important = [17, 19, 21, 26].includes(date)
          return (
            <button
              className={`calendar-month-day${inTrip ? ' is-trip' : ''}${important ? ' is-important' : ''}`}
              key={index}
              type="button"
              disabled={!validDate}
              aria-label={validDate ? `${date} de agosto${inTrip ? ', durante a viagem' : ''}` : undefined}
            >
              {validDate ? date : ''}
            </button>
          )
        })}
      </div>
      <article className="calendar-milestone">
        <TrainFront size={20} aria-hidden="true" />
        <div>
          <strong>19 agosto · Roma → Veneza</strong>
          <p>Italo 8914 às 11:20</p>
        </div>
      </article>
    </div>
  )
}

export default function CalendarPage() {
  const [mode, setMode] = useState<CalendarMode>('Dia')
  const [selectedIsoDate, setSelectedIsoDate] = useState(tripDays[0]?.isoDate ?? '')
  const reduceMotion = useReducedMotion()

  return (
    <main className="calendar-page" id="main-content">
      <header className="calendar-header">
        <div>
          <p>{tripDateLabel}</p>
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
          {mode === 'Dia' && <DayView selectedIsoDate={selectedIsoDate} onSelectDay={setSelectedIsoDate} />}
          {mode === 'Semana' && <WeekView />}
          {mode === 'Mês' && <MonthView />}
        </motion.div>
      </AnimatePresence>
    </main>
  )
}
