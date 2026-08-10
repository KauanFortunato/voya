import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  Binoculars,
  Check,
  Coffee,
  Landmark,
  MapPin,
  Plus,
  Search,
  ShoppingBag,
  Utensils,
} from 'lucide-react'

import IconButton from '../components/IconButton'
import { places, type Place } from '../data/places'
import './PlacesPage.css'

const categories = ['Todos', 'Restaurantes', 'Cafés', 'Atrações', 'Miradouros'] as const

const categoryIcons = {
  Restaurantes: Utensils,
  Cafés: Coffee,
  Atrações: Landmark,
  Miradouros: Binoculars,
  Mercados: ShoppingBag,
}

function PlaceCard({ place, planned, onToggle }: { place: Place; planned: boolean; onToggle: () => void }) {
  const reduceMotion = useReducedMotion()
  const PlaceIcon = categoryIcons[place.category as keyof typeof categoryIcons] ?? MapPin

  return (
    <article className="place-card">
      <span className="place-card__icon"><PlaceIcon size={21} aria-hidden="true" /></span>
      <div className="place-card__content">
        <div className="place-card__heading">
          <h2>{place.name}</h2>
          <span className={`place-status place-status--${place.status.toLowerCase()}`}>{place.status}</span>
        </div>
        <p>{place.category} · {place.city}</p>
        <address>{place.address}</address>
      </div>
      <button
        className={`place-card__add${planned ? ' is-planned' : ''}`}
        type="button"
        aria-label={planned ? `Remover ${place.name} do roteiro` : `Adicionar ${place.name} ao roteiro`}
        aria-pressed={planned}
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
    </article>
  )
}

export default function PlacesPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<(typeof categories)[number]>('Todos')
  const [plannedIds, setPlannedIds] = useState(() =>
    places.filter((place) => place.status === 'Planeado').map((place) => place.id),
  )

  const filteredPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt')
    return places.filter((place) => {
      const matchesCategory = category === 'Todos' || place.category === category
      const searchable = `${place.name} ${place.city} ${place.address}`.toLocaleLowerCase('pt')
      return matchesCategory && searchable.includes(normalizedQuery)
    })
  }, [category, query])

  const togglePlace = (id: string) => {
    setPlannedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    )
  }

  const clearFilters = () => {
    setQuery('')
    setCategory('Todos')
  }

  return (
    <main className="places-page" id="main-content">
      <header className="places-header">
        <div>
          <p>Ideias para a viagem</p>
          <h1>Lugares</h1>
        </div>
        <IconButton icon={Plus} ariaLabel="Adicionar lugar" />
      </header>

      <section className="places-explainer" aria-label="Como usar Lugares">
        <div>
          <strong>Guarde primeiro, organize depois</strong>
          <p>Reúna ideias da família aqui e use o botão + para levar um lugar ao roteiro.</p>
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
            onClick={() => setCategory(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <section className="place-list" aria-live="polite" aria-label={`${filteredPlaces.length} lugares encontrados`}>
        {filteredPlaces.map((place) => (
          <PlaceCard
            place={place}
            planned={plannedIds.includes(place.id)}
            onToggle={() => togglePlace(place.id)}
            key={place.id}
          />
        ))}

        {filteredPlaces.length === 0 && (
          <div className="places-empty">
            <span><MapPin size={25} aria-hidden="true" /></span>
            <h2>Nenhum lugar encontrado</h2>
            <p>Altere a pesquisa ou escolha outra categoria.</p>
            <button type="button" onClick={clearFilters}>Limpar filtros</button>
          </div>
        )}
      </section>
    </main>
  )
}
