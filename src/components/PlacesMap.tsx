import { useEffect, useMemo, useState } from 'react'
import { divIcon, latLngBounds, type LatLngExpression } from 'leaflet'
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from 'react-leaflet'
import { useReducedMotion } from 'motion/react'
import { AlertCircle } from 'lucide-react'

import type { Place } from '../api/places'
import 'leaflet/dist/leaflet.css'
import './PlacesMap.css'

const defaultCenter: LatLngExpression = [42.5, 12.5]
const tileUrl = import.meta.env.VITE_MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
const tileAttribution = import.meta.env.VITE_MAP_ATTRIBUTION
  || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'

type MappedPlace = Place & { position: [number, number] }

function MapViewport({ places, selectedId }: { places: MappedPlace[]; selectedId: string | null }) {
  const map = useMap()
  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const selected = places.find((place) => place.id === selectedId)
    if (selected) {
      map.setView(selected.position, Math.max(map.getZoom(), 15), { animate: !reduceMotion })
      return
    }
    if (places.length === 1) {
      map.setView(places[0].position, 15, { animate: !reduceMotion })
      return
    }
    if (places.length > 1) {
      map.fitBounds(latLngBounds(places.map((place) => place.position)), {
        animate: !reduceMotion,
        padding: [32, 32],
        maxZoom: 14,
      })
    }
  }, [map, places, reduceMotion, selectedId])

  return null
}

function markerIcon(place: MappedPlace, selected: boolean) {
  return divIcon({
    className: `voya-map-marker voya-map-marker--${place.status}${selected ? ' is-selected' : ''}`,
    html: '<span></span>',
    iconSize: selected ? [38, 38] : [32, 32],
    iconAnchor: selected ? [19, 19] : [16, 16],
  })
}

export default function PlacesMap({
  places,
  selectedId,
  onSelect,
}: {
  places: Place[]
  selectedId: string | null
  onSelect: (placeId: string) => void
}) {
  const reduceMotion = useReducedMotion()
  const [tileState, setTileState] = useState<'loading' | 'ready' | 'error'>('loading')
  const mappedPlaces = useMemo(() => places.flatMap((place): MappedPlace[] => {
    const latitude = Number(place.latitude)
    const longitude = Number(place.longitude)
    return Number.isFinite(latitude) && Number.isFinite(longitude)
      ? [{ ...place, position: [latitude, longitude] }]
      : []
  }), [places])

  if (mappedPlaces.length === 0) {
    return (
      <div className="places-map-empty">
        <AlertCircle aria-hidden="true" size={23} />
        <strong>Sem coordenadas para mostrar</strong>
        <p>Estes lugares continuam disponíveis na lista e podem ser abertos no Maps.</p>
      </div>
    )
  }

  return (
    <div className="places-map-shell" aria-label={`Mapa com ${mappedPlaces.length} lugares`}>
      <MapContainer
        center={defaultCenter}
        zoom={6}
        minZoom={4}
        maxZoom={18}
        scrollWheelZoom={false}
        zoomAnimation={!reduceMotion}
        fadeAnimation={!reduceMotion}
        markerZoomAnimation={!reduceMotion}
        className="places-map"
      >
        <TileLayer
          attribution={tileAttribution}
          url={tileUrl}
          eventHandlers={{
            load: () => setTileState((current) => current === 'error' ? current : 'ready'),
            tileerror: () => setTileState('error'),
          }}
        />
        <MapViewport places={mappedPlaces} selectedId={selectedId} />
        {mappedPlaces.map((place) => (
          <Marker
            key={place.id}
            position={place.position}
            icon={markerIcon(place, place.id === selectedId)}
            alt={`Localizar ${place.name}`}
            title={place.name}
            riseOnHover
            eventHandlers={{ click: () => onSelect(place.id) }}
          >
            <Tooltip direction="top" offset={[0, -15]}>{place.name}</Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {tileState === 'loading' && <div className="places-map-status" role="status">A carregar mapa…</div>}
      {tileState === 'error' && (
        <div className="places-map-status places-map-status--error" role="alert">
          O mapa não carregou por completo. Use a lista ou abra o lugar no Maps.
        </div>
      )}
    </div>
  )
}
