import { useMemo, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import {
  Bell,
  Check,
  ChevronRight,
  Clock3,
  Map,
  MapPin,
  Sun,
  Ticket,
  X,
} from 'lucide-react'

import IconButton from '../components/IconButton'
import ModalPortal from '../components/ModalPortal'
import voyaLogo from '../assets/voya-logo.png'
import { today } from '../data/trip'
import './TodayPage.css'

export default function TodayPage() {
  const reduceMotion = useReducedMotion()
  const [completedIds, setCompletedIds] = useState(() =>
    today.activities.filter((activity) => activity.status === 'completed').map(({ id }) => id),
  )
  const [detailsOpen, setDetailsOpen] = useState(false)

  const currentActivity = today.activities.find((activity) => activity.status === 'current')
  const progress = Math.round((completedIds.length / today.activities.length) * 100)
  const completedLabel = useMemo(
    () => `${completedIds.length} de ${today.activities.length} atividades concluídas`,
    [completedIds.length],
  )

  const toggleActivity = (id: string) => {
    setCompletedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  return (
    <>
      <main className="today-page" id="main-content">
        <header className="today-header">
          <div className="header-info">
            <img className="today-brand-logo" src={voyaLogo} alt="Voya" />
            <p>Quinta-feira, 12 setembro</p>
            <h1>Bom dia, Kauan</h1>
          </div>
          <IconButton icon={Bell} ariaLabel="Notificações" />
        </header>

        {currentActivity && (
          <section className="next-activity" aria-labelledby="next-activity-title">
            <div className="next-activity__topline">
              <span>Próxima atividade</span>
              <span className="weather"><Sun size={17} aria-hidden="true" />24°</span>
            </div>
            <h2 id="next-activity-title">{currentActivity.title}</h2>
            <div className="next-activity__time">
              <strong>{currentActivity.time}</strong>
              <span>saia às 09:32 · 18 min</span>
            </div>
            <div className="next-activity__address">
              <MapPin size={18} aria-hidden="true" />
              <span>{currentActivity.address}<br />Entrada Sperone Valadier</span>
            </div>
            <div className="route-art" aria-hidden="true">
              <span className="route-art__origin" />
              <span className="route-art__line" />
              <ChevronRight className="route-art__arrow" size={16} />
              <small>HOTEL</small>
              <small>COLISEU</small>
            </div>
            <div className="next-activity__actions">
              <a
                className="primary-action"
                href={currentActivity.mapsUrl}
                target="_blank"
                rel="noreferrer"
              >
                <Map size={18} aria-hidden="true" /> Abrir no Maps
              </a>
              <button className="glass-action" type="button" onClick={() => setDetailsOpen(true)}>
                Ver detalhes
              </button>
            </div>
          </section>
        )}

        <section className="day-summary" aria-label={completedLabel}>
          <div>
            <strong>{completedLabel}</strong>
            <p>€42 gastos hoje · €38 disponíveis</p>
          </div>
          <div
            className="progress-ring"
            style={{ '--progress': `${progress * 3.6}deg` } as React.CSSProperties}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span>{progress}%</span>
          </div>
        </section>

        <section className="today-agenda" aria-labelledby="today-agenda-title">
          <div className="section-heading">
            <h2 id="today-agenda-title">O seu dia</h2>
            <span>Roma</span>
          </div>
          <div className="timeline">
            {today.activities.map((activity) => {
              const isDone = completedIds.includes(activity.id)
              const isCurrent = activity.id === currentActivity?.id && !isDone
              return (
                <article
                  className={`timeline-item${isDone ? ' is-done' : ''}${isCurrent ? ' is-current' : ''}`}
                  key={activity.id}
                >
                  <span className="timeline-item__marker" aria-hidden="true">
                    {isDone && <Check size={11} strokeWidth={3} />}
                  </span>
                  <div className="timeline-card">
                    <time>{activity.time}</time>
                    <h3>{activity.title}</h3>
                    <p>{activity.label} · {activity.address}</p>
                    <button type="button" onClick={() => toggleActivity(activity.id)}>
                      {isDone ? 'Desfazer' : 'Concluir'}
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      </main>

      <ModalPortal open={detailsOpen && Boolean(currentActivity)} onClose={() => setDetailsOpen(false)}>
        {currentActivity && (
          <motion.div
            className="sheet-backdrop"
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setDetailsOpen(false)}
          >
            <motion.section
              className="details-sheet"
              role="dialog"
              aria-modal="true"
              aria-labelledby="details-title"
              initial={reduceMotion ? false : { y: '100%' }}
              animate={{ y: 0 }}
              exit={reduceMotion ? undefined : { y: 24, opacity: 0 }}
              transition={{ type: 'spring', duration: 0.42, bounce: 0 }}
              onClick={(event) => event.stopPropagation()}
            >
              <span className="details-sheet__handle" aria-hidden="true" />
              <div className="details-sheet__heading">
                <h2 id="details-title">{currentActivity.title}</h2>
                <IconButton icon={X} ariaLabel="Fechar detalhes" onClick={() => setDetailsOpen(false)} />
              </div>
              <p>Entrada marcada para 10:00. Mostre o bilhete digital no acesso.</p>
              <div className="details-sheet__rows">
                <div><Clock3 aria-hidden="true" /><span><strong>Saia às 09:32</strong><small>18 min a pé desde o hotel</small></span></div>
                <div><Ticket aria-hidden="true" /><span><strong>Reserva VL-2847</strong><small>4 viajantes · entrada combinada</small></span></div>
                <div><MapPin aria-hidden="true" /><span><strong>{currentActivity.address}</strong><small>Entrada Sperone Valadier</small></span></div>
              </div>
              <button className="sheet-primary-action" type="button">Abrir bilhete</button>
            </motion.section>
          </motion.div>
        )}
      </ModalPortal>
    </>
  )
}
