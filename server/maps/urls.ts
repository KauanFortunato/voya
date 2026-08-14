export type MappableLocation = {
  title: string
  city: string | null
  address: string | null
  latitude: string | null
  longitude: string | null
}

export function mapDestination(location: MappableLocation) {
  return location.latitude && location.longitude
    ? `${location.latitude},${location.longitude}`
    : [location.address, location.city, location.title].filter(Boolean).join(', ')
}

export function googleMapsSearchUrl(location: MappableLocation) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapDestination(location))}`
}

export function googleMapsDirectionsUrl(location: MappableLocation) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(mapDestination(location))}`
}
