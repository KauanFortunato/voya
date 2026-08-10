export type TravelerId = 'kauan' | 'kairon' | 'helieny' | 'anicio'

export type DocumentCategory =
  | 'Voo'
  | 'Hospedagem'
  | 'Transporte'
  | 'Ingresso'
  | 'Seguro'
  | 'Outro'

export type DocumentStatus = 'Confirmado' | 'Atenção' | 'Rascunho'

export type TripDocument = {
  id: string
  title: string
  category: DocumentCategory
  dateLabel: string
  bookingCode?: string
  status: DocumentStatus
  travelerIds: TravelerId[]
  fileName?: string
  localFile?: File
}

export const travelers: Record<TravelerId, { name: string; initials: string }> = {
  kauan: { name: 'Kauan', initials: 'K' },
  kairon: { name: 'Kairon', initials: 'Ka' },
  helieny: { name: 'Helieny', initials: 'H' },
  anicio: { name: 'Anicio', initials: 'A' },
}

export const documentCategories: Array<'Todos' | DocumentCategory> = [
  'Todos',
  'Voo',
  'Hospedagem',
  'Transporte',
  'Ingresso',
  'Seguro',
  'Outro',
]

export const documentSeed: TripDocument[] = [
  {
    id: 'flight-lis-rome',
    title: 'Voo Lisboa → Roma',
    category: 'Voo',
    dateLabel: '18 de setembro · 08:15',
    bookingCode: 'VOYA18',
    status: 'Confirmado',
    travelerIds: ['kauan', 'kairon', 'helieny', 'anicio'],
    fileName: 'bilhetes-lisboa-roma.pdf',
  },
  {
    id: 'hotel-rome',
    title: 'Hospedagem em Roma',
    category: 'Hospedagem',
    dateLabel: '18–22 de setembro',
    bookingCode: 'ROMA42',
    status: 'Confirmado',
    travelerIds: ['kauan', 'kairon', 'helieny', 'anicio'],
    fileName: 'reserva-roma.pdf',
  },
  {
    id: 'train-rome-venice',
    title: 'Comboio Roma → Veneza',
    category: 'Transporte',
    dateLabel: '22 de setembro · 09:35',
    status: 'Atenção',
    travelerIds: ['kauan', 'kairon', 'helieny', 'anicio'],
  },
  {
    id: 'colosseum',
    title: 'Entrada para o Coliseu',
    category: 'Ingresso',
    dateLabel: '20 de setembro · 10:00',
    bookingCode: 'COL20',
    status: 'Confirmado',
    travelerIds: ['kauan', 'kairon', 'helieny', 'anicio'],
    fileName: 'coliseu.pdf',
  },
  {
    id: 'travel-insurance',
    title: 'Seguro de viagem',
    category: 'Seguro',
    dateLabel: '18–25 de setembro',
    status: 'Rascunho',
    travelerIds: ['kauan'],
  },
]
