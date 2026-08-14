import { lazy, Suspense, useEffect, useLayoutEffect, useRef } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
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
import { AuthProvider } from './auth/AuthContext'
import { useAuth } from './auth/auth'
import TodayPage from './pages/TodayPage'
import './App.css'

const primaryRouteLoaders = {
  '/itinerary': () => import('./pages/ItineraryPage'),
  '/places': () => import('./pages/PlacesPage'),
  '/more': () => import('./pages/MorePage'),
} as const

const ItineraryPage = lazy(primaryRouteLoaders['/itinerary'])
const PlacesPage = lazy(primaryRouteLoaders['/places'])
const MorePage = lazy(primaryRouteLoaders['/more'])
const OverviewPage = lazy(() => import('./pages/OverviewPage'))
const ChecklistPage = lazy(() => import('./pages/ChecklistPage'))
const DocumentsPage = lazy(() => import('./pages/DocumentsPage'))
const TravelersPage = lazy(() => import('./pages/TravelersPage'))
const BudgetPage = lazy(() => import('./pages/BudgetPage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))
const LoginPage = lazy(() => import('./pages/LoginPage'))

const navigation = [
  { to: '/today', label: 'Hoje', icon: House },
  { to: '/itinerary', label: 'Roteiro', icon: RouteIcon },
  { to: '/places', label: 'Lugares', icon: MapPinned },
  { to: '/more', label: 'Mais', icon: MoreHorizontal },
]

const primaryPaths = new Set(navigation.map(({ to }) => to))
const scrollPositions = new Map<string, number>()

function ScrollPositionManager() {
  const { pathname } = useLocation()
  const previousPathname = useRef(pathname)

  useEffect(() => {
    const previousRestoration = window.history.scrollRestoration
    window.history.scrollRestoration = 'manual'

    return () => {
      window.history.scrollRestoration = previousRestoration
    }
  }, [])

  useLayoutEffect(() => {
    const previousPath = previousPathname.current
    if (previousPath === pathname) return

    if (primaryPaths.has(previousPath)) {
      scrollPositions.set(previousPath, window.scrollY)
    }
    const targetPosition = primaryPaths.has(pathname)
      ? (scrollPositions.get(pathname) ?? 0)
      : 0
    window.scrollTo({ top: targetPosition, behavior: 'auto' })
    previousPathname.current = pathname
  }, [pathname])

  return null
}

function BottomNavigation() {
  const preloadRoute = (path: string) => {
    if (path in primaryRouteLoaders) {
      void primaryRouteLoaders[path as keyof typeof primaryRouteLoaders]()
    }
  }

  return (
    <nav className="bottom-navigation" aria-label="Navegação principal">
      {navigation.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `bottom-navigation__item${isActive ? ' is-active' : ''}`
          }
          onFocus={() => preloadRoute(to)}
          onPointerEnter={() => preloadRoute(to)}
          onPointerDown={() => preloadRoute(to)}
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
    <AnimatePresence mode="popLayout" initial={false}>
      <motion.div
        className="route-stage"
        key={location.pathname}
        initial={reduceMotion ? false : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        exit={reduceMotion ? undefined : { opacity: 0, y: -2 }}
        transition={{ type: 'spring', duration: 0.16, bounce: 0 }}
      >
        <Suspense fallback={<ScreenSkeleton />}>
          <Routes location={location}>
            <Route path="/" element={<Navigate to="/today" replace />} />
            <Route path="/today" element={<TodayPage />} />
            <Route path="/calendar" element={<Navigate to="/itinerary" replace />} />
            <Route path="/itinerary" element={<ItineraryPage />} />
            <Route path="/places" element={<PlacesPage />} />
            <Route path="/more" element={<MorePage />} />
            <Route path="/more/overview" element={<OverviewPage />} />
            <Route path="/more/checklist" element={<ChecklistPage />} />
            <Route path="/more/documents" element={<DocumentsPage />} />
            <Route path="/more/budget" element={<BudgetPage />} />
            <Route path="/more/travelers" element={<TravelersPage />} />
            <Route path="/more/settings" element={<SettingsPage />} />
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

function AuthenticatedApp() {
  const { status } = useAuth()

  if (status === 'loading') return <div className="app-shell"><ScreenSkeleton /></div>
  if (status === 'anonymous') {
    return <Suspense fallback={<div className="app-shell"><ScreenSkeleton /></div>}><LoginPage /></Suspense>
  }

  return (
    <HashRouter>
      <AppShell />
    </HashRouter>
  )
}

function App() {
  return <AuthProvider><AuthenticatedApp /></AuthProvider>
}

export default App
