import type { TripDay } from '../types/trip'

export const today: TripDay = {
  date: '2026-09-12',
  city: 'Roma',

  activities: [
    {
      id: 'breakfast',
      title: "Café no Sant'Eustachio",
      time: '08:30',
      type: 'food',
      status: 'completed',
      label: 'Café',
      address: 'Piazza di S. Eustachio, 82',
    },

    {
      id: 'colosseum',
      title: 'Coliseu e Fórum Romano',
      time: '10:00',
      type: 'attraction',
      status: 'current',
      label: 'Reserva VL-2847',
      address: 'Piazza del Colosseo, 1',
      mapsUrl:
        'https://www.google.com/maps/search/?api=1&query=Colosseum+Rome',
    },

    {
      id: 'lunch',
      title: 'Almoço em Monti',
      time: '13:20',
      type: 'food',
      status: 'planned',
      label: 'Restaurante',
      address: 'Via Urbana, 47',
    },

    {
      id: 'gianicolo',
      title: 'Pôr do sol no Gianicolo',
      time: '17:00',
      type: 'attraction',
      status: 'planned',
      label: 'Passeio',
      address: 'Piazzale Giuseppe Garibaldi',
    },
  ],
}
