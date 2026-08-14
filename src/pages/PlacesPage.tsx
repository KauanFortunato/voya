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
  const [nearbyEnabled, setNearbyEnabled] = useState(false)
  const [nearbyMode, setNearbyMode] = useState<NearbyTravelMode>('WALK')
  const [nearbyState, setNearbyState] = useState<'idle' | 'locating' | 'loading' | 'ready' | 'error'>('idle')
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [nearbyEstimates, setNearbyEstimates] = useState<NearbyPlaceEstimate[]>([])
  const [nearbyError, setNearbyError] = useState('')
  const [nearbyAttribution, setNearbyAttribution] = useState('')

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
    if (!nearbyEnabled || nearbyState !== 'ready') return matches
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

  const loadNearby = async (location: { latitude: number; longitude: number }, mode: NearbyTravelMode) => {
    nearbyRequest.current?.abort()
    const controller = new AbortController()
    nearbyRequest.current = controller
    setNearbyState('loading')
    setNearbyError('')
    setNearbyEstimates([])
    try {
      const payload = await listNearbyPlaces(location, mode, controller.signal)
      setNearbyEstimates(payload.estimates)
      setNearbyAttribution(payload.attribution)
      setNearbyState('ready')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setNearbyError(error instanceof Error ? error.message : 'Não foi possível calcular os lugares próximos')
      setNearbyState('error')
    }
  }

  const locateAndLoad = () => {
    setNearbyState('locating')
    setNearbyError('')
    setNearbyEstimates([])
    if (!window.isSecureContext) {
      setNearbyError('A localização exige que o Voya seja aberto por HTTPS.')
      setNearbyState('error')
      return
    }
    if (!navigator.geolocation) {
      setNearbyError('Este navegador não permite obter a sua localização.')
      setNearbyState('error')
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const location = { latitude: coords.latitude, longitude: coords.longitude }
        setCurrentLocation(location)
        void loadNearby(location, nearbyMode)
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Autorize o acesso à localização para ordenar os lugares mais próximos.'
          : 'Não foi possível obter a sua localização agora.'
        setNearbyError(message)
        setNearbyState('error')
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 60_000 },
    )
  }

  const toggleNearby = () => {
    if (nearbyEnabled) {
      nearbyRequest.current?.abort()
      setNearbyEnabled(false)
      setNearbyState('idle')
      setNearbyEstimates([])
      setNearbyError('')
      return
    }
    setNearbyEnabled(true)
    setView('list')
    locateAndLoad()
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

      <section className="places-explainer" aria-label="Como usar Lugares">
        <div>
          <strong>Guarde primeiro, organize depois</strong>
          <p>Veja a família de lugares no mapa e abra a rota quando for hora de sair.</p>
        </div>
        <span>{places.length} guardados</span>
      </section>

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
        <section className="places-nearby" aria-label="Ordenar por tempo desde a sua localização" aria-busy={nearbyState === 'locating' || nearbyState === 'loading'}>
          <div className="places-nearby__modes" aria-label="Modo de deslocamento">
            {nearbyModes.map(({ value, label, Icon }) => <button className={nearbyMode === value ? 'is-active' : ''} type="button" aria-pressed={nearbyMode === value} disabled={nearbyState === 'locating'} onClick={() => selectNearbyMode(value)} key={value}><Icon size={15} aria-hidden="true" />{label}</button>)}
          </div>
          {(nearbyState === 'locating' || nearbyState === 'loading') && <p role="status">{nearbyState === 'locating' ? 'A obter a sua localização…' : 'A calcular os percursos mais rápidos…'}</p>}
          {nearbyState === 'ready' && <p>{nearbyEstimates.length} lugares ordenados pelo tempo de percurso. A localização não é guardada no banco.</p>}
          {nearbyState === 'error' && <div className="places-nearby__error" role="alert"><span>{nearbyError}</span><button type="button" onClick={() => currentLocation ? void loadNearby(currentLocation, nearbyMode) : locateAndLoad()}>Tentar novamente</button></div>}
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
            initial={reduceMotion ? false : { opacity: 0, y: 5, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -2, filter: 'blur(1px)' }}
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
                    estimateLoading={nearbyEnabled && (nearbyState === 'locating' || nearbyState === 'loading')}
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
      {nearbyEnabled && nearbyState === 'ready' && nearbyAttribution && <p className="places-google-attribution">{nearbyAttribution}</p>}
    </main>
  )
}
