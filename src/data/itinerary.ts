export type CalendarActivity = {
  id: string
  time: string
  title: string
  category: string
  address: string
}

export type CalendarDay = {
  date: number
  weekday: string
  city: string
  summary: string
  activities: CalendarActivity[]
  transport?: string
}

export const tripDays: CalendarDay[] = [
  {
    date: 12,
    weekday: 'Qui',
    city: 'Roma',
    summary: '4 atividades · Hotel Artemide',
    activities: [
      { id: 'coffee', time: '08:30', title: "Café no Sant'Eustachio", category: 'Café', address: 'Piazza di S. Eustachio, 82' },
      { id: 'colosseum', time: '10:00', title: 'Coliseu e Fórum Romano', category: 'Reserva', address: 'Piazza del Colosseo, 1' },
      { id: 'monti', time: '13:20', title: 'Almoço em Monti', category: 'Restaurante', address: 'Via Urbana, 47' },
      { id: 'gianicolo', time: '17:00', title: 'Pôr do sol no Gianicolo', category: 'Passeio', address: 'Piazzale Giuseppe Garibaldi' },
    ],
  },
  {
    date: 13,
    weekday: 'Sex',
    city: 'Roma',
    summary: '3 atividades · Vaticano',
    activities: [
      { id: 'vatican', time: '09:00', title: 'Museus do Vaticano', category: 'Bilhete', address: 'Viale Vaticano' },
      { id: 'trastevere', time: '14:00', title: 'Trastevere a pé', category: 'Passeio', address: 'Piazza di Santa Maria' },
      { id: 'roscioli', time: '20:00', title: 'Jantar no Roscioli', category: 'Reserva', address: 'Via dei Giubbonari, 21' },
    ],
  },
  {
    date: 14,
    weekday: 'Sáb',
    city: 'Veneza',
    summary: "3 atividades · Ca' Pisani",
    transport: 'Frecciarossa 9400 · 07:35',
    activities: [
      { id: 'train', time: '07:35', title: 'Frecciarossa para Veneza', category: 'Transporte', address: 'Roma Termini' },
      { id: 'checkin', time: '12:15', title: "Check-in Ca' Pisani", category: 'Hotel', address: 'Dorsoduro, 979A' },
      { id: 'san-marco', time: '16:30', title: 'Passeio por San Marco', category: 'Passeio', address: 'Piazza San Marco' },
    ],
  },
  {
    date: 15,
    weekday: 'Dom',
    city: 'Veneza',
    summary: '3 atividades · Cannaregio',
    activities: [
      { id: 'rialto', time: '09:00', title: 'Mercado de Rialto', category: 'Mercado', address: 'Campo de la Pescaria' },
      { id: 'guggenheim', time: '13:30', title: 'Peggy Guggenheim', category: 'Atração', address: 'Dorsoduro, 701' },
      { id: 'cannaregio', time: '18:00', title: 'Fim de tarde em Cannaregio', category: 'Passeio', address: 'Fondamenta dei Ormesini' },
    ],
  },
]
