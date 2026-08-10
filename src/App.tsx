import { lazy, Suspense } from 'react'
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
const SectionPage = lazy(() => import('./pages/SectionPage'))

const navigation = [
  { to: '/today', label: 'Hoje', icon: House },
  { to: '/calendar', label: 'Calendário', icon: CalendarDays },
  { to: '/itinerary', label: 'Roteiro', icon: RouteIcon },
  { to: '/places', label: 'Lugares', icon: MapPinned },
  { to: '/more', label: 'Mais', icon: MoreHorizontal },
]

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
            <Route
              path="/places"
              element={<SectionPage kicker="Lugares da família" title="Lugares" />}
            />
            <Route
              path="/more"
              element={<SectionPage kicker="Voya" title="Mais" />}
            />
            <Route path="*" element={<Navigate to="/today" replace />} />
          </Routes>
        </Suspense>
      </motion.div>
    </AnimatePresence>
  )
}

function App() {
  return (
    <HashRouter>
      <div className="app-shell">
        <a className="skip-link" href="#main-content">
          Ir para o conteúdo
        </a>
        <AnimatedRoutes />
        <BottomNavigation />
      </div>
    </HashRouter>
  )
}

export default App
