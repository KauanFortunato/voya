import { createContext, useContext } from 'react'

export type AuthUser = {
  id: string
  displayName: string
  role: 'organizer' | 'traveler'
}

export type AuthContextValue = {
  status: 'loading' | 'authenticated' | 'anonymous'
  user: AuthUser | null
  login: (name: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
