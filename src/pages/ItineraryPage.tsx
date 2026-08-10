import { useState } from 'react'
import {
  AnimatePresence,
  motion,
  Reorder,
  useDragControls,
  useReducedMotion,
} from 'motion/react'
import { ChevronDown, ChevronUp, GripVertical, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'

import IconButton from '../components/IconButton'
import {
  tripDays,
  formatDuration,
  tripDateLabel,
  tripName,
  type CalendarActivity,
  type CalendarDay,
} from '../data/itinerary'
import './ItineraryPage.css'

type DraggableActivityProps = {
  activity: CalendarActivity
  isoDate: string
  activityIndex: number
  activityCount: number
  reduceMotion: boolean
  onMove: (direction: -1 | 1) => void
}

function DraggableActivity({
  activity,
  isoDate,
  activityIndex,
  activityCount,
  reduceMotion,
  onMove,
}: DraggableActivityProps) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      as="article"
      className={`itinerary-activity${activity.isFreeSlot ? ' is-free-slot' : ''}`}
      value={activity}
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragElastic={0.06}
      dragMomentum={false}
      whileDrag={
        reduceMotion
          ? { zIndex: 2 }
          : {
              zIndex: 2,
              scale: 1.015,
              boxShadow: '0 12px 30px rgb(39 91 143 / 18%)',
            }
      }
      transition={{ type: 'spring', duration: reduceMotion ? 0 : 0.22, bounce: 0 }}
    >
      <button
        className="itinerary-grip"
        type="button"
        aria-label={`Segure e arraste para reorganizar ${activity.title}`}
        title="Segure e arraste para reorganizar"
        onPointerDown={(event) => dragControls.start(event)}
      >
        <GripVertical size={18} aria-hidden="true" />
      </button>
      <time>
        {activity.time}
        {activity.endTime && <small>–{activity.endTime}</small>}
      </time>
      <div>
        <h2>{activity.title}</h2>
        <p>
          {activity.isFreeSlot && activity.durationMinutes
            ? `${formatDuration(activity.durationMinutes)} disponíveis`
            : `${activity.category}${activity.address ? ` · ${activity.address}` : ''}`}
        </p>
        {activity.isFreeSlot && (
          <Link
            className="itinerary-free-action"
            to={`/places?date=${isoDate}&start=${activity.time}&end=${activity.endTime ?? ''}`}
          >
            <Plus size={14} aria-hidden="true" />
            Adicionar aqui
          </Link>
        )}
      </div>
      <span className="itinerary-move-actions">
        <button
          type="button"
          aria-label={`Mover ${activity.title} para cima`}
          disabled={activityIndex === 0}
          onClick={() => onMove(-1)}
        >
          <ChevronUp size={15} aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label={`Mover ${activity.title} para baixo`}
          disabled={activityIndex === activityCount - 1}
          onClick={() => onMove(1)}
        >
          <ChevronDown size={15} aria-hidden="true" />
        </button>
      </span>
    </Reorder.Item>
  )
}

export default function ItineraryPage() {
  const reduceMotion = useReducedMotion()
  const [days, setDays] = useState<CalendarDay[]>(tripDays)
  const [openDays, setOpenDays] = useState<string[]>([tripDays[0]?.isoDate ?? ''])

  const toggleDay = (date: string) => {
    setOpenDays((current) =>
      current.includes(date) ? current.filter((item) => item !== date) : [...current, date],
    )
  }

  const moveActivity = (dayIndex: number, activityIndex: number, direction: -1 | 1) => {
    setDays((current) =>
      current.map((day, index) => {
        if (index !== dayIndex) return day

        const targetIndex = activityIndex + direction
        if (targetIndex < 0 || targetIndex >= day.activities.length) return day

        const activities = [...day.activities]
        ;[activities[activityIndex], activities[targetIndex]] = [
          activities[targetIndex],
          activities[activityIndex],
        ]
        return { ...day, activities }
      }),
    )
  }

  const reorderActivities = (dayIndex: number, activities: CalendarActivity[]) => {
    setDays((current) =>
      current.map((day, index) => (index === dayIndex ? { ...day, activities } : day)),
    )
  }

  return (
    <main className="itinerary-page" id="main-content">
      <header className="itinerary-header">
        <div>
          <p>{tripDateLabel} · 10 dias</p>
          <h1>Roteiro</h1>
        </div>
        <IconButton icon={Plus} ariaLabel="Adicionar atividade" />
      </header>

      <p className="itinerary-helper">
        {tripName} · os blocos azuis mostram onde ainda cabe um plano. Segure o puxador para reorganizar.
      </p>

      <div className="itinerary-days">
        {days.map((day, dayIndex) => {
          const isOpen = openDays.includes(day.isoDate)
          return (
            <section className={`itinerary-day${isOpen ? ' is-open' : ''}`} key={day.isoDate}>
              <button
                className="itinerary-day__header"
                type="button"
                aria-expanded={isOpen}
                aria-controls={`itinerary-day-${day.isoDate}`}
                onClick={() => toggleDay(day.isoDate)}
              >
                <span className="itinerary-date"><strong>{day.date}</strong><small>{day.month}</small></span>
                <span className="itinerary-day__summary">
                  <small>{day.weekday}</small>
                  <strong>{day.city}</strong>
                  <span>{day.transport ?? day.summary}</span>
                </span>
                {isOpen ? <ChevronUp aria-hidden="true" /> : <ChevronDown aria-hidden="true" />}
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className="itinerary-day__body"
                    id={`itinerary-day-${day.isoDate}`}
                    initial={reduceMotion ? false : { opacity: 0, y: -6, filter: 'blur(2px)' }}
                    animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                    exit={reduceMotion ? undefined : { opacity: 0, y: -3, filter: 'blur(1px)' }}
                    transition={{ type: 'spring', duration: 0.24, bounce: 0 }}
                  >
                    <Reorder.Group
                      as="div"
                      className="itinerary-activity-list"
                      axis="y"
                      values={day.activities}
                      onReorder={(activities) => reorderActivities(dayIndex, activities)}
                    >
                      {day.activities.map((activity, activityIndex) => (
                        <DraggableActivity
                          key={activity.id}
                          activity={activity}
                          isoDate={day.isoDate}
                          activityIndex={activityIndex}
                          activityCount={day.activities.length}
                          reduceMotion={Boolean(reduceMotion)}
                          onMove={(direction) => moveActivity(dayIndex, activityIndex, direction)}
                        />
                      ))}
                    </Reorder.Group>
                    <div className={`itinerary-availability${day.freeMinutes ? ' has-free-time' : ''}`}>
                      <span>{day.freeMinutes ? 'Tempo livre identificado' : 'Disponibilidade'}</span>
                      <strong>{day.freeMinutes ? formatDuration(day.freeMinutes) : 'A confirmar'}</strong>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          )
        })}
      </div>

      <button className="itinerary-add" type="button">
        <Plus size={18} aria-hidden="true" />
        Adicionar atividade
      </button>
    </main>
  )
}
