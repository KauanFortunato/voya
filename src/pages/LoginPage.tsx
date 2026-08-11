import { useState, type FormEvent, type ReactNode } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckSquare2,
  Clock3,
  Coffee,
  Eye,
  EyeOff,
  FileText,
  Hotel,
  Landmark,
  LockKeyhole,
  Luggage,
  MapPin,
  Navigation,
  Plane,
  Ticket,
  Utensils,
} from 'lucide-react'

import { useAuth } from '../auth/auth'
import logo from '../assets/voya-logo.png'
import './LoginPage.css'

const travelers = [
  { name: 'Kauan', initials: 'K' },
  { name: 'Kairon', initials: 'Ka' },
  { name: 'Helieny', initials: 'H' },
  { name: 'Anicio', initials: 'A' },
]
const onboardingStorageKey = 'voya:onboarding-complete'

function ArtItem({ children, className, index = 0 }: { children: ReactNode; className?: string; index?: number }) {
  const reduceMotion = useReducedMotion()
  return (
    <motion.span
      className={className}
      initial={reduceMotion ? false : { opacity: 0, y: 10, filter: 'blur(3px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ type: 'spring', duration: 0.38, bounce: 0, delay: reduceMotion ? 0 : 0.08 + index * 0.055 }}
    >
      {children}
    </motion.span>
  )
}

function WelcomeArt() {
  const reduceMotion = useReducedMotion()
  return (
    <div className="onboarding-art onboarding-art--welcome" aria-hidden="true">
      <svg className="welcome-route" viewBox="0 0 320 230" fill="none">
        <motion.path d="M18 165C72 199 94 84 157 119C208 147 222 43 302 70" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 9" initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.62 }} transition={{ duration: reduceMotion ? 0 : 0.75, delay: 0.12 }} />
      </svg>
      <motion.span className="welcome-plane" initial={reduceMotion ? false : { opacity: 0, x: -18, y: 12 }} animate={{ opacity: 1, x: 0, y: 0 }} transition={{ type: 'spring', duration: 0.46, bounce: 0, delay: 0.08 }}><Plane size={20} /></motion.span>
      <ArtItem className="welcome-pin welcome-pin--one" index={2}><MapPin size={16} /></ArtItem>
      <ArtItem className="welcome-pin welcome-pin--two" index={3}><MapPin size={16} /></ArtItem>
      <ArtItem className="welcome-phone" index={1}>
        <i /><b>Hoje em Roma</b><small>Terça, 17 de junho</small>
        <em><Clock3 size={12} /><span><strong>10:00 · Coliseu</strong><small>Próxima atividade</small></span></em>
        <em><Utensils size={12} /><span><strong>13:00 · Almoço</strong><small>Trastevere</small></span></em>
      </ArtItem>
    </div>
  )
}

function TimelineArt() {
  return (
    <div className="onboarding-art onboarding-art--timeline" aria-hidden="true">
      <div className="timeline-card">
        <ArtItem className="timeline-heading"><span>Roma · Hoje</span><b>Seu roteiro</b></ArtItem>
        <div className="timeline-line" />
        <ArtItem className="timeline-item" index={1}><i><Coffee size={14} /></i><span><small>08:30</small><b>Café da manhã</b></span></ArtItem>
        <ArtItem className="timeline-item is-next" index={2}><i><Landmark size={14} /></i><span><small>10:00 · A seguir</small><b>Coliseu</b><em>Via dei Fori Imperiali</em></span><Navigation size={15} /></ArtItem>
        <ArtItem className="timeline-item" index={3}><i><Utensils size={14} /></i><span><small>13:00</small><b>Almoço</b></span></ArtItem>
        <ArtItem className="timeline-item" index={4}><i><MapPin size={14} /></i><span><small>16:30</small><b>Fontana di Trevi</b></span></ArtItem>
      </div>
    </div>
  )
}

function MapsArt() {
  const reduceMotion = useReducedMotion()
  return (
    <div className="onboarding-art onboarding-art--maps" aria-hidden="true">
      <div className="map-grid" />
      <svg className="map-route" viewBox="0 0 320 230" fill="none"><motion.path d="M50 54C116 72 91 148 161 143C214 139 214 78 282 95" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeDasharray="7 8" initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.75 }} transition={{ duration: reduceMotion ? 0 : 0.65, delay: 0.1 }} /></svg>
      <ArtItem className="map-pin map-pin--hotel" index={1}><Hotel size={16} /></ArtItem>
      <ArtItem className="map-pin map-pin--place" index={2}><MapPin size={17} /></ArtItem>
      <ArtItem className="map-place-card" index={3}><i><Utensils size={17} /></i><span><b>Roscioli</b><small>Restaurante · Roma</small></span><em><Navigation size={13} />Abrir no Maps</em></ArtItem>
    </div>
  )
}

