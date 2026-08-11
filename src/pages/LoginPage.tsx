import { useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  Eye,
  EyeOff,
  FileCheck2,
  LockKeyhole,
  MapPin,
  Plane,
  Route,
  Users,
} from 'lucide-react'

import { useAuth } from '../auth/auth'
import logo from '../assets/voya-logo.png'
import './LoginPage.css'

const familyMembers = [
  { name: 'Kauan', initials: 'K' },
  { name: 'Kairon', initials: 'Ka' },
  { name: 'Helieny', initials: 'H' },
  { name: 'Anicio', initials: 'A' },
]
const onboardingStorageKey = 'voya:onboarding-complete'

type OnboardingSlide = {
  eyebrow: string
  title: string
  description: string
  art: ReactNode
}

const slides: OnboardingSlide[] = [
  {
    eyebrow: 'A viagem começa aqui',
    title: 'Toda a família no mesmo caminho',
    description: 'Planeie cada dia, acompanhe os horários e mantenha todos alinhados durante a viagem.',
    art: (
      <div className="onboarding-art onboarding-art--route" aria-hidden="true">
        <span className="onboarding-art__map"><Route size={42} strokeWidth={1.55} /></span>
        <span className="onboarding-art__pin"><MapPin size={19} /></span>
        <span className="onboarding-art__plane"><Plane size={21} /></span>
        <i /><i /><i />
      </div>
    ),
  },
  {
    eyebrow: 'Tudo à mão',
    title: 'Roteiro e documentos juntos',
    description: 'Bilhetes, reservas e atividades ficam ligados para encontrar o ficheiro certo no momento certo.',
    art: (
      <div className="onboarding-art onboarding-art--documents" aria-hidden="true">
        <span><CalendarDays size={31} /><b>17</b><small>Roma</small></span>
        <span><FileCheck2 size={34} /><b>13 ficheiros</b><small>Guardados na NAS</small></span>
        <i><Check size={16} /></i>
      </div>
    ),
  },
  {
    eyebrow: 'Feito para vocês',
    title: 'Cada viajante conta',
    description: 'Preferências, necessidades e responsabilidades ajudam a criar uma viagem confortável para todos.',
    art: (
      <div className="onboarding-art onboarding-art--family" aria-hidden="true">
        <span><Users size={35} /></span>
        {familyMembers.map((member) => <i key={member.name}>{member.initials}</i>)}
      </div>
    ),
  },
]

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState(0)
  const slide = slides[step]
  const isLast = step === slides.length - 1

  return (
    <main className="onboarding-page" id="main-content">
      <header className="onboarding-header">
        <img src={logo} alt="Voya" />
        <button type="button" onClick={onComplete}>Pular</button>
      </header>

      <div className="onboarding-stage" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            className="onboarding-slide"
            key={step}
            initial={reduceMotion ? false : { opacity: 0, x: 18, filter: 'blur(3px)' }}
            animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
            exit={reduceMotion ? undefined : { opacity: 0, x: -8, filter: 'blur(1px)' }}
            transition={{ type: 'spring', duration: 0.32, bounce: 0 }}
          >
            {slide.art}
            <div className="onboarding-copy">
              <span>{slide.eyebrow}</span>
              <h1>{slide.title}</h1>
              <p>{slide.description}</p>
            </div>
          </motion.section>
        </AnimatePresence>
      </div>

      <footer className="onboarding-footer">
        <div className="onboarding-progress" role="progressbar" aria-label={`Passo ${step + 1} de ${slides.length}`} aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={step + 1}>
          {slides.map((item, index) => <i key={item.title} className={index === step ? 'is-active' : ''} />)}
        </div>
        <div className="onboarding-actions">
          {step > 0 ? <button className="onboarding-back" type="button" onClick={() => setStep((current) => current - 1)}><ArrowLeft size={17} />Voltar</button> : <span />}
          <button className="onboarding-next" type="button" onClick={() => isLast ? onComplete() : setStep((current) => current + 1)}>
            {isLast ? 'Entrar no Voya' : 'Próximo'}<ArrowRight size={18} />
          </button>
        </div>
      </footer>
    </main>
  )
}

function LoginCard() {
  const { login } = useAuth()
  const reduceMotion = useReducedMotion()
  const [name, setName] = useState(familyMembers[0].name)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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
        transition={{ type: 'spring', duration: 0.28, bounce: 0 }}
      >
        <div className="login-brand"><img src={logo} alt="Voya" /><span><LockKeyhole size={14} />Área privada da família</span></div>
        <div className="login-card__intro">
          <h1>Quem está viajando?</h1>
          <p>Escolha o seu perfil e entre para acompanhar a Itália 2026.</p>
        </div>

        <form onSubmit={submit}>
          <fieldset className="login-travelers" disabled={submitting}>
            <legend>Viajante</legend>
            <div>
              {familyMembers.map((member) => {
                const selected = name === member.name
                return (
                  <button type="button" key={member.name} className={selected ? 'is-selected' : ''} aria-pressed={selected} onClick={() => setName(member.name)}>
                    <i>{member.initials}</i><span>{member.name}</span>{selected && <Check size={15} aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <label className="login-password">
            <span>Senha</span>
            <div>
              <LockKeyhole size={17} aria-hidden="true" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Digite a senha da família"
                required
                disabled={submitting}
              />
              <button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((current) => !current)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={submitting || !password} aria-busy={submitting}>
            {submitting ? 'A entrar…' : <>Entrar como {name}<ArrowRight size={18} /></>}
          </button>
        </form>
        <p className="login-card__security"><LockKeyhole size={13} />Sessão protegida e documentos guardados na sua NAS.</p>
      </motion.section>
    </main>
  )
}

export default function LoginPage() {
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem(onboardingStorageKey) !== '1')
  const completeOnboarding = () => {
    localStorage.setItem(onboardingStorageKey, '1')
    setShowOnboarding(false)
  }

  return showOnboarding ? <Onboarding onComplete={completeOnboarding} /> : <LoginCard />
}
