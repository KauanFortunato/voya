import { createHash } from 'node:crypto'

export type ReminderLeadMinutes = 15 | 30 | 60 | 1440

type DeliveryKeyInput = {
  activityId: string
  userId: string
  startsAt: Date
  leadMinutes: ReminderLeadMinutes
}

export function scheduledReminderAt(startsAt: Date, leadMinutes: ReminderLeadMinutes, now = new Date()) {
  if (startsAt.getTime() <= now.getTime()) return null
  const preferredTime = new Date(startsAt.getTime() - leadMinutes * 60_000)
  return preferredTime.getTime() > now.getTime() ? preferredTime : now
}

export function reminderDeliveryKey(input: DeliveryKeyInput) {
  return createHash('sha256')
    .update(`${input.activityId}:${input.userId}:${input.startsAt.toISOString()}:${input.leadMinutes}`)
    .digest('hex')
}