function PreparationArt() {
  return (
    <div className="onboarding-art onboarding-art--preparation" aria-hidden="true">
      <ArtItem className="preparation-card" index={0}><span><small>Preparação</small><b>78%</b></span><i><em /></i><strong>Quase tudo pronto</strong></ArtItem>
      <ArtItem className="checklist-card" index={1}>
        <b>Checklist</b>
        <span><Check size={12} />Passaportes</span><span><Check size={12} />Reservas</span><span><i />Carregadores</span>
      </ArtItem>
      <ArtItem className="travel-doc travel-doc--bag" index={2}><Luggage size={20} /></ArtItem>
      <ArtItem className="travel-doc travel-doc--ticket" index={3}><Ticket size={20} /></ArtItem>
      <ArtItem className="travel-doc travel-doc--file" index={4}><FileText size={20} /></ArtItem>
    </div>
  )
}

function ReadyArt() {
  const reduceMotion = useReducedMotion()
  return (
    <div className="onboarding-art onboarding-art--ready" aria-hidden="true">
      <svg className="ready-route" viewBox="0 0 320 230" fill="none"><motion.path d="M26 175C68 130 109 194 155 143C194 100 236 112 294 52" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="6 9" initial={reduceMotion ? false : { pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.5 }} transition={{ duration: reduceMotion ? 0 : 0.72, delay: 0.1 }} /></svg>
      <ArtItem className="ready-logo" index={1}><img src={logo} alt="" /><small>Sua viagem, passo a passo</small></ArtItem>
      <ArtItem className="ready-icon ready-icon--calendar" index={2}><CalendarDays size={20} /></ArtItem>
      <ArtItem className="ready-icon ready-icon--map" index={3}><MapPin size={20} /></ArtItem>
      <ArtItem className="ready-icon ready-icon--check" index={4}><CheckSquare2 size={20} /></ArtItem>
      <ArtItem className="ready-icon ready-icon--plane" index={5}><Plane size={20} /></ArtItem>
    </div>
  )
}

const slides = [
  { eyebrow: 'Bem-vindo ao Voya', title: 'Sua viagem, organizada do começo ao fim', description: 'Planeje roteiros, organize lugares, acesse endereços, mapas, documentos e checklist em um só lugar.', art: <WelcomeArt /> },
  { eyebrow: 'Seu dia, sem complicação', title: 'Veja seu dia em segundos', description: 'Abra o app e descubra rapidamente sua próxima atividade, horário, endereço e como chegar.', art: <TimelineArt /> },
  { eyebrow: 'Explore com facilidade', title: 'Endereços e mapas sempre à mão', description: 'Guarde restaurantes, atrações e hospedagens com endereço e acesso rápido ao Google Maps.', art: <MapsArt /> },
  { eyebrow: 'Tudo preparado', title: 'Prepare tudo antes de sair', description: 'Acompanhe checklist, documentos, reservas e itens da mochila para viajar com mais tranquilidade.', art: <PreparationArt /> },
  { eyebrow: 'Tudo pronto', title: 'Pronto para começar sua jornada?', description: 'Organize sua viagem de forma simples, bonita e prática com o Voya.', art: <ReadyArt /> },
]

