import { useState } from 'react'
import {
  AnimatePresence,
  motion,
  Reorder,
  useDragControls,
  useReducedMotion,
} from 'motion/react'
import { ChevronDown, ChevronUp, GripVertical, Plus } from 'lucide-react'

import IconButton from '../components/IconButton'
import {
  tripDays,
  type CalendarActivity,
  type CalendarDay,
} from '../data/itinerary'
import './ItineraryPage.css'

const dailyCosts: Record<number, number> = {
  12: 126,
  13: 94,
  14: 158,
  15: 82,
}

type DraggableActivityProps = {
  activity: CalendarActivity
  activityIndex: number
  activityCount: number
  reduceMotion: boolean
  onMove: (direction: -1 | 1) => void
}

function DraggableActivity({
  activity,
  activityIndex,
  activityCount,
  reduceMotion,
  onMove,
}: DraggableActivityProps) {
  const dragControls = useDragControls()

  return (
    <Reorder.Item
      as="article"
      className="itinerary-activity"
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
      <time>{activity.time}</time>
      <div>
        <h2>{activity.title}</h2>
        <p>{activity.category} · {activity.address}</p>
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
  const [openDays, setOpenDays] = useState<number[]>([12])

  const toggleDay = (date: number) => {
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
          <p>7 dias · 2 cidades</p>
          <h1>Roteiro</h1>
        </div>
        <IconButton icon={Plus} ariaLabel="Adicionar atividade" />
      </header>

      <p className="itinerary-helper">
        Segure o puxador de uma atividade e arraste para mudar a ordem do dia.
      </p>

      <div className="itinerary-days">
        {days.map((day, dayIndex) => {
          const isOpen = openDays.includes(day.date)
          return (
            <section className={`itinerary-day${isOpen ? ' is-open' : ''}`} key={day.date}>
              <button
                className="itinerary-day__header"
                type="button"
                aria-expanded={isOpen}
                aria-controls={`itinerary-day-${day.date}`}
                onClick={() => toggleDay(day.date)}
              >
                <span className="itinerary-date">{day.date}</span>
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
                    id={`itinerary-day-${day.date}`}
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
                          activityIndex={activityIndex}
                          activityCount={day.activities.length}
                          reduceMotion={Boolean(reduceMotion)}
                          onMove={(direction) => moveActivity(dayIndex, activityIndex, direction)}
                        />
                      ))}
                    </Reorder.Group>
                    <div className="itinerary-cost">
                      <span>Custo estimado do dia</span>
                      <strong>€{dailyCosts[day.date] ?? 0} por pessoa</strong>
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
