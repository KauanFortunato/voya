import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Bell,
  CalendarClock,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  FileText,
  ListChecks,
  Map,
  MapPin,
  Navigation,
  RefreshCw,
  Ticket,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react'
import { Link } from 'react-router-dom'

import { setChecklistItemCompletion } from '../api/checklist'
import { getToday, setActivityCompletion, type TodayActivity, type TodayChecklistItem, type TodayPayload } from '../api/today'
import IconButton from '../components/IconButton'
import ModalPortal from '../components/ModalPortal'
import './TodayPage.css'

const categoryLabels: Record<string, string> = {
  atracao: 'Atração', comboio: 'Comboio', deslocamento: 'Deslocamento', hospedagem: 'Hospedagem',
  passeio: 'Passeio', refeicao: 'Refeição', tempo_livre: 'Tempo livre', voo: 'Voo',
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('pt-PT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' })
    .format(new Date(`${value}T12:00:00Z`))
}

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Bom dia'
  if (hour < 19) return 'Boa tarde'
  return 'Boa noite'
}

function TodaySkeleton() {
  return (
    <div className="today-loading" role="status" aria-label="A carregar o seu dia">
      <div className="today-loading__header">
        <span className="today-loading__trip" />
        <span className="today-loading__title" />
        <span className="today-loading__notification" />
      </div>
      <span className="today-loading__picker" />
      <span className="today-loading__hero" />
      <span className="today-loading__summary" />
      <span className="today-loading__checklist" />
      <span className="today-loading__section" />
      <span className="today-loading__row" />
      <span className="today-loading__row" />
    </div>
  )
}

type ContextualChecklistProps = {
  checklist: TodayPayload['checklist']
  savingIds: string[]
  error: string
  reduceMotion: boolean | null
  onToggle: (item: TodayChecklistItem) => void
}

function ContextualChecklist({ checklist, savingIds, error, reduceMotion, onToggle }: ContextualChecklistProps) {
  const beforeTrip = checklist.phase === 'before'
  const remainingVisible = checklist.items.filter((item) => !item.completed).length
  const otherPending = Math.max(0, checklist.pendingCount - remainingVisible)

  return (
    <section className="today-checklist" aria-labelledby="today-checklist-title">
      <div className="today-checklist__heading">
        <span className="today-checklist__icon"><ListChecks size={20} aria-hidden="true" /></span>
        <div>
          <span>{beforeTrip ? 'Antes da viagem' : 'Durante a viagem'}</span>
          <h2 id="today-checklist-title">{beforeTrip ? 'Preparação pendente' : 'Não esquecer hoje'}</h2>
          <p>{checklist.pendingCount
            ? `${checklist.pendingCount} ${checklist.pendingCount === 1 ? 'item pendente' : 'itens pendentes'}`
            : 'Tudo preparado para seguir viagem'}</p>
        </div>
        <Link to="/more/checklist?from=today" aria-label="Abrir checklist completa">Ver tudo<ChevronRight size={15} aria-hidden="true" /></Link>
      </div>

      {checklist.items.length ? (
        <div className="today-checklist__items">
          {checklist.items.map((item) => {
            const saving = savingIds.includes(item.id)
            const ScopeIcon = item.scope === 'family' ? UsersRound : UserRound
            return (
              <button
                className={`today-checklist-item${item.completed ? ' is-completed' : ''}`}
                type="button"
                key={item.id}
                aria-pressed={item.completed}
                aria-busy={saving}
                disabled={saving}
                onClick={() => onToggle(item)}
              >
                <span className="today-checklist-item__check">
                  <AnimatePresence initial={false}>
                    {item.completed && (
                      <motion.span
                        initial={reduceMotion ? false : { opacity: 0, scale: 0.9, filter: 'blur(2px)' }}
                        animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                        exit={reduceMotion ? undefined : { opacity: 0, scale: 0.94, filter: 'blur(1px)' }}
                        transition={{ type: 'spring', duration: 0.16, bounce: 0 }}
                      ><Check size={13} strokeWidth={3} aria-hidden="true" /></motion.span>
                    )}
                  </AnimatePresence>
                </span>
                <span><strong>{item.title}</strong><small><ScopeIcon size={12} aria-hidden="true" />{item.groupTitle}</small></span>
              </button>
            )
          })}
        </div>
      ) : (
        <div className="today-checklist__complete"><Check size={18} aria-hidden="true" /><span><strong>Nenhuma pendência</strong><small>A checklist está em dia.</small></span></div>
      )}

      {otherPending > 0 && <p className="today-checklist__more">Mais {otherPending} {otherPending === 1 ? 'item está' : 'itens estão'} na lista completa.</p>}
      {error && <p className="today-checklist__error" role="alert">{error}</p>}
    </section>
  )
}