function Onboarding({ onComplete }: { onComplete: () => void }) {
  const reduceMotion = useReducedMotion()
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const slide = slides[step]
  const isFirst = step === 0
  const isLast = step === slides.length - 1
  const move = (nextStep: number) => { setDirection(nextStep > step ? 1 : -1); setStep(nextStep) }

  return (
    <main className="onboarding-page" id="main-content">
      <header className="onboarding-header"><img src={logo} alt="Voya" /><button type="button" onClick={onComplete}>Pular</button></header>
      <div className="onboarding-stage" aria-live="polite">
        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.section className="onboarding-slide" key={step} custom={direction} initial={reduceMotion ? false : { opacity: 0, x: direction * 22, filter: 'blur(3px)' }} animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }} exit={reduceMotion ? undefined : { opacity: 0, x: direction * -9, filter: 'blur(1px)' }} transition={{ type: 'spring', duration: 0.36, bounce: 0 }}>
            {slide.art}
            <div className="onboarding-copy"><span>{slide.eyebrow}</span><h1>{slide.title}</h1><p>{slide.description}</p>{isLast && <button className="onboarding-account" type="button" onClick={onComplete}>Já tenho conta</button>}</div>
          </motion.section>
        </AnimatePresence>
      </div>
      <footer className="onboarding-footer">
        <div className="onboarding-progress" role="progressbar" aria-label={`Passo ${step + 1} de ${slides.length}`} aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={step + 1}>{slides.map((item, index) => <i key={item.title} className={index === step ? 'is-active' : ''} />)}</div>
        <div className={`onboarding-actions${isFirst ? ' is-first' : ''}`}>
          <button className="onboarding-back" type="button" disabled={isFirst} aria-hidden={isFirst} tabIndex={isFirst ? -1 : 0} onClick={() => move(step - 1)}><ArrowLeft size={17} />Voltar</button>
          <button className="onboarding-next" type="button" onClick={() => isLast ? onComplete() : move(step + 1)}>{isLast ? 'Começar' : 'Avançar'}<ArrowRight size={18} /></button>
        </div>
      </footer>
    </main>
  )
}

function LoginCard() {
  const { login } = useAuth()
  const reduceMotion = useReducedMotion()
  const [name, setName] = useState(travelers[0].name)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (submitting) return
    setError(''); setSubmitting(true)
    try { await login(name, password) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Não foi possível iniciar sessão') }
    finally { setSubmitting(false) }
  }

  return (
    <main className="login-page" id="main-content">
      <motion.section className="login-card" initial={reduceMotion ? false : { opacity: 0, y: 8, filter: 'blur(3px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} transition={{ type: 'spring', duration: 0.28, bounce: 0 }}>
        <div className="login-brand"><img src={logo} alt="Voya" /><span><LockKeyhole size={14} />Área privada</span></div>
        <div className="login-card__intro"><h1>Bem-vindo de volta</h1><p>Escolha seu perfil para acessar a viagem.</p></div>
        <form onSubmit={submit}>
          <fieldset className="login-travelers" disabled={submitting}><legend>Perfil</legend><div>{travelers.map((traveler) => { const selected = name === traveler.name; return <button type="button" key={traveler.name} className={selected ? 'is-selected' : ''} aria-pressed={selected} onClick={() => setName(traveler.name)}><i>{traveler.initials}</i><span>{traveler.name}</span>{selected && <Check size={15} aria-hidden="true" />}</button> })}</div></fieldset>
          <label className="login-password"><span>Senha</span><div><LockKeyhole size={17} aria-hidden="true" /><input type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" placeholder="Digite sua senha" required disabled={submitting} /><button type="button" aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'} onClick={() => setShowPassword((current) => !current)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></label>
          {error && <p className="login-error" role="alert">{error}</p>}
          <button className="login-submit" type="submit" disabled={submitting || !password} aria-busy={submitting}>{submitting ? 'A entrar…' : <>Entrar<ArrowRight size={18} /></>}</button>
        </form>
        <p className="login-card__security"><LockKeyhole size={13} />Sessão protegida e documentos armazenados com segurança.</p>
      </motion.section>
    </main>
  )
}

export default function LoginPage() {
  const [showOnboarding, setShowOnboarding] = useState(() => localStorage.getItem(onboardingStorageKey) !== '1')
  const completeOnboarding = () => { localStorage.setItem(onboardingStorageKey, '1'); setShowOnboarding(false) }
  return showOnboarding ? <Onboarding onComplete={completeOnboarding} /> : <LoginCard />
}
