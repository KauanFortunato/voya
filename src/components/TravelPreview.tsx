import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Clock3, Footprints, RefreshCw } from 'lucide-react'

import { getTravelPreview, type TravelPreviewPayload } from '../api/routes'
import type { CalendarActivity } from '../data/itinerary'
import './TravelPreview.css'

function formatDistance(meters: number) {
  if (meters < 1000) return `${meters} m`
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(meters / 1000)} km`
}

function departureTime(arrivalTime: string, durationSeconds: number) {
  if (!/^\d{2}:\d{2}$/.test(arrivalTime)) return null
  const [hours, minutes] = arrivalTime.split(':').map(Number)
  const departureMinutes = hours * 60 + minutes - Math.ceil(durationSeconds / 60)
  if (departureMinutes < 0) return null
  return `${String(Math.floor(departureMinutes / 60)).padStart(2, '0')}:${String(departureMinutes % 60).padStart(2, '0')}`
}

export default function TravelPreview({
  origin,
  destination,
}: {
  origin: CalendarActivity
  destination: CalendarActivity
}) {
  const reduceMotion = useReducedMotion()
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [preview, setPreview] = useState<TravelPreviewPayload | null>(null)
  const [error, setError] = useState('')
  const [retryCount, setRetryCount] = useState(0)
  const isSamePlace = origin.address.trim().toLocaleLowerCase('pt-PT')
    === destination.address.trim().toLocaleLowerCase('pt-PT')

  useEffect(() => {
    if (isSamePlace || !origin.serverId || !destination.serverId) return
    const controller = new AbortController()
    setState('loading')
    setError('')
    getTravelPreview(origin.serverId, destination.serverId, controller.signal)
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
  }, [destination.serverId, isSamePlace, origin.serverId, retryCount])

  const departure = preview ? departureTime(destination.time, preview.durationSeconds) : null
  const durationMinutes = preview ? Math.ceil(preview.durationSeconds / 60) : 0

  return (
    <section className="travel-preview" aria-label={`Deslocamento desde ${origin.title}`} aria-live="polite">
      <div className="travel-preview__heading">
        <span><Footprints size={16} aria-hidden="true" /></span>
        <div><strong>Desde {origin.title}</strong><small>Estimativa Google Maps</small></div>
      </div>

      {isSamePlace ? (
        <div className="travel-preview__result">
          <strong>Mesmo local</strong><span>Não é necessário deslocamento</span>
        </div>
      ) : (
        <AnimatePresence mode="wait" initial={false}>
          {state === 'loading' && (
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
              <i className="travel-preview-visually-hidden">A calcular percurso a pé…</i>
            </motion.div>
          )}

          {state === 'ready' && preview && (
            <motion.div
              className="travel-preview__result"
              key="ready"
              initial={reduceMotion ? false : { opacity: 0, y: 4, filter: 'blur(2px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -1, filter: 'blur(1px)' }}
              transition={{ type: 'spring', duration: 0.2, bounce: 0 }}
            >
              <strong>{durationMinutes < 1 ? 'Menos de 1 min' : `${durationMinutes} min a pé`}</strong>
              <span>{formatDistance(preview.distanceMeters)}</span>
              {departure && <small><Clock3 size={13} aria-hidden="true" />Saída sugerida às {departure}</small>}
            </motion.div>
          )}

          {state === 'error' && (
            <motion.div
              className="travel-preview__error"
              key="error"
              role="alert"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0 }}
              transition={{ duration: reduceMotion ? 0 : 0.16 }}
            >
              <span>{error}</span>
              <button type="button" onClick={() => setRetryCount((count) => count + 1)}><RefreshCw size={13} aria-hidden="true" />Tentar novamente</button>
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </section>
  )
}