function ActivityDetails({ activity, onClose }: { activity: TodayActivity; onClose: () => void }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.div className="sheet-backdrop" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={reduceMotion ? undefined : { opacity: 0 }} transition={{ duration: 0.16 }} onClick={onClose}>
      <motion.section className="details-sheet" role="dialog" aria-modal="true" aria-labelledby="details-title" initial={reduceMotion ? false : { y: '100%', opacity: .94 }} animate={{ y: 0, opacity: 1 }} exit={reduceMotion ? undefined : { y: 20, opacity: 0 }} transition={{ type: 'spring', duration: 0.36, bounce: 0 }} onClick={(event) => event.stopPropagation()}>
        <span className="details-sheet__handle" aria-hidden="true" />
        <div className="details-sheet__heading"><div><span>{categoryLabels[activity.category] ?? activity.category}</span><h2 id="details-title">{activity.title}</h2></div><IconButton icon={X} ariaLabel="Fechar detalhes" onClick={onClose} /></div>
        {activity.notes && <p>{activity.notes}</p>}
        <div className="details-sheet__rows">
          <div><Clock3 aria-hidden="true" /><span><strong>{activity.time ?? 'Horário a definir'}{activity.endTime ? `–${activity.endTime}` : ''}</strong><small>Horário local da viagem</small></span></div>
          {activity.address && <div><MapPin aria-hidden="true" /><span><strong>{activity.address}</strong><small>Abra no Maps para traçar a rota desde a sua localização.</small></span></div>}
          <div><FileText aria-hidden="true" /><span><strong>{activity.documents.length} {activity.documents.length === 1 ? 'documento associado' : 'documentos associados'}</strong><small>Bilhetes, reservas e comprovativos desta atividade.</small></span></div>
        </div>
        {activity.documents.length > 0 && <div className="details-documents"><h3>Documentos</h3>{activity.documents.map((document) => <a href={`/api/documents/${document.id}/file`} target="_blank" rel="noreferrer" key={document.id}><span><Ticket size={17} /><i><strong>{document.title}</strong><small>{document.category}{document.bookingCode ? ` · ${document.bookingCode}` : ''}</small></i></span><ChevronRight size={16} /></a>)}</div>}
        <a className="sheet-primary-action" href={activity.mapsUrl} target="_blank" rel="noreferrer"><Navigation size={17} />Abrir no Google Maps</a>
      </motion.section>
    </motion.div>
  )
}

