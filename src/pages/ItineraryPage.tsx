import { useEffect, useState } from 'react'
import {
  AnimatePresence,
  motion,
  Reorder,
  useReducedMotion,
} from 'motion/react'
import { Check, ChevronDown, ChevronUp, Clock3, FileText, GripVertical, Map, MapPin, Pencil, Plus, Save, Star, Ticket, UserRound, UsersRound, X } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'

import { updateActivityDocuments, type ApiDocument } from '../api/documents'
import { createActivity, getRemoteItinerary, updateActivity, type ActivityInput } from '../api/itinerary'
import { listTravelers, type ApiTraveler } from '../api/travelers'
import { useAuth } from '../auth/auth'
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
import { bottomSheetMotion, dialogBackdropMotion } from '../motion/dialogMotion'
import './ItineraryPage.css'

type DraggableActivityProps = {
  activity: CalendarActivity
  isoDate: string
  activityIndex: number
  activityCount: number
  expanded: boolean
  organizing: boolean
  reduceMotion: boolean
  onMove: (direction: -1 | 1) => void
  onToggle: () => void
  onOpen: () => void
}

function DraggableActivity({
  activity,
  isoDate,
  activityIndex,
  activityCount,
  expanded,
  organizing,
  reduceMotion,
  onMove,
  onToggle,
  onOpen,
}: DraggableActivityProps) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activity.address || activity.title)}`

  return (
    <Reorder.Item
      as="article"
      className={`itinerary-activity${activity.isFreeSlot ? ' is-free-slot' : ''}${expanded ? ' is-expanded' : ''}${organizing ? ' is-organizing' : ''}`}
      value={activity}
      layout="position"
      dragListener={organizing}
      dragElastic={0.025}
      dragMomentum={false}
      whileDrag={
        reduceMotion
          ? { zIndex: 2 }
          : {
              zIndex: 2,
              scale: 1.008,
              boxShadow: '0 12px 30px rgb(39 91 143 / 18%)',
            }
      }
      transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 620, damping: 46, mass: 0.7 }}
    >
      <span className={`itinerary-timeline-dot${activity.isImportant ? ' is-important' : ''}`} aria-hidden="true" />
      <div className="itinerary-activity__card">
        <div className="itinerary-activity__top">
          <button className="itinerary-activity__time" type="button" disabled={organizing} onClick={onOpen} aria-label={`Editar horário de ${activity.title}`}>
            <strong>{activity.time}</strong>
            <span>{activity.durationMinutes ? formatDuration(activity.durationMinutes) : activity.endTime ? `até ${activity.endTime}` : 'sem duração'}</span>
          </button>
          <button className="itinerary-activity__summary" type="button" disabled={organizing} onClick={onToggle} aria-expanded={expanded}>
            <span className={`itinerary-schedule-badge${activity.time === 'A definir' ? ' is-pending' : ''}`}>
              {activity.time === 'A definir' ? 'HORÁRIO A DEFINIR' : 'HORÁRIO DEFINIDO'}
            </span>
            <span className="itinerary-activity__title">
              <h2>{activity.title}</h2>
              {activity.isImportant && <Star size={14} fill="currentColor" aria-label="Atividade importante" />}
            </span>
            <span className="itinerary-activity__place"><MapPin size={13} aria-hidden="true" />{activity.address || 'Local ainda não definido'}</span>
            <span className="itinerary-activity__meta">
              <span>{activity.category}</span>
              {activity.documentIds?.length ? <span><Ticket size={12} aria-hidden="true" />{activity.documentIds.length} {activity.documentIds.length === 1 ? 'documento' : 'documentos'}</span> : null}
            </span>
          </button>
          {organizing ? (
            <span
              className="itinerary-grip"
              title="Segure e arraste para reorganizar"
              aria-hidden="true"
            >
              <GripVertical size={18} aria-hidden="true" />
            </span>
          ) : (
            <button className="itinerary-expand" type="button" onClick={onToggle} aria-label={expanded ? `Recolher ${activity.title}` : `Expandir ${activity.title}`}>
              {expanded ? <ChevronUp size={18} aria-hidden="true" /> : <ChevronDown size={18} aria-hidden="true" />}
            </button>
          )}
        </div>

        <AnimatePresence initial={false}>
          {expanded && !organizing && (
            <motion.div
              className="itinerary-activity__details"
              initial={reduceMotion ? false : { height: 0 }}
              animate={{
                height: 'auto',
                transition: reduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
              }}
              exit={reduceMotion ? undefined : {
                height: 0,
                transition: { duration: 0.13, ease: [0.4, 0, 1, 1] },
              }}
            >
              <div className="itinerary-activity__facts">
                <div><span>Início</span><strong>{activity.time}</strong></div>
                <div><span>Fim</span><strong>{activity.endTime ?? 'A definir'}</strong></div>
              </div>
              {activity.note && <p className="itinerary-activity__note">{activity.note}</p>}
              {activity.documentIds?.length ? (
                <Link className="itinerary-linked-documents" to={`/more/documents?document=${activity.documentIds[0]}`}>
                  <Ticket size={16} aria-hidden="true" />
                  <span><strong>{activity.documentIds.length} {activity.documentIds.length === 1 ? 'documento ligado' : 'documentos ligados'}</strong><small>Abrir bilhetes e reservas desta atividade</small></span>
                  <ChevronDown size={15} aria-hidden="true" />
                </Link>
              ) : null}
              <div className="itinerary-activity__actions">
                <a href={mapsUrl} target="_blank" rel="noreferrer"><Map size={16} aria-hidden="true" />Maps</a>
                <button type="button" onClick={onOpen}><Pencil size={16} aria-hidden="true" />Editar</button>
                <button type="button" onClick={onOpen}><FileText size={16} aria-hidden="true" />Documentos</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {activity.isFreeSlot && (
          <Link
            className="itinerary-free-action"
            to={`/places?date=${isoDate}&start=${activity.time}&end=${activity.endTime ?? ''}`}
          >
            <Plus size={14} aria-hidden="true" />
            Adicionar aqui
          </Link>
        )}

        {organizing && (
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
        )}
      </div>
    </Reorder.Item>
  )
}

type ActivityEditorProps = {
  activity: CalendarActivity
  dayDate: string
  availableDays: CalendarDay[]
  mode: 'create' | 'edit'
  documents: ApiDocument[]
  travelers: ApiTraveler[]
  currentUserId: string
  reduceMotion: boolean
  onClose: () => void
  onSave: (activity: CalendarActivity, documentIds: string[], dayDate: string) => Promise<void>
}

const activityCategories = [
  ['atracao', 'Atração'], ['passeio', 'Passeio'], ['refeicao', 'Refeição'],
  ['deslocamento', 'Deslocamento'], ['hospedagem', 'Hospedagem'], ['voo', 'Voo'],
  ['comboio', 'Comboio'], ['tempo_livre', 'Tempo livre'],
] as const

const reminderLeadOptions = [
  { value: '', label: 'Usar padrão pessoal' },
  { value: '15', label: '15 min antes' },
  { value: '30', label: '30 min antes' },
  { value: '60', label: '1 hora antes' },
  { value: '1440', label: '1 dia antes' },
] as const

function ActivityEditor({ activity, dayDate: initialDayDate, availableDays, mode, documents, travelers, currentUserId, reduceMotion, onClose, onSave }: ActivityEditorProps) {
  const [dayDate, setDayDate] = useState(initialDayDate)
  const [title, setTitle] = useState(activity.title)
  const [categoryKey, setCategoryKey] = useState(activity.categoryKey ?? 'passeio')
  const [startTime, setStartTime] = useState(activity.time === 'A definir' ? '' : activity.time)
  const [endTime, setEndTime] = useState(activity.endTime ?? '')
  const [address, setAddress] = useState(activity.address)
  const [note, setNote] = useState(activity.note ?? '')
  const [isImportant, setIsImportant] = useState(activity.isImportant)
  const [reminderLeadMinutes, setReminderLeadMinutes] = useState<CalendarActivity['reminderLeadMinutes']>(activity.reminderLeadMinutes)
  const [reminderRecipientIds, setReminderRecipientIds] = useState(
    activity.reminderRecipientIds?.length ? activity.reminderRecipientIds : [currentUserId],
  )
  const [documentIds, setDocumentIds] = useState(activity.documentIds ?? [])
  const [documentsOpen, setDocumentsOpen] = useState(false)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'error'>('idle')

  return (
    <div className="itinerary-editor-layer" role="presentation">
      <motion.button
        className="itinerary-editor-backdrop"
        type="button"
        aria-label="Fechar editor"
        onClick={onClose}
        {...dialogBackdropMotion(reduceMotion)}
      />
      <motion.form
        className="itinerary-editor"
        role="dialog"
        aria-modal="true"
        aria-labelledby="itinerary-editor-title"
        {...bottomSheetMotion(reduceMotion)}
        onSubmit={(event) => {
          event.preventDefault()
          setSaveState('saving')
          void onSave({
            ...activity,
            title: title.trim() || activity.title,
            category: activityCategories.find(([key]) => key === categoryKey)?.[1] ?? activity.category,
            categoryKey,
            time: startTime || 'A definir',
            endTime: endTime || undefined,
            address: address.trim(),
            note: note.trim() || undefined,
            isImportant,
            reminderLeadMinutes,
            reminderRecipientIds,
          }, documentIds, dayDate).catch(() => setSaveState('error'))
        }}
      >
        <span className="itinerary-editor__handle" aria-hidden="true" />
        <div className="itinerary-editor__heading">
          <div>
            <span>{mode === 'create' ? 'Novo plano' : activity.category}</span>
            <h2 id="itinerary-editor-title">{mode === 'create' ? 'Adicionar atividade' : 'Editar atividade'}</h2>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose}><X size={19} aria-hidden="true" /></button>
        </div>

        {mode === 'create' && (
          <label className="itinerary-editor__field">
            <span>Dia</span>
            <select value={dayDate} onChange={(event) => setDayDate(event.target.value)} required>
              {availableDays.map((day) => <option value={day.isoDate} key={day.isoDate}>{day.date} {day.month} · {day.city}</option>)}
            </select>
          </label>
        )}
        <label className="itinerary-editor__field">
          <span>Nome</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label className="itinerary-editor__field">
          <span>Categoria</span>
          <select value={categoryKey} onChange={(event) => setCategoryKey(event.target.value)}>
            {activityCategories.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
          </select>
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

        <button
          className={`itinerary-editor__important${isImportant ? ' is-selected' : ''}`}
          type="button"
          aria-pressed={isImportant}
          onClick={() => setIsImportant((current) => !current)}
        >
          <Star size={19} fill={isImportant ? 'currentColor' : 'none'} aria-hidden="true" />
          <span><strong>Atividade importante</strong><small>{isImportant ? 'Será considerada nos lembretes' : 'Marque para poder configurar lembretes'}</small></span>
          <span className="itinerary-editor__switch" aria-hidden="true"><i /></span>
        </button>

        {isImportant && (
          <fieldset className="itinerary-editor__reminder" disabled={saveState === 'saving'}>
            <legend><Clock3 size={17} aria-hidden="true" />Lembrete desta atividade</legend>
            <label className="itinerary-editor__reminder-lead">
              <span>Quando avisar</span>
              <select
                value={reminderLeadMinutes ?? ''}
                onChange={(event) => setReminderLeadMinutes(event.target.value
                  ? Number(event.target.value) as NonNullable<CalendarActivity['reminderLeadMinutes']>
                  : undefined)}
              >
                {reminderLeadOptions.map((option) => <option value={option.value} key={option.value || 'default'}>{option.label}</option>)}
              </select>
            </label>

            <div className="itinerary-editor__recipient-heading">
              <span>Quem será avisado</span>
              <div>
                <button type="button" onClick={() => setReminderRecipientIds([currentUserId])}><UserRound size={14} aria-hidden="true" />Só eu</button>
                <button type="button" onClick={() => setReminderRecipientIds(travelers.map((traveler) => traveler.id))}><UsersRound size={14} aria-hidden="true" />Todos</button>
              </div>
            </div>
            <div className="itinerary-editor__recipients">
              {travelers.map((traveler) => {
                const selected = reminderRecipientIds.includes(traveler.id)
                return (
                  <button
                    className={selected ? 'is-selected' : ''}
                    type="button"
                    aria-pressed={selected}
                    key={traveler.id}
                    onClick={() => setReminderRecipientIds((current) => selected
                      ? (current.length > 1 ? current.filter((id) => id !== traveler.id) : current)
                      : [...current, traveler.id])}
                  >
                    <span>{traveler.displayName.slice(0, 2).toLocaleUpperCase('pt-PT')}</span>
                    <strong>{traveler.id === currentUserId ? 'Eu' : traveler.displayName}</strong>
                    {selected && <Check size={15} aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {mode === 'edit' && activity.serverId && (
          <section className={`itinerary-editor__documents-section${documentsOpen ? ' is-open' : ''}`}>
            <button
              className="itinerary-editor__documents-toggle"
              type="button"
              aria-expanded={documentsOpen}
              aria-controls="itinerary-editor-documents"
              onClick={() => setDocumentsOpen((current) => !current)}
            >
              <span><FileText size={17} aria-hidden="true" /></span>
              <span><strong>Documentos ligados</strong><small>{documentIds.length ? `${documentIds.length} ${documentIds.length === 1 ? 'documento ligado' : 'documentos ligados'}` : 'Nenhum documento ligado'}</small></span>
              {documentsOpen ? <ChevronUp size={17} aria-hidden="true" /> : <ChevronDown size={17} aria-hidden="true" />}
            </button>
            {documentsOpen && (
              <fieldset className="itinerary-editor__documents" id="itinerary-editor-documents" disabled={saveState === 'saving'}>
                {documents.length ? documents.map((document) => {
                  const isLinked = documentIds.includes(document.id)
                  return (
                    <div key={document.id}>
                      <button
                        type="button"
                        className={isLinked ? 'is-selected' : ''}
                        aria-pressed={isLinked}
                        onClick={() => setDocumentIds((current) => current.includes(document.id)
                          ? current.filter((id) => id !== document.id)
                          : [...current, document.id])}
                      >
                        <FileText size={16} aria-hidden="true" />
                        <span>{document.title}</span>
                        {isLinked && <Check size={15} aria-hidden="true" />}
                      </button>
                      <Link to={`/more/documents?document=${document.id}`}>Abrir</Link>
                    </div>
                  )
                }) : <p>Nenhum documento foi enviado para esta viagem.</p>}
                <p className="itinerary-editor__storage">Os documentos ligados são sincronizados com a NAS.</p>
              </fieldset>
            )}
          </section>
        )}

        {saveState === 'error' && <p className="itinerary-editor__error" role="alert">Não foi possível guardar a atividade.</p>}
        <button className="itinerary-editor__save" type="submit" disabled={saveState === 'saving'} aria-busy={saveState === 'saving'}>
          <Save size={17} aria-hidden="true" />{saveState === 'saving' ? 'A guardar…' : mode === 'create' ? 'Adicionar atividade' : 'Guardar alterações'}
        </button>
      </motion.form>
    </div>
  )
}

export default function ItineraryPage() {
  const reduceMotion = useReducedMotion()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
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
  const [expandedActivityId, setExpandedActivityId] = useState<string | null>(null)
  const [organizing, setOrganizing] = useState(false)
  const [editingActivity, setEditingActivity] = useState<{ dayIndex: number; activity: CalendarActivity } | null>(null)
  const [creatingActivity, setCreatingActivity] = useState(false)
  const [documents, setDocuments] = useState<ApiDocument[]>([])
  const [travelers, setTravelers] = useState<ApiTraveler[]>([])
  const [syncState, setSyncState] = useState<'loading' | 'ready' | 'error'>('loading')

  useEffect(() => {
    const controller = new AbortController()
    setSyncState('loading')
    void Promise.all([getRemoteItinerary(controller.signal), listTravelers(controller.signal)]).then(([payload, travelerPayload]) => {
      const remoteDays = payload.days
      if (!remoteDays.length) {
        setSyncState('ready')
        return
      }
      setDocuments(payload.documents)
      setTravelers(travelerPayload.travelers)
      setDays(remoteDays)
      const targetId = searchParams.get('activity')
      if (targetId) {
        const dayIndex = remoteDays.findIndex((day) => day.activities.some((activity) => activity.serverId === targetId))
        const activity = dayIndex >= 0 ? remoteDays[dayIndex].activities.find((item) => item.serverId === targetId) : undefined
        if (activity) {
          setOpenDays((current) => current.includes(remoteDays[dayIndex].isoDate) ? current : [...current, remoteDays[dayIndex].isoDate])
          setEditingActivity({ dayIndex, activity })
        }
      }
      setSyncState('ready')
    }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setSyncState('error')
    })
    return () => controller.abort()
  }, [searchParams])

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

  const saveActivity = async (editedActivity: CalendarActivity, documentIds: string[], dayDate: string) => {
    const input: ActivityInput = {
      dayDate,
      title: editedActivity.title,
      category: editedActivity.categoryKey ?? 'passeio',
      startTime: editedActivity.time === 'A definir' ? null : editedActivity.time,
      endTime: editedActivity.endTime ?? null,
      address: editedActivity.address,
      notes: editedActivity.note ?? '',
      isImportant: editedActivity.isImportant,
      reminderLeadMinutes: editedActivity.isImportant ? (editedActivity.reminderLeadMinutes ?? null) : null,
      reminderRecipientIds: editedActivity.isImportant ? (editedActivity.reminderRecipientIds ?? [user!.id]) : [],
    }
    if (editedActivity.serverId) {
      await updateActivity(editedActivity.serverId, input)
      await updateActivityDocuments(editedActivity.serverId, documentIds)
    } else {
      await createActivity(input)
    }
    const refreshed = await getRemoteItinerary()
    setDays(refreshed.days)
    setDocuments(refreshed.documents)
    setEditingActivity(null)
    setCreatingActivity(false)
  }

  const newActivity: CalendarActivity = {
    id: 'new-activity', title: '', category: 'Passeio', categoryKey: 'passeio',
    time: 'A definir', address: '', isFreeSlot: false, isConfirmed: true, isImportant: false,
    reminderRecipientIds: user ? [user.id] : [],
  }

  return (
    <main className="itinerary-page" id="main-content" aria-busy={syncState === 'loading'}>
      <header className="itinerary-header">
        <div>
          <p>{tripDateLabel} · 10 dias</p>
          <h1>Roteiro</h1>
        </div>
        {user?.role === 'organizer' && <IconButton icon={Plus} ariaLabel="Adicionar atividade" onClick={() => setCreatingActivity(true)} />}
      </header>

      <p className="itinerary-helper">
        {tripName} · abra uma atividade para consultar detalhes, documentos e ações do roteiro.
      </p>

      {user?.role === 'organizer' && (
        <div className="itinerary-command-row">
          <button
            className={organizing ? 'is-active' : ''}
            type="button"
            aria-pressed={organizing}
            onClick={() => {
              setOrganizing((current) => !current)
              setExpandedActivityId(null)
            }}
          >
            {organizing ? <Check size={16} aria-hidden="true" /> : <GripVertical size={16} aria-hidden="true" />}
            {organizing ? 'Concluir' : 'Reordenar'}
          </button>
          <span>{organizing ? 'Arraste os cartões ou use as setas' : 'Organize cada dia da viagem'}</span>
        </div>
      )}

      <AnimatePresence initial={false}>
        {syncState !== 'ready' && (
          <motion.p
            className={`itinerary-sync${syncState === 'error' ? ' is-error' : ''}`}
            role={syncState === 'error' ? 'alert' : 'status'}
            initial={reduceMotion ? false : { opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -2 }}
            transition={{ type: 'spring', duration: 0.18, bounce: 0 }}
          >
            {syncState === 'loading' ? 'Sincronizando o roteiro com a NAS…' : 'Não foi possível sincronizar. A versão guardada neste dispositivo continua disponível.'}
          </motion.p>
        )}
      </AnimatePresence>

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
                          expanded={expandedActivityId === activity.id}
                          organizing={organizing}
                          reduceMotion={Boolean(reduceMotion)}
                          onMove={(direction) => moveActivity(dayIndex, activityIndex, direction)}
                          onToggle={() => setExpandedActivityId((current) => current === activity.id ? null : activity.id)}
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

      {user?.role === 'organizer' && <button className="itinerary-add" type="button" onClick={() => setCreatingActivity(true)}>
        <Plus size={18} aria-hidden="true" />
        Adicionar atividade
      </button>}

      <ModalPortal open={Boolean(editingActivity)} onClose={() => setEditingActivity(null)}>
        {editingActivity && (
          <ActivityEditor
            key={editingActivity.activity.id}
            activity={editingActivity.activity}
            dayDate={days[editingActivity.dayIndex].isoDate}
            availableDays={days}
            mode="edit"
            documents={documents}
            travelers={travelers}
            currentUserId={user?.id ?? ''}
            reduceMotion={Boolean(reduceMotion)}
            onClose={() => setEditingActivity(null)}
            onSave={(activity, documentIds, dayDate) => saveActivity(activity, documentIds, dayDate)}
          />
        )}
      </ModalPortal>
      <ModalPortal open={creatingActivity} onClose={() => setCreatingActivity(false)}>
        {creatingActivity && days.length > 0 && (
          <ActivityEditor
            key="new-activity"
            activity={newActivity}
            dayDate={openDays.find((date) => days.some((day) => day.isoDate === date)) ?? days[0].isoDate}
            availableDays={days}
            mode="create"
            documents={documents}
            travelers={travelers}
            currentUserId={user?.id ?? ''}
            reduceMotion={Boolean(reduceMotion)}
            onClose={() => setCreatingActivity(false)}
            onSave={(activity, documentIds, dayDate) => saveActivity(activity, documentIds, dayDate)}
          />
        )}
      </ModalPortal>
    </main>
  )
}
