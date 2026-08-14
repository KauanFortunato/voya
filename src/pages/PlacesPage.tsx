import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  AlertCircle,
  Binoculars,
  Bus,
  CarFront,
  Check,
  Clock3,
  Coffee,
  Footprints,
  Landmark,
  List,
  LocateFixed,
  MapPinned,
  Navigation,
  Plus,
  Search,
  ShoppingBag,
  Utensils,
} from 'lucide-react'

import { listNearbyPlaces, listPlaces, updatePlaceStatus, type NearbyPlaceEstimate, type NearbyTravelMode, type Place, type PlaceStatus } from '../api/places'
import IconButton from '../components/IconButton'
import './PlacesPage.css'

const PlacesMap = lazy(() => import('../components/PlacesMap'))
const categories = ['Todos', 'Restaurantes', 'Cafés', 'Atrações', 'Miradouros', 'Mercados'] as const
const nearbyModes = [
  { value: 'WALK', label: 'A pé', Icon: Footprints },
  { value: 'TRANSIT', label: 'Autocarro', Icon: Bus },
  { value: 'DRIVE', label: 'Carro', Icon: CarFront },
] as const
const nearbyCacheKey = 'voya:nearby-places:v1'
const nearbyFreshDurationMs = 10 * 60_000
const nearbyCacheDurationMs = 6 * 60 * 60_000
const nearbyFreshDistanceMeters = 300

type NearbyPlacesCache = {
  location: { latitude: number; longitude: number }
  mode: NearbyTravelMode
  estimates: NearbyPlaceEstimate[]
  attribution: string
  calculatedAt: number
}

function readNearbyCache(): NearbyPlacesCache | null {
  try {
    const parsed = JSON.parse(localStorage.getItem(nearbyCacheKey) ?? 'null') as NearbyPlacesCache | null
    if (!parsed || Date.now() - parsed.calculatedAt > nearbyCacheDurationMs) return null
    if (!['WALK', 'TRANSIT', 'DRIVE'].includes(parsed.mode) || !Array.isArray(parsed.estimates)) return null
    if (!Number.isFinite(parsed.location?.latitude) || !Number.isFinite(parsed.location?.longitude)) return null
    return parsed
  } catch {
    return null
  }
}

function storeNearbyCache(cache: NearbyPlacesCache) {
  try {
    localStorage.setItem(nearbyCacheKey, JSON.stringify({
      ...cache,
      location: {
        latitude: Number(cache.location.latitude.toFixed(3)),
        longitude: Number(cache.location.longitude.toFixed(3)),
      },
    }))
  } catch {
    // The feature still works when browser storage is unavailable.
  }
}

function clearNearbyCache() {
  try { localStorage.removeItem(nearbyCacheKey) } catch { /* Storage can be unavailable in private mode. */ }
}

