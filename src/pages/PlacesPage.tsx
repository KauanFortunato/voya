import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  AlertCircle,
  Binoculars,
  Check,
  Coffee,
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

import { listPlaces, updatePlaceStatus, type Place, type PlaceStatus } from '../api/places'
import IconButton from '../components/IconButton'
import './PlacesPage.css'

const PlacesMap = lazy(() => import('../components/PlacesMap'))
const categories = ['Todos', 'Restaurantes', 'Cafés', 'Atrações', 'Miradouros', 'Mercados'] as const

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

function PlaceCard({
  place,
  saving,
  onToggle,
  onShowMap,
}: {
  place: Place
  saving: boolean
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

  const filteredPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt')
    return places.filter((place) => {
      const matchesCategory = category === 'Todos' || place.category === category
      const searchable = `${place.name} ${place.city ?? ''} ${place.address ?? ''}`.toLocaleLowerCase('pt')
      return matchesCategory && searchable.includes(normalizedQuery)
    })
  }, [category, places, query])

  useEffect(() => {
    if (selectedId && !filteredPlaces.some((place) => place.id === selectedId)) setSelectedId(null)
  }, [filteredPlaces, selectedId])

  const selectedPlace = filteredPlaces.find((place) => place.id === selectedId) ?? null

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

      <label className="places-search">
        <Search size={19} aria-hidden="true" />
        <span className="places-visually-hidden">Pesquisar lugares</span>
        <input
          type="search"
          value={query}
          placeholder="Pesquisar nome, cidade ou morada"
          disabled={loadState !== 'ready'}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>

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
                    <div><span>{selectedPlace.category}{selectedPlace.city ? ` · ${selectedPlace.city}` : ''}</span><h2>{selectedPlace.name}</h2><p>{selectedPlace.address}</p></div>
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
    </main>
  )
}
