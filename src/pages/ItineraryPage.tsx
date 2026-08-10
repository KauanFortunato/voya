import { useEffect, useState } from 'react'
import {
  AnimatePresence,
  motion,
  Reorder,
  useDragControls,
  useReducedMotion,
} from 'motion/react'
import { ChevronDown, ChevronUp, GripVertical, Plus, Save, X } from 'lucide-react'
import { Link } from 'react-router-dom'

import IconButton from '../components/IconButton'
import ModalPortal from '../components/ModalPortal'
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
  onOpen: () => void
}

function DraggableActivity({
  activity,
  isoDate,
  activityIndex,
  activityCount,
  reduceMotion,
  onMove,
  onOpen,
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
      <div className="itinerary-activity__content">
        <button className="itinerary-activity__main" type="button" onClick={onOpen}>
          <h2>{activity.title}</h2>
          <p>
            {activity.isFreeSlot && activity.durationMinutes
              ? `${formatDuration(activity.durationMinutes)} disponíveis`
              : `${activity.category}${activity.address ? ` · ${activity.address}` : ''}`}
          </p>
        </button>
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

type ActivityEditorProps = {
  activity: CalendarActivity
  reduceMotion: boolean
  onClose: () => void
  onSave: (activity: CalendarActivity) => void
}

function ActivityEditor({ activity, reduceMotion, onClose, onSave }: ActivityEditorProps) {
  const [title, setTitle] = useState(activity.title)
  const [startTime, setStartTime] = useState(activity.time === 'A definir' ? '' : activity.time)
  const [endTime, setEndTime] = useState(activity.endTime ?? '')
  const [address, setAddress] = useState(activity.address)
  const [note, setNote] = useState(activity.note ?? '')

  return (
    <div className="itinerary-editor-layer" role="presentation">
      <motion.button
        className="itinerary-editor-backdrop"
        type="button"
        aria-label="Fechar editor"
        onClick={onClose}
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduceMotion ? undefined : { opacity: 0 }}
        transition={{ duration: 0.18 }}
      />
      <motion.form
        className="itinerary-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="itinerary-editor-title"
        initial={reduceMotion ? false : { y: '100%' }}
        animate={{ y: 0 }}
        exit={reduceMotion ? undefined : { y: 28, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.38, bounce: 0 }}
        onSubmit={(event) => {
          event.preventDefault()
          onSave({
            ...activity,
            title: title.trim() || activity.title,
            time: startTime || 'A definir',
            endTime: endTime || undefined,
            address: address.trim(),
            note: note.trim() || undefined,
          })
        }}
      >
        <span className="itinerary-editor__handle" aria-hidden="true" />
        <div className="itinerary-editor__heading">
          <div>
            <span>{activity.category}</span>
            <h2 id="itinerary-editor-title">Editar atividade</h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}><X size={19} aria-hidden="true" /></button>
        </div>

        <label className="itinerary-editor__field">
          <span>Nome</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <div className="itinerary-editor__times">
          <label className="itinerary-editor__field">
            <span>Começa</span>
            <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} />
          </label>
          <label className="itinerary-editor__field">
            <span>Termina</span>
            <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} />
          </label>
        </div>
        <label className="itinerary-editor__field">
          <span>Local</span>
          <input value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Endereço ou ponto de encontro" />
        </label>
        <label className="itinerary-editor__field">
          <span>Notas</span>
          <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} />
        </label>

        <p className="itinerary-editor__storage">As alterações ficam neste dispositivo até a sincronização com a NAS ser ativada.</p>
        <button className="itinerary-editor__save" type="submit"><Save size={17} aria-hidden="true" />Guardar alterações</button>
      </motion.form>
    </div>
  )
}

export default function ItineraryPage() {
  const reduceMotion = useReducedMotion()
  const scheduleSignature = JSON.stringify(tripDays.map((day) => [
    day.isoDate,
    day.activities.map((activity) => [activity.id, activity.title, activity.time, activity.endTime]),
  ]))
  const [days, setDays] = useState<CalendarDay[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('voya:itinerary') ?? 'null') as { signature?: string; days?: CalendarDay[] } | null
      return saved?.signature === scheduleSignature && saved.days?.length ? saved.days : tripDays
    } catch {
      return tripDays
    }
  })
  const [openDays, setOpenDays] = useState<string[]>([tripDays[0]?.isoDate ?? ''])
  const [editingActivity, setEditingActivity] = useState<{ dayIndex: number; activity: CalendarActivity } | null>(null)

  useEffect(() => {
    localStorage.setItem('voya:itinerary', JSON.stringify({ signature: scheduleSignature, days }))
  }, [days, scheduleSignature])

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

  const saveActivity = (dayIndex: number, editedActivity: CalendarActivity) => {
    const toMinutes = (time?: string) => {
      if (!time || !/^\d{2}:\d{2}$/.test(time)) return undefined
      const [hours, minutes] = time.split(':').map(Number)
      return hours * 60 + minutes
    }
    const start = toMinutes(editedActivity.time)
    const end = toMinutes(editedActivity.endTime)
    const durationMinutes = start !== undefined && end !== undefined && end > start
      ? end - start
      : undefined
    const updatedActivity = { ...editedActivity, durationMinutes }

    setDays((current) => current.map((day, index) => {
      if (index !== dayIndex) return day
      const activities = day.activities.map((activity) => activity.id === updatedActivity.id ? updatedActivity : activity)
      const freeMinutes = activities.filter((activity) => activity.isFreeSlot).reduce((total, activity) => total + (activity.durationMinutes ?? 0), 0)
      const summary = `${activities.length} atividades${freeMinutes ? ` · ${formatDuration(freeMinutes)} livres` : ''}`
      return { ...day, activities, freeMinutes, summary }
    }))
    setEditingActivity(null)
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
        {tripName} · toque numa atividade para editar horários e detalhes. Os blocos azuis mostram onde ainda cabe um plano.
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
                          onOpen={() => setEditingActivity({ dayIndex, activity })}
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

      <ModalPortal open={Boolean(editingActivity)} onClose={() => setEditingActivity(null)}>
        {editingActivity && (
          <ActivityEditor
            key={editingActivity.activity.id}
            activity={editingActivity.activity}
            reduceMotion={Boolean(reduceMotion)}
            onClose={() => setEditingActivity(null)}
            onSave={(activity) => saveActivity(editingActivity.dayIndex, activity)}
          />
        )}
      </ModalPortal>
    </main>
  )
}
