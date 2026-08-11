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
  note?: string
  travelerRoles?: Partial<Record<TravelerId, string>>
  fileUrl?: string
  activityIds?: string[]
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

const fallbackDocuments: TripDocument[] = [
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

const categoryMap: Record<string, DocumentCategory> = {
  atracao: 'Ingresso',
  comboio: 'Transporte',
  hospedagem: 'Hospedagem',
  roteiro: 'Outro',
  seguro: 'Seguro',
  transporte_publico: 'Transporte',
  voos: 'Voo',
}

const travelerIdMap: Record<string, TravelerId> = {
  Anicio: 'anicio',
  Helieny: 'helieny',
  Kairon: 'kairon',
  Kauan: 'kauan',
}

function formatDocumentDate(date: string | null) {
  if (!date) return 'Sem data específica'
  return new Intl.DateTimeFormat('pt-PT', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${date}T12:00:00Z`))
}

function mapDocument(document: RawTripDocument, index: number): TripDocument {
  const travelerRoles = Object.fromEntries(
    Object.entries(document.classificacao_viajantes ?? {}).flatMap(([name, role]) => {
      const id = travelerIdMap[name]
      return id ? [[id, role === 'estudante_menor_26' ? 'Estudante < 26' : 'Adulto']] : []
    }),
  ) as Partial<Record<TravelerId, string>>

  return {
    id: `imported-document-${index}`,
    title: document.titulo,
    category: categoryMap[document.categoria] ?? 'Outro',
    dateLabel: formatDocumentDate(document.data_relevante),
    bookingCode: document.codigo_reserva ?? undefined,
    status: document.status === 'confirmado' ? 'Confirmado' : 'Atenção',
    travelerIds: document.viajantes.flatMap((name) => travelerIdMap[name] ?? []),
    fileName: document.arquivo_local ?? document.nome_arquivo ?? undefined,
    note: document.observacoes ?? undefined,
    travelerRoles,
    fileUrl: document.arquivo_local
      ? `/trip-documents/${document.arquivo_local.split('/').map(encodeURIComponent).join('/')}`
      : undefined,
  }
}

const importedDocuments = Array.from(
  new Map(
    (privateTrip?.documentos ?? [])
      .map(mapDocument)
      .map((document) => [document.fileUrl ?? document.id, document]),
  ).values(),
)

export const documentSeed = importedDocuments.length ? importedDocuments : fallbackDocuments
import { privateTrip, type RawTripDocument } from './privateTrip'
