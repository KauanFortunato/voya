import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'

import { AuthContext, type AuthContextValue, type AuthUser } from './auth'

async function readError(response: Response) {
  const payload = await response.json().catch(() => null) as { error?: string } | null
  return payload?.error ?? 'Não foi possível concluir o pedido'
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')
  const [user, setUser] = useState<AuthUser | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/auth/me', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) {
          setStatus('anonymous')
          return
        }
        const payload = await response.json() as { user: AuthUser }
        setUser(payload.user)
        setStatus('authenticated')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setStatus('anonymous')
      })
    return () => controller.abort()
  }, [])

  const login = useCallback(async (name: string, password: string) => {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, password }),
    })
    if (!response.ok) throw new Error(await readError(response))
    const payload = await response.json() as { user: AuthUser }
    setUser(payload.user)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => undefined)
    setUser(null)
    setStatus('anonymous')
  }, [])

  const value = useMemo(() => ({ status, user, login, logout }), [status, user, login, logout])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