export default function TodayPage() {
  const reduceMotion = useReducedMotion()
  const [data, setData] = useState<TodayPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedActivity, setSelectedActivity] = useState<TodayActivity | null>(null)
  const [savingIds, setSavingIds] = useState<string[]>([])
  const [checklistSavingIds, setChecklistSavingIds] = useState<string[]>([])
  const [checklistError, setChecklistError] = useState('')
  const [actionError, setActionError] = useState('')
  const [dayDirection, setDayDirection] = useState(1)

  const load = async (date?: string, signal?: AbortSignal) => {
    setLoading(true); setError(''); setActionError('')
    try { setData(await getToday(date, signal)) }
    catch (reason) {
      if (reason instanceof DOMException && reason.name === 'AbortError') return
      setError(reason instanceof Error ? reason.message : 'Não foi possível carregar este dia')
    } finally { if (!signal?.aborted) setLoading(false) }
  }

  useEffect(() => {
    const controller = new AbortController()
    void load(undefined, controller.signal)
    return () => controller.abort()
  }, [])

  const activeActivities = data?.activities.filter((activity) => activity.status !== 'cancelled') ?? []
  const completedCount = activeActivities.filter((activity) => activity.completed).length
  const progress = activeActivities.length ? Math.round(completedCount / activeActivities.length * 100) : 0
  const highlightedActivity = useMemo(() => {
    if (!data) return null
    const original = data.activities.find((activity) => activity.id === data.highlightedActivityId && !activity.completed)
    return original ?? data.activities.find((activity) => !activity.completed && activity.status !== 'cancelled') ?? null
  }, [data])
  const currency = useMemo(() => new Intl.NumberFormat('pt-PT', { style: 'currency', currency: data?.trip.currency ?? 'EUR' }), [data?.trip.currency])

  const toggleActivity = async (activity: TodayActivity) => {
    if (!data || savingIds.includes(activity.id)) return
    const completed = !activity.completed
    setSavingIds((current) => [...current, activity.id]); setActionError('')
    setData({ ...data, activities: data.activities.map((item) => item.id === activity.id ? { ...item, completed } : item) })
    try {
      const result = await setActivityCompletion(activity.id, completed)
      setData((current) => current ? { ...current, activities: current.activities.map((item) => item.id === activity.id ? { ...item, ...result } : item) } : current)
    } catch (reason) {
      setData((current) => current ? { ...current, activities: current.activities.map((item) => item.id === activity.id ? activity : item) } : current)
      setActionError(reason instanceof Error ? reason.message : 'Não foi possível alterar a atividade')
    } finally { setSavingIds((current) => current.filter((id) => id !== activity.id)) }
  }

  const toggleChecklistItem = async (item: TodayChecklistItem) => {
    if (!data || checklistSavingIds.includes(item.id)) return
    const completed = !item.completed
    setChecklistError('')
    setChecklistSavingIds((current) => [...current, item.id])
    setData((current) => current ? {
      ...current,
      checklist: {
        ...current.checklist,
        pendingCount: Math.max(0, current.checklist.pendingCount + (completed ? -1 : 1)),
        items: current.checklist.items.map((currentItem) => currentItem.id === item.id
          ? { ...currentItem, completed }
          : currentItem),
      },
    } : current)
    try {
      const result = await setChecklistItemCompletion(item.id, completed)
      setData((current) => current ? {
        ...current,
        checklist: {
          ...current.checklist,
          items: current.checklist.items.map((currentItem) => currentItem.id === item.id
            ? { ...currentItem, ...result }
            : currentItem),
        },
      } : current)
    } catch (reason) {
      setData((current) => current ? {
        ...current,
        checklist: {
          ...current.checklist,
          pendingCount: Math.max(0, current.checklist.pendingCount + (completed ? 1 : -1)),
          items: current.checklist.items.map((currentItem) => currentItem.id === item.id ? item : currentItem),
        },
      } : current)
      setChecklistError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o item')
    } finally {
      setChecklistSavingIds((current) => current.filter((id) => id !== item.id))
    }
  }

  const navigateToDay = (targetDate: string) => {
    if (!data || loading) return
    setDayDirection(targetDate > data.day.date ? 1 : -1)
    setSelectedActivity(null)
    void load(targetDate)
  }

  const dayModeLabel = data?.day.mode === 'today' ? 'Hoje' : data?.day.mode === 'upcoming' ? 'Próximo dia da viagem' : 'Dia anterior'

  return (
    <>
      <main className="today-page" id="main-content">
        <AnimatePresence mode="sync" initial={false}>
        {loading && !data && (
          <motion.div
            className="today-initial-view"
            key="today-loading"
            exit={reduceMotion ? undefined : { opacity: 0, filter: 'blur(1px)' }}
            transition={{ duration: 0.14 }}
          >
            <TodaySkeleton />
          </motion.div>
        )}
        {error && !data && <motion.section className="today-error today-initial-view" key="today-error" role="alert" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}><CircleAlert size={24} /><strong>Não foi possível abrir o seu dia</strong><span>{error}</span><button type="button" onClick={() => void load()}><RefreshCw size={15} />Tentar novamente</button></motion.section>}
        {data && <motion.div
          className="today-initial-view"
          key="today-content"
          initial={reduceMotion ? false : { opacity: 0, filter: 'blur(1px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          transition={{ type: 'spring', duration: 0.22, bounce: 0 }}
        >
          <header className="today-header"><div className="header-info"><p>{data.trip.title}</p><h1>{greeting()}, {data.user.displayName}</h1></div><IconButton icon={Bell} ariaLabel="Notificações" /></header>
          <AnimatePresence mode="popLayout" initial={false} custom={dayDirection}>
            <motion.div
              className="today-day-content"
              key={data.day.date}
              aria-live="polite"
              initial={reduceMotion ? false : { opacity: 0.72, x: dayDirection * 12, filter: 'blur(2px)' }}
              animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              exit={reduceMotion ? undefined : { opacity: 0, x: dayDirection * -5, filter: 'blur(1px)' }}
              transition={{ type: 'spring', duration: 0.22, bounce: 0 }}
            >
          <section className={`today-day-picker${loading ? ' is-loading' : ''}`} aria-label="Navegar entre os dias da viagem" aria-busy={loading}><button type="button" aria-label="Dia anterior" disabled={!data.day.previousDate || loading} onClick={() => data.day.previousDate && navigateToDay(data.day.previousDate)}><ChevronLeft size={17} /></button><div><span>{dayModeLabel}</span><strong>{data.day.city}</strong><small>{formatDay(data.day.date)}</small></div><button type="button" aria-label="Próximo dia" disabled={!data.day.nextDate || loading} onClick={() => data.day.nextDate && navigateToDay(data.day.nextDate)}><ChevronRight size={17} /></button>{loading && <span className="today-refreshing" role="status">A carregar outro dia…</span>}</section>
          {error && <p className="today-action-error" role="alert">{error}</p>}
          {highlightedActivity ? <section className="next-activity" aria-labelledby="next-activity-title">
            <div className="next-activity__topline"><span>{data.day.mode === 'today' ? 'Próxima atividade' : 'Em destaque'}</span><span className="next-activity__documents"><FileText size={15} />{highlightedActivity.documents.length}</span></div>
            <h2 id="next-activity-title">{highlightedActivity.title}</h2>
            <div className="next-activity__time"><strong>{highlightedActivity.time ?? 'A definir'}</strong>{highlightedActivity.endTime && <span>até {highlightedActivity.endTime}</span>}</div>
            {highlightedActivity.address && <div className="next-activity__address"><MapPin size={18} aria-hidden="true" /><span>{highlightedActivity.address}</span></div>}
            <div className="route-art" aria-hidden="true"><span className="route-art__origin" /><span className="route-art__line" /><ChevronRight className="route-art__arrow" size={16} /><small>VOCÊ</small><small>{data.day.city}</small></div>
            <div className="next-activity__actions"><a className="primary-action" href={highlightedActivity.mapsUrl} target="_blank" rel="noreferrer"><Map size={18} />Abrir no Maps</a><button className="glass-action" type="button" onClick={() => setSelectedActivity(highlightedActivity)}>Ver detalhes</button></div>
          </section> : <section className="today-complete"><Check size={22} /><div><strong>Dia concluído</strong><span>Todas as atividades planejadas foram finalizadas.</span></div></section>}

          <section className="day-summary" aria-label={`${completedCount} de ${activeActivities.length} atividades concluídas`}><div><strong>{completedCount} de {activeActivities.length} atividades concluídas</strong><p>{currency.format(data.expenses.spentForDay)} gastos neste dia{data.expenses.budgetAmount > 0 ? ` · ${currency.format(Math.max(0, data.expenses.remaining))} disponíveis` : ''}</p></div><div className="progress-ring" style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span>{progress}%</span></div></section>
          {actionError && <p className="today-action-error" role="alert">{actionError}</p>}
          {data.checklist.phase !== 'after' && (
            <ContextualChecklist
              checklist={data.checklist}
              savingIds={checklistSavingIds}
              error={checklistError}
              reduceMotion={reduceMotion}
              onToggle={(item) => void toggleChecklistItem(item)}
            />
          )}
          <section className="today-agenda" aria-labelledby="today-agenda-title"><div className="section-heading"><h2 id="today-agenda-title">Roteiro do dia</h2><span>{data.activities.length} atividades</span></div>
            {data.activities.length ? <div className="timeline">{data.activities.map((activity) => {
              const isHighlighted = activity.id === highlightedActivity?.id
              const isSaving = savingIds.includes(activity.id)
              return <article className={`timeline-item${activity.completed ? ' is-done' : ''}${isHighlighted ? ' is-current' : ''}${activity.status === 'cancelled' ? ' is-cancelled' : ''}`} key={activity.id}><span className="timeline-item__marker" aria-hidden="true">{activity.completed && <Check size={11} strokeWidth={3} />}</span><div className="timeline-card"><time>{activity.time ?? 'A definir'}{activity.endTime && <small>–{activity.endTime}</small>}</time><h3>{activity.title}</h3><p>{categoryLabels[activity.category] ?? activity.category}{activity.address ? ` · ${activity.address}` : ''}</p>{activity.documents.length > 0 && <span className="timeline-documents"><FileText size={13} />{activity.documents.length} {activity.documents.length === 1 ? 'documento' : 'documentos'}</span>}<div className="timeline-card__actions"><button type="button" onClick={() => setSelectedActivity(activity)}>Detalhes</button>{activity.status !== 'cancelled' && <button type="button" disabled={isSaving} aria-busy={isSaving} onClick={() => void toggleActivity(activity)}>{isSaving ? 'A guardar…' : activity.completed ? 'Desfazer' : 'Concluir'}</button>}</div></div></article>
            })}</div> : <div className="today-empty"><CalendarClock size={24} /><strong>Dia livre</strong><span>Nenhuma atividade foi adicionada a este dia.</span></div>}
          </section>
            </motion.div>
          </AnimatePresence>
        </motion.div>}
        </AnimatePresence>
      </main>
      <ModalPortal open={Boolean(selectedActivity)} onClose={() => setSelectedActivity(null)}>{selectedActivity && <ActivityDetails activity={selectedActivity} onClose={() => setSelectedActivity(null)} />}</ModalPortal>
    </>
  )
}
