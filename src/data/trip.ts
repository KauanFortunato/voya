import type { TripDay } from '../types/trip'

export const today: TripDay = {
  date: '2026-08-17',
  city: 'Roma',

  activities: [
    {
      id: 'breakfast',
      title: 'Café da manhã',
      time: '08:30',
      type: 'food',
      status: 'completed',
    },

    {
      id: 'colosseum',
      title: 'Coliseu',
      time: '10:30',
      type: 'attraction',
      status: 'current',
      address: 'Piazza del Colosseo, Roma',
      mapsUrl:
        'https://www.google.com/maps/search/?api=1&query=Colosseum+Rome',
    },

    {
      id: 'lunch',
      title: 'Almoço',
      time: '13:30',
      type: 'food',
      status: 'planned',
    },

    {
      id: 'trevi',
      title: 'Fontana di Trevi',
      time: '16:00',
      type: 'attraction',
      status: 'planned',
    },
  ],
}