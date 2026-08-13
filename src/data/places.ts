export type PlaceStatus = 'Guardado' | 'Planeado' | 'Visitado'

export type Place = {
  id: string
  name: string
  category: string
  city: string
  address: string
  status: PlaceStatus
}

export const places: Place[] = [
  { id: 'roscioli', name: 'Roscioli', category: 'Restaurantes', city: 'Roma', address: 'Via dei Giubbonari, 21', status: 'Planeado' },
  { id: 'gianicolo', name: 'Terrazza del Gianicolo', category: 'Miradouros', city: 'Roma', address: 'Piazzale Giuseppe Garibaldi', status: 'Guardado' },
  { id: 'cannaregio-coffee', name: 'Torrefazione Cannaregio', category: 'Cafés', city: 'Veneza', address: 'Fondamenta dei Ormesini', status: 'Guardado' },
  { id: 'guggenheim', name: 'Peggy Guggenheim', category: 'Atrações', city: 'Veneza', address: 'Dorsoduro, 701', status: 'Planeado' },
  { id: 'rialto', name: 'Mercato di Rialto', category: 'Mercados', city: 'Veneza', address: 'Campo de la Pescaria', status: 'Visitado' },
  { id: 'sant-eustachio', name: "Sant'Eustachio Il Caffè", category: 'Cafés', city: 'Roma', address: 'Piazza di S. Eustachio, 82', status: 'Planeado' },
]
