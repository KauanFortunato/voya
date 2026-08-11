import { useState, type FormEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { LockKeyhole } from 'lucide-react'

import { useAuth } from '../auth/auth'
import logo from '../assets/voya-logo.png'
import './LoginPage.css'

const familyMembers = ['Kauan', 'Kairon', 'Helieny', 'Anicio']

export default function LoginPage() {
  const { login } = useAuth()
  const reduceMotion = useReducedMotion()
  const [name, setName] = useState(familyMembers[0])
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setError('')
    setSubmitting(true)
    try {
      await login(name, password)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Não foi possível iniciar sessão')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="login-page" id="main-content">
      <motion.section
        className="login-card"
        initial={reduceMotion ? false : { opacity: 0, y: 8, filter: 'blur(3px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ type: 'spring', duration: 0.26, bounce: 0 }}
      >
        <img src={logo} alt="Voya" />
        <div className="login-card__intro">
          <span><LockKeyhole size={16} aria-hidden="true" /> Área da família</span>
          <h1>Bem-vindo de volta</h1>
          <p>Entre para acompanhar a viagem e os documentos da família.</p>
        </div>

        <form onSubmit={submit}>
          <label>
            Viajante
            <select value={name} onChange={(event) => setName(event.target.value)} disabled={submitting}>
              {familyMembers.map((member) => <option key={member}>{member}</option>)}
            </select>
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              disabled={submitting}
            />
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting || !password} aria-busy={submitting}>
            {submitting ? 'A entrar…' : 'Entrar'}
          </button>
        </form>
      </motion.section>
    </main>
  )
}
