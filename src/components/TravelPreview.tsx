import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Bus, CarFront, Clock3, Footprints, RefreshCw, type LucideIcon } from 'lucide-react'

import { getTravelPreview, type TravelMode, type TravelPreviewPayload } from '../api/routes'
import './TravelPreview.css'

export type TravelPreviewActivity = {
  id: string
  title: string
  address: string
  time: string | null
}

const modes: Array<{ value: TravelMode; label: string; Icon: LucideIcon }> = [
  { value: 'WALK', label: 'A pé', Icon: Footprints },
  { value: 'TRANSIT', label: 'Autocarro', Icon: Bus },
  { value: 'DRIVE', label: 'Carro', Icon: CarFront },
]

function formatDistance(meters: number) {
  if (meters < 1000) return `${meters} m`
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(meters / 1000)} km`
}

function departureTime(arrivalTime: string | null, durationSeconds: number) {
  if (!arrivalTime || !/^\d{2}:\d{2}$/.test(arrivalTime)) return null
  const [hours, minutes] = arrivalTime.split(':').map(Number)
  const departureMinutes = hours * 60 + minutes - Math.ceil(durationSeconds / 60)
  if (departureMinutes < 0) return null
  return `${String(Math.floor(departureMinutes / 60)).padStart(2, '0')}:${String(departureMinutes % 60).padStart(2, '0')}`
}

export default function TravelPreview({
  origin,
  destination,
}: {
  origin: TravelPreviewActivity
  destination: TravelPreviewActivity
}) {
  const reduceMotion = useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)
  const [visible, setVisible] = useState(false)
  const [mode, setMode] = useState<TravelMode>('WALK')
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle')
  const [preview, setPreview] = useState<TravelPreviewPayload | null>(null)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const isSamePlace = origin.address.trim().toLocaleLowerCase('pt-PT')
    === destination.address.trim().toLocaleLowerCase('pt-PT')

  useEffect(() => {
    const section = sectionRef.current
    if (!section || visible) return
    if (!('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return
      setVisible(true)
      observer.disconnect()
    }, { rootMargin: '180px' })
    observer.observe(section)
    return () => observer.disconnect()
  }, [visible])

  useEffect(() => {
    if (!visible || isSamePlace) return
    const controller = new AbortController()
    setState('loading')
    setError('')
    getTravelPreview(origin.id, destination.id, mode, controller.signal)
      .then((result) => {
        setPreview(result)
        setState('ready')
      })
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === 'AbortError') return
        setError(reason instanceof Error ? reason.message : 'Não foi possível calcular o deslocamento')
        setState('error')
      })
    return () => controller.abort()
  }, [destination.id, isSamePlace, mode, origin.id, retryCount, visible])

  const departure = preview ? departureTime(destination.time, preview.durationSeconds) : null
  const durationMinutes = preview ? Math.ceil(preview.durationSeconds / 60) : 0
  const selectedMode = modes.find((item) => item.value === mode) ?? modes[0]
  const SelectedIcon = selectedMode.Icon

  return (
    <section ref={sectionRef} className="travel-preview" aria-label={`Deslocamento de ${origin.title} para ${destination.title}`}>
      <div className="travel-preview__summary" aria-live="polite">
        <span className="travel-preview__icon"><SelectedIcon size={17} aria-hidden="true" /></span>
        {isSamePlace ? (
          <div className="travel-preview__result"><strong>Mesmo local</strong><span>Sem deslocamento</span></div>
        ) : (
          <AnimatePresence mode="wait" initial={false}>
            {(state === 'idle' || state === 'loading') && (
              <motion.div
                className="travel-preview__loading"
                key="loading"
                role="status"
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: reduceMotion ? 0 : 0.12 }}
              >
                <span /><span />
                <i className="travel-preview-visually-hidden">A calcular o tempo de deslocamento…</i>
              </motion.div>
            )}

            {state === 'ready' && preview && (
              <motion.div
                className="travel-preview__result"
                key={`${mode}-ready`}
                initial={reduceMotion ? false : { opacity: 0, y: 3, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={reduceMotion ? undefined : { opacity: 0, y: -1, filter: 'blur(1px)' }}
                transition={{ type: 'spring', duration: 0.2, bounce: 0 }}
              >
                <strong>{durationMinutes < 1 ? 'Menos de 1 min' : `${durationMinutes} min`}</strong>
                <span>{formatDistance(preview.distanceMeters)} · {selectedMode.label}</span>
                {departure && <small><Clock3 size={13} aria-hidden="true" />Sair às {departure}</small>}
              </motion.div>
            )}

            {state === 'error' && (
              <motion.div className="travel-preview__error" key="error" role="alert" initial={reduceMotion ? false : { opacity: 0 }} animate={{ opacity: 1 }}>
                <span>{error}</span>
                <button type="button" onClick={() => setRetryCount((count) => count + 1)}><RefreshCw size={13} aria-hidden="true" />Tentar</button>
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </div>

      {!isSamePlace && (
        <div className="travel-preview__modes" aria-label="Modo de deslocamento">
          {modes.map(({ value, label, Icon }) => (
            <button
              className={mode === value ? 'is-selected' : ''}
              type="button"
              aria-pressed={mode === value}
              key={value}
              onClick={() => setMode(value)}
            >
              <Icon size={14} aria-hidden="true" />{label}
            </button>
          ))}
        </div>
      )}
      {mode === 'WALK' && !isSamePlace && <small className="travel-preview__notice">Percursos a pé podem não refletir todos os passeios.</small>}
    </section>
  )
}
