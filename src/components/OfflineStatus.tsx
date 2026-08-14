import { CheckCircle2, CloudDownload, CloudOff, TriangleAlert } from 'lucide-react'
import { useEffect, useState } from 'react'

import {
  prepareEssentialOfflineData,
  readLastOfflineSync,
  type OfflinePreparationResult,
} from '../offline/data'

function formatSyncTime(value: string | null) {
  if (!value) return 'As áreas ainda não abertas podem não estar disponíveis.'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'A mostrar a informação guardada neste dispositivo.'
  return `Informação guardada em ${new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)}.`
}

export default function OfflineStatus() {
  const [online, setOnline] = useState(() => navigator.onLine)
  const [lastSync, setLastSync] = useState(() => readLastOfflineSync())
  const [preparation, setPreparation] = useState<OfflinePreparationResult | null>(null)
  const [showReady, setShowReady] = useState(false)

  useEffect(() => {
    const updateConnection = () => setOnline(navigator.onLine)
    const updateSync = () => setLastSync(readLastOfflineSync())
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    window.addEventListener('voya:offline-cache-updated', updateSync)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
      window.removeEventListener('voya:offline-cache-updated', updateSync)
    }
  }, [])

  useEffect(() => {
    if (!online) return
    let active = true
    setShowReady(false)
    void prepareEssentialOfflineData((progress) => {
      if (active) setPreparation(progress)
    }).then((result) => {
      if (!active) return
      setPreparation(result)
      if (!result.failed) setShowReady(true)
    })
    return () => { active = false }
  }, [online])

  useEffect(() => {
    if (!showReady) return
    const timeout = window.setTimeout(() => setShowReady(false), 3_000)
    return () => window.clearTimeout(timeout)
  }, [showReady])

  if (online && preparation && preparation.completed + preparation.failed < preparation.total) {
    const finished = preparation.completed + preparation.failed
    return (
      <aside className="offline-status is-preparing" role="status" aria-live="polite">
        <CloudDownload size={17} aria-hidden="true" />
        <span><strong>A preparar acesso offline</strong><small>{finished} de {preparation.total} áreas guardadas</small></span>
        <i className="offline-status__progress" aria-hidden="true"><b style={{ transform: `scaleX(${finished / preparation.total})` }} /></i>
      </aside>
    )
  }

  if (online && preparation?.failed) {
    return (
      <aside className="offline-status is-warning" role="status">
        <TriangleAlert size={17} aria-hidden="true" />
        <span><strong>Preparação offline incompleta</strong><small>Abra novamente com internet antes da viagem.</small></span>
      </aside>
    )
  }

  if (online && showReady) {
    return (
      <aside className="offline-status is-ready" role="status" aria-live="polite">
        <CheckCircle2 size={17} aria-hidden="true" />
        <span><strong>Voya pronto para uso offline</strong><small>As informações essenciais foram guardadas.</small></span>
      </aside>
    )
  }

  if (online) return null

  return (
    <aside className="offline-status" role="status" aria-live="polite">
      <CloudOff size={17} aria-hidden="true" />
      <span><strong>Sem ligação</strong><small>{formatSyncTime(lastSync)}</small></span>
    </aside>
  )
}
