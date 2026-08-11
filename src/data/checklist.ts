export type ChecklistScope = 'family' | 'personal'

export type ChecklistItem = {
  id: string
  title: string
  completed: boolean
}

export type ChecklistGroup = {
  id: string
  title: string
  scope: ChecklistScope
  ownerName?: string
  items: ChecklistItem[]
}

export const checklistGroups: ChecklistGroup[] = [
  {
    id: 'documents',
    title: 'Documentos importantes',
    scope: 'family',
    items: [
      { id: 'identity', title: 'Passaportes e cartões', completed: true },
      { id: 'insurance', title: 'Seguro de viagem', completed: true },
      { id: 'train-tickets', title: 'Bilhetes de comboio', completed: true },
      { id: 'offline-bookings', title: 'Guardar reservas offline', completed: false },
    ],
  },
  {
    id: 'preparation',
    title: 'Preparação',
    scope: 'family',
    items: [
      { id: 'flight-checkin', title: 'Fazer check-in do voo', completed: false },
      { id: 'hotel-confirmation', title: 'Confirmar hospedagens', completed: true },
      { id: 'offline-maps', title: 'Baixar mapas offline', completed: false },
      { id: 'roaming', title: 'Verificar roaming dos telemóveis', completed: false },
    ],
  },
  {
    id: 'kauan-backpack',
    title: 'Mochila',
    scope: 'personal',
    ownerName: 'Kauan',
    items: [
      { id: 'charger', title: 'Carregador e cabo', completed: true },
      { id: 'power-bank', title: 'Power bank', completed: false },
      { id: 'headphones', title: 'Fones', completed: false },
      { id: 'medication', title: 'Medicamentos pessoais', completed: false },
    ],
  },
  {
    id: 'kauan-suitcase',
    title: 'Mala',
    scope: 'personal',
    ownerName: 'Kauan',
    items: [
      { id: 'clothes', title: 'Roupa para 7 dias', completed: false },
      { id: 'shoes', title: 'Sapatos confortáveis', completed: true },
      { id: 'sleepwear', title: 'Pijama', completed: false },
      { id: 'toiletries', title: 'Higiene pessoal', completed: false },
    ],
  },
]
