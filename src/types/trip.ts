export type ActivityType =
  | 'food'
  | 'attraction'
  | 'transport'
  | 'hotel'
  | 'free'

export type ActivityStatus =
  | 'completed'
  | 'current'
  | 'planned'

export interface Activity {
  id: string
  title: string
  time: string
  type: ActivityType
  status: ActivityStatus
  label?: string
  address?: string
  mapsUrl?: string
}

export interface TripDay {
  date: string
  city: string
  activities: Activity[]
}
