import { Check, CloudOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { prepareEssentialOfflineData } from '../offline/data'

type ConnectionState = 'online' | 'offline' | 'reconnected'

export default function OfflineStatus() {
  const [state, setState] = useState<ConnectionState>(() => navigator.onLine ? 'online' : 'offline')
  const wasOffline = useRef(!navigator.onLine)

  useEffect(() => {
    let hideReconnectMessage: number | undefined

    const prepareSilently = () => {
      void prepareEssentialOfflineData()
    }

    const handleOffline = () => {
      if (hideReconnectMessage) window.clearTimeout(hideReconnectMessage)
      wasOffline.current = true
      setState('offline')
    }

    const handleOnline = () => {
      prepareSilently()
      if (!wasOffline.current) return
      wasOffline.current = false
      setState('reconnected')
      hideReconnectMessage = window.setTimeout(() => setState('online'), 3_000)
    }

    if (navigator.onLine) prepareSilently()
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      if (hideReconnectMessage) window.clearTimeout(hideReconnectMessage)
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  if (state === 'online') return null

  return state === 'offline' ? (
    <aside className="connection-strip is-offline" role="status" aria-live="polite">
      <CloudOff size={13} aria-hidden="true" />
      <span>Sem conexão · mostrando dados salvos</span>
    </aside>
  ) : (
    <aside className="connection-strip is-reconnected" role="status" aria-live="polite">
      <Check size={13} aria-hidden="true" />
      <span>Conexão restabelecida</span>
    </aside>
  )
}
