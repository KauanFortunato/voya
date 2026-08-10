export type RawTripActivity = {
  ordem: number
  titulo: string
  categoria: string
  horario_inicio: string | null
  horario_fim: string | null
  duracao_minutos: number | null
  endereco: string | null
  status: string
  observacoes: string | null
}

export type RawTripDay = {
  data: string
  cidade: string
  atividades: RawTripActivity[]
}

export type RawTripDocument = {
  titulo: string
  categoria: string
  status: string
  codigo_reserva: string | null
  data_relevante: string | null
  viajantes: string[]
  nome_arquivo: string | null
  observacoes: string | null
  classificacao_viajantes?: Record<string, string>
}

export type PrivateTrip = {
  viagem: {
    nome: string
    descricao: string
    data_inicio: string
    data_fim: string
    moeda: string
  }
  roteiro: RawTripDay[]
  documentos: RawTripDocument[]
}

const privateTripModules = import.meta.glob('./private-trip.json', {
  eager: true,
  import: 'default',
}) as Record<string, PrivateTrip>

export const privateTrip = Object.values(privateTripModules)[0]