function distanceBetweenLocations(
  first: { latitude: number; longitude: number },
  second: { latitude: number; longitude: number },
) {
  const radians = (degrees: number) => degrees * Math.PI / 180
  const earthRadiusMeters = 6_371_000
  const latitudeDelta = radians(second.latitude - first.latitude)
  const longitudeDelta = radians(second.longitude - first.longitude)
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(radians(first.latitude)) * Math.cos(radians(second.latitude)) * Math.sin(longitudeDelta / 2) ** 2
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

function formatCacheAge(calculatedAt: number) {
  const minutes = Math.max(0, Math.floor((Date.now() - calculatedAt) / 60_000))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  return `há ${hours} ${hours === 1 ? 'hora' : 'horas'}`
}

const categoryIcons = {
  Restaurantes: Utensils,
  Cafés: Coffee,
  Atrações: Landmark,
  Miradouros: Binoculars,
  Mercados: ShoppingBag,
}

const statusLabels: Record<PlaceStatus, string> = {
  saved: 'Guardado',
  planned: 'Planeado',
  visited: 'Visitado',
}

function MapSkeleton() {
  return (
    <div className="places-map-skeleton" aria-label="A carregar mapa" aria-busy="true">
      <span /><span /><span />
    </div>
  )
}

function PlacesLoading() {
  return (
    <div className="places-loading" aria-label="A carregar lugares" aria-busy="true">
      <span /><span /><span />
    </div>
  )
}

function formatDistance(meters: number) {
  if (meters < 1000) return `${meters} m`
  return `${new Intl.NumberFormat('pt-PT', { maximumFractionDigits: 1 }).format(meters / 1000)} km`
}

function PlaceCard({
  place,
  saving,
  estimate,
  estimateLoading,
  nearbyMode,
  onToggle,
  onShowMap,
}: {
  place: Place
  saving: boolean
  estimate?: NearbyPlaceEstimate
  estimateLoading: boolean
  nearbyMode: NearbyTravelMode
  onToggle: () => void
  onShowMap: () => void
}) {
  const reduceMotion = useReducedMotion()
  const PlaceIcon = categoryIcons[place.category as keyof typeof categoryIcons] ?? MapPinned
  const planned = place.status === 'planned'

  return (
    <article className="place-card">
      <span className="place-card__icon"><PlaceIcon size={21} aria-hidden="true" /></span>
      <div className="place-card__content">
        <div className="place-card__heading">
          <h2>{place.name}</h2>
          <span className={`place-status place-status--${place.status}`}>{statusLabels[place.status]}</span>
        </div>
        <p>{place.category}{place.city ? ` · ${place.city}` : ''}</p>
        {place.address && <address>{place.address}</address>}
      </div>
      <button
        className={`place-card__add${planned ? ' is-planned' : ''}`}
        type="button"
        aria-label={planned ? `Retirar ${place.name} dos planeados` : `Marcar ${place.name} como planeado`}
        aria-pressed={planned}
        aria-busy={saving}
        disabled={saving}
        onClick={onToggle}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={planned ? 'check' : 'plus'}
            initial={reduceMotion ? false : { opacity: 0, scale: 0.9, filter: 'blur(2px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={reduceMotion ? undefined : { opacity: 0, scale: 0.94, filter: 'blur(1px)' }}
            transition={{ type: 'spring', duration: 0.18, bounce: 0 }}
          >
            {planned ? <Check size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
          </motion.span>
        </AnimatePresence>
      </button>
      {estimateLoading && (
        <div className="place-card__route-skeleton" role="status" aria-label={`A calcular o percurso até ${place.name}`}><span /><span /></div>
      )}
      {estimate && (
        <div className="place-card__route">
          <Clock3 size={15} aria-hidden="true" />
          <span><strong>{Math.max(1, Math.ceil(estimate.durationSeconds / 60))} min</strong><small>{formatDistance(estimate.distanceMeters)} desde a sua localização</small></span>
          {nearbyMode === 'WALK' && <em>A rota a pé pode ter limitações.</em>}
        </div>
      )}
      <div className="place-card__actions">
        {place.latitude && place.longitude && (
          <button type="button" onClick={onShowMap}><LocateFixed size={15} aria-hidden="true" />Ver no mapa</button>
        )}
        <a href={place.directionsUrl} target="_blank" rel="noreferrer">
          <Navigation size={15} aria-hidden="true" />Como chegar
        </a>
      </div>
    </article>
  )
}

export default function PlacesPage() {
  const reduceMotion = useReducedMotion()
  const [initialNearbyCache] = useState(readNearbyCache)
  const [places, setPlaces] = useState<Place[]>([])
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [retryCount, setRetryCount] = useState(0)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof categories)[number]>('Todos')
  const [view, setView] = useState<'list' | 'map'>('list')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [savingIds, setSavingIds] = useState<string[]>([])
  const [actionError, setActionError] = useState('')
  const nearbyRequest = useRef<AbortController | null>(null)
  const cacheVerificationStarted = useRef(false)
  const [nearbyEnabled, setNearbyEnabled] = useState(Boolean(initialNearbyCache))
  const [nearbyMode, setNearbyMode] = useState<NearbyTravelMode>(initialNearbyCache?.mode ?? 'WALK')
  const [nearbyState, setNearbyState] = useState<'idle' | 'checking' | 'locating' | 'loading' | 'refreshing' | 'ready' | 'error'>(initialNearbyCache ? 'checking' : 'idle')
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(initialNearbyCache?.location ?? null)
  const [nearbyEstimates, setNearbyEstimates] = useState<NearbyPlaceEstimate[]>(initialNearbyCache?.estimates ?? [])
  const [nearbyError, setNearbyError] = useState('')
  const [nearbyNotice, setNearbyNotice] = useState(initialNearbyCache ? `Resultado atualizado ${formatCacheAge(initialNearbyCache.calculatedAt)}.` : '')
  const [nearbyAttribution, setNearbyAttribution] = useState(initialNearbyCache?.attribution ?? '')
  const [nearbyCalculatedAt, setNearbyCalculatedAt] = useState(initialNearbyCache?.calculatedAt ?? 0)

  useEffect(() => {
    const controller = new AbortController()
    setLoadState('loading')
    listPlaces(controller.signal)
      .then((payload) => {
        setPlaces(payload.places)
        setLoadState('ready')
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setLoadState('error')
      })
    return () => controller.abort()
  }, [retryCount])

  useEffect(() => () => nearbyRequest.current?.abort(), [])

  const estimateByPlaceId = useMemo(
    () => new Map(nearbyEstimates.map((estimate) => [estimate.placeId, estimate])),
    [nearbyEstimates],
  )

  const filteredPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt')
    const matches = places.filter((place) => {
      const matchesCategory = category === 'Todos' || place.category === category
      const searchable = `${place.name} ${place.city ?? ''} ${place.address ?? ''}`.toLocaleLowerCase('pt')
      return matchesCategory && searchable.includes(normalizedQuery)
    })
    if (!nearbyEnabled || !['checking', 'refreshing', 'ready'].includes(nearbyState)) return matches
    return matches.sort((left, right) => {
      const leftEstimate = estimateByPlaceId.get(left.id)
      const rightEstimate = estimateByPlaceId.get(right.id)
      if (!leftEstimate && !rightEstimate) return 0
      if (!leftEstimate) return 1
      if (!rightEstimate) return -1
      return leftEstimate.durationSeconds - rightEstimate.durationSeconds
    })
  }, [category, estimateByPlaceId, nearbyEnabled, nearbyState, places, query])

  useEffect(() => {
    if (selectedId && !filteredPlaces.some((place) => place.id === selectedId)) setSelectedId(null)
  }, [filteredPlaces, selectedId])

  const selectedPlace = filteredPlaces.find((place) => place.id === selectedId) ?? null
  const selectedEstimate = selectedPlace ? estimateByPlaceId.get(selectedPlace.id) : undefined

  const loadNearby = async (
    location: { latitude: number; longitude: number },
    mode: NearbyTravelMode,
    preserveExisting = false,
    notice = '',
  ) => {
    nearbyRequest.current?.abort()
    const controller = new AbortController()
    nearbyRequest.current = controller
    const keepCurrentResults = preserveExisting && nearbyEstimates.length > 0
    setNearbyState(keepCurrentResults ? 'refreshing' : 'loading')
    setNearbyError('')
    setNearbyNotice(notice)
    if (!keepCurrentResults) setNearbyEstimates([])
    try {
      const payload = await listNearbyPlaces(location, mode, controller.signal)
      const calculatedAt = Date.now()
      setNearbyEstimates(payload.estimates)
      setNearbyAttribution(payload.attribution)
      setNearbyCalculatedAt(calculatedAt)
      setNearbyNotice(`Atualizado ${formatCacheAge(calculatedAt)}.`)
      setNearbyState('ready')
      storeNearbyCache({ location, mode, estimates: payload.estimates, attribution: payload.attribution, calculatedAt })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      const message = error instanceof Error ? error.message : 'Não foi possível calcular os lugares próximos'
      if (keepCurrentResults) {
        setNearbyNotice(`${message} A mostrar o resultado anterior.`)
        setNearbyState('ready')
      } else {
        setNearbyError(message)
        setNearbyState('error')
      }
    }
  }
  const loadNearbyRef = useRef(loadNearby)
  loadNearbyRef.current = loadNearby

  const locateAndLoad = (preserveExisting = nearbyEstimates.length > 0) => {
    setNearbyState(preserveExisting ? 'checking' : 'locating')
    setNearbyError('')
    setNearbyNotice(preserveExisting ? 'A confirmar a sua localização…' : '')
    if (!preserveExisting) setNearbyEstimates([])
    if (!window.isSecureContext) {
      if (preserveExisting) {
        setNearbyNotice('Resultado anterior. Abra o Voya por HTTPS para atualizar a localização.')
        setNearbyState('ready')
      } else {
        setNearbyError('A localização exige que o Voya seja aberto por HTTPS.')
        setNearbyState('error')
      }
      return
    }
    if (!navigator.geolocation) {
      if (preserveExisting) {
        setNearbyNotice('Resultado anterior. Este navegador não permite atualizar a localização.')
        setNearbyState('ready')
      } else {
        setNearbyError('Este navegador não permite obter a sua localização.')
        setNearbyState('error')
      }
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = { latitude: coords.latitude, longitude: coords.longitude }
        setCurrentLocation(location)
        void loadNearby(location, nearbyMode, preserveExisting, preserveExisting ? 'A atualizar os percursos…' : '')
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Autorize o acesso à localização para ordenar os lugares mais próximos.'
          : 'Não foi possível obter a sua localização agora.'
        if (preserveExisting) {
          setNearbyNotice(`${message} A mostrar o resultado anterior.`)
          setNearbyState('ready')
        } else {
          setNearbyError(message)
          setNearbyState('error')
        }
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    )
  }

  useEffect(() => {
    if (!initialNearbyCache || cacheVerificationStarted.current) return
    cacheVerificationStarted.current = true
    if (!window.isSecureContext || !navigator.geolocation) {
      setNearbyNotice(`Resultado atualizado ${formatCacheAge(initialNearbyCache.calculatedAt)}. Toque em Atualizar quando a localização estiver disponível.`)
      setNearbyState('ready')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = { latitude: coords.latitude, longitude: coords.longitude }
        const distance = distanceBetweenLocations(initialNearbyCache.location, location)
        const age = Date.now() - initialNearbyCache.calculatedAt
        setCurrentLocation(location)
        if (distance <= nearbyFreshDistanceMeters && age <= nearbyFreshDurationMs) {
          setNearbyNotice(`Atualizado ${formatCacheAge(initialNearbyCache.calculatedAt)} · localização praticamente igual.`)
          setNearbyState('ready')
          return
        }
        const reason = distance > nearbyFreshDistanceMeters
          ? `Está a cerca de ${formatDistance(Math.round(distance))} da última localização. A atualizar…`
          : `Resultado com mais de 10 minutos. A atualizar…`
        void loadNearbyRef.current(location, initialNearbyCache.mode, true, reason)
      },
      () => {
        setNearbyNotice(`Resultado atualizado ${formatCacheAge(initialNearbyCache.calculatedAt)}. Não foi possível confirmar a localização.`)
        setNearbyState('ready')
      },
      { enableHighAccuracy: false, timeout: 8_000, maximumAge: 60_000 },
    )
  }, [initialNearbyCache])

  const toggleNearby = () => {
    if (nearbyEnabled) {
      nearbyRequest.current?.abort()
      setNearbyEnabled(false)
      setNearbyState('idle')
      setNearbyEstimates([])
      setNearbyError('')
      setNearbyNotice('')
      setNearbyAttribution('')
      setNearbyCalculatedAt(0)
      clearNearbyCache()
      return
    }
    setNearbyEnabled(true)
    setView('list')
    locateAndLoad(false)
  }

  const selectNearbyMode = (mode: NearbyTravelMode) => {
    if (mode === nearbyMode) return
    setNearbyMode(mode)
    if (currentLocation) void loadNearby(currentLocation, mode)
  }

  const togglePlace = async (place: Place) => {
    if (savingIds.includes(place.id)) return
    const previousStatus = place.status
    const status: PlaceStatus = previousStatus === 'planned' ? 'saved' : 'planned'
    setActionError('')
    setSavingIds((current) => [...current, place.id])
    setPlaces((current) => current.map((item) => item.id === place.id ? { ...item, status } : item))
    try {
      const saved = await updatePlaceStatus(place.id, status)
      setPlaces((current) => current.map((item) => item.id === place.id ? { ...item, status: saved.status } : item))
    } catch (error) {
      setPlaces((current) => current.map((item) => item.id === place.id ? { ...item, status: previousStatus } : item))
      setActionError(error instanceof Error ? error.message : 'Não foi possível atualizar o lugar')
    } finally {
      setSavingIds((current) => current.filter((id) => id !== place.id))
    }
  }

  const showOnMap = (placeId: string) => {
    setSelectedId(placeId)
    setView('map')
  }

  const clearFilters = () => {
    setQuery('')
    setCategory('Todos')
  }

  return (
    <main className="places-page" id="main-content" aria-busy={loadState === 'loading'}>
      <header className="places-header">
        <div>
          <p>Ideias para a viagem</p>
          <h1>Lugares</h1>
        </div>
        <IconButton
          icon={view === 'list' ? MapPinned : List}
          ariaLabel={view === 'list' ? 'Ver lugares no mapa' : 'Ver lugares em lista'}
          onClick={() => setView((current) => current === 'list' ? 'map' : 'list')}
        />
      </header>

      <div className="places-search-row">
        <label className="places-search">
          <Search size={19} aria-hidden="true" />
          <span className="places-visually-hidden">Pesquisar lugares</span>
          <input
            type="search"
            value={query}
            placeholder="Pesquisar lugares"
            disabled={loadState !== 'ready'}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button className={`places-nearby-button${nearbyEnabled ? ' is-active' : ''}`} type="button" aria-pressed={nearbyEnabled} disabled={loadState !== 'ready'} onClick={toggleNearby}>
          <LocateFixed size={18} aria-hidden="true" /><span>Mais próximos</span>
        </button>
      </div>

      {nearbyEnabled && (
        <section className="places-nearby" aria-label="Ordenar por tempo desde a sua localização" aria-busy={['checking', 'locating', 'loading', 'refreshing'].includes(nearbyState)}>
          <div className="places-nearby__modes" aria-label="Modo de deslocamento">
            {nearbyModes.map(({ value, label, Icon }) => <button className={nearbyMode === value ? 'is-active' : ''} type="button" aria-pressed={nearbyMode === value} disabled={nearbyState === 'checking' || nearbyState === 'locating'} onClick={() => selectNearbyMode(value)} key={value}><Icon size={15} aria-hidden="true" />{label}</button>)}
          </div>
          {(nearbyState === 'locating' || nearbyState === 'loading') && <p role="status">{nearbyState === 'locating' ? 'A obter a sua localização…' : 'A calcular os percursos mais rápidos…'}</p>}
          {(nearbyState === 'checking' || nearbyState === 'refreshing') && <p role="status">{nearbyNotice}</p>}
          {nearbyState === 'ready' && <><div className="places-nearby__status"><p>{nearbyNotice || `Atualizado ${formatCacheAge(nearbyCalculatedAt)}.`}</p><button type="button" onClick={() => locateAndLoad(true)}>Atualizar</button></div><small>{nearbyEstimates.length} lugares ordenados · localização não guardada no banco</small></>}
          {nearbyState === 'error' && <div className="places-nearby__error" role="alert"><span>{nearbyError}</span><button type="button" onClick={() => locateAndLoad(nearbyEstimates.length > 0)}>Tentar novamente</button></div>}
        </section>
      )}

      <div className="place-filters" aria-label="Filtrar lugares por categoria">
        {categories.map((item) => (
          <button
            className={category === item ? 'is-active' : ''}
            key={item}
            type="button"
            aria-pressed={category === item}
            disabled={loadState !== 'ready'}
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <div className="places-view-switch" aria-label="Modo de visualização">
        <button className={view === 'list' ? 'is-active' : ''} type="button" aria-pressed={view === 'list'} onClick={() => setView('list')}><List size={16} />Lista</button>
        <button className={view === 'map' ? 'is-active' : ''} type="button" aria-pressed={view === 'map'} onClick={() => setView('map')}><MapPinned size={16} />Mapa</button>
      </div>

      {actionError && <p className="places-action-error" role="alert">{actionError}</p>}

      {loadState === 'loading' && <PlacesLoading />}
      {loadState === 'error' && (
        <section className="places-error" role="alert">
          <AlertCircle size={25} aria-hidden="true" />
          <h2>Não foi possível carregar os lugares</h2>
          <p>Verifique a ligação e tente novamente.</p>
          <button type="button" onClick={() => setRetryCount((count) => count + 1)}>Tentar novamente</button>
        </section>
      )}

      {loadState === 'ready' && (
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={view}
            className={view === 'list' ? 'place-list' : 'places-map-view'}
            initial={reduceMotion ? false : { opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -2 }}
            transition={{ type: 'spring', duration: 0.2, bounce: 0 }}
            aria-live="polite"
            aria-label={`${filteredPlaces.length} lugares encontrados`}
          >
            {view === 'list' ? (
              <>
                {filteredPlaces.map((place) => (
                  <PlaceCard
                    place={place}
                    saving={savingIds.includes(place.id)}
                    estimate={estimateByPlaceId.get(place.id)}
                    estimateLoading={nearbyEnabled && nearbyEstimates.length === 0 && (nearbyState === 'locating' || nearbyState === 'loading')}
                    nearbyMode={nearbyMode}
                    onToggle={() => void togglePlace(place)}
                    onShowMap={() => showOnMap(place.id)}
                    key={place.id}
                  />
                ))}
              </>
            ) : filteredPlaces.length > 0 ? (
              <>
                <Suspense fallback={<MapSkeleton />}>
                  <PlacesMap places={filteredPlaces} selectedId={selectedId} onSelect={setSelectedId} />
                </Suspense>
                {selectedPlace && (
                  <article className="map-place-preview">
                    <div><span>{selectedPlace.category}{selectedPlace.city ? ` · ${selectedPlace.city}` : ''}</span><h2>{selectedPlace.name}</h2><p>{selectedEstimate ? `${Math.max(1, Math.ceil(selectedEstimate.durationSeconds / 60))} min · ${formatDistance(selectedEstimate.distanceMeters)}` : selectedPlace.address}</p></div>
                    <a href={selectedPlace.directionsUrl} target="_blank" rel="noreferrer"><Navigation size={16} />Traçar rota</a>
                  </article>
                )}
                <p className="places-map-note">Toque num marcador para ver o lugar. O mapa requer ligação à internet.</p>
              </>
            ) : null}

            {filteredPlaces.length === 0 && (
              <div className="places-empty">
                <span><MapPinned size={25} aria-hidden="true" /></span>
                <h2>Nenhum lugar encontrado</h2>
                <p>Altere a pesquisa ou escolha outra categoria.</p>
                <button type="button" onClick={clearFilters}>Limpar filtros</button>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      )}
      {nearbyEnabled && nearbyAttribution && <p className="places-google-attribution">{nearbyAttribution}</p>}
    </main>
  )
}
