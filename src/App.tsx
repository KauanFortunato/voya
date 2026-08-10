import { lazy, Suspense, useEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  CalendarDays,
  House,
  MapPinned,
  MoreHorizontal,
  Route as RouteIcon,
} from 'lucide-react'
import {
  HashRouter,
  Navigate,
  NavLink,
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'

import ScreenSkeleton from './components/ScreenSkeleton'
import './App.css'

const TodayPage = lazy(() => import('./pages/TodayPage'))
const CalendarPage = lazy(() => import('./pages/CalendarPage'))
const ItineraryPage = lazy(() => import('./pages/ItineraryPage'))
const PlacesPage = lazy(() => import('./pages/PlacesPage'))
const MorePage = lazy(() => import('./pages/MorePage'))
const OverviewPage = lazy(() => import('./pages/OverviewPage'))
const ChecklistPage = lazy(() => import('./pages/ChecklistPage'))
const SectionPage = lazy(() => import('./pages/SectionPage'))

const navigation = [
  { to: '/today', label: 'Hoje', icon: House },
  { to: '/calendar', label: 'Calendário', icon: CalendarDays },
  { to: '/itinerary', label: 'Roteiro', icon: RouteIcon },
  { to: '/places', label: 'Lugares', icon: MapPinned },
  { to: '/more', label: 'Mais', icon: MoreHorizontal },
]

const primaryPaths = new Set(navigation.map(({ to }) => to))
const scrollPositions = new Map<string, number>()

function ScrollPositionManager() {
  const { pathname } = useLocation()

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    return () => {
      window.history.scrollRestoration = previousRestoration
    }
  }, [])

  useEffect(() => {
    const targetPosition = primaryPaths.has(pathname)
      ? (scrollPositions.get(pathname) ?? 0)
      : 0
    const restorePosition = () => window.scrollTo({ top: targetPosition, behavior: 'auto' })

    restorePosition()
    const afterTransition = window.setTimeout(restorePosition, 320)

    return () => {
      window.clearTimeout(afterTransition)
      if (primaryPaths.has(pathname)) scrollPositions.set(pathname, window.scrollY)
    }
  }, [pathname])

  return null
}

function BottomNavigation() {
  return (
    <nav className="bottom-navigation" aria-label="Navegação principal">
      {navigation.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `bottom-navigation__item${isActive ? ' is-active' : ''}`
          }
        >
          <Icon aria-hidden="true" size={21} strokeWidth={1.9} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function AnimatedRoutes() {
  const location = useLocation()
  const reduceMotion = useReducedMotion()

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        className="route-stage"
        key={location.pathname}
        initial={reduceMotion ? false : { opacity: 0, y: 8, filter: 'blur(3px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -4, filter: 'blur(2px)' }}
        transition={{ type: 'spring', duration: 0.28, bounce: 0 }}
      >
        <Suspense fallback={<ScreenSkeleton />}>
          <Routes location={location}>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/itinerary" element={<ItineraryPage />} />
            <Route path="/places" element={<PlacesPage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/more/overview" element={<OverviewPage />} />
            <Route path="/more/checklist" element={<ChecklistPage />} />
            <Route path="/more/documents" element={<SectionPage kicker="Reservas e bilhetes" title="Documentos" />} />
            <Route path="/more/budget" element={<SectionPage kicker="4 viajantes · 7 dias" title="Orçamento" />} />
            <Route path="/more/travelers" element={<SectionPage kicker="Família Fortunato" title="Viajantes" />} />
            <Route path="/more/settings" element={<SectionPage kicker="Voya" title="Configurações" />} />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

function AppShell() {
  const { pathname } = useLocation()
  const isMoreSubpage = pathname.startsWith('/more/')

  return (
    <div className={`app-shell${isMoreSubpage ? ' has-subpage' : ''}`}>
      <a className="skip-link" href="#main-content">
        Ir para o conteúdo
      </a>
      <ScrollPositionManager />
      <AnimatedRoutes />
      {!isMoreSubpage && <BottomNavigation />}
    </div>
  )
}

function App() {
  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}

export default App
