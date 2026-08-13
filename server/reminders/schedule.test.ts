import assert from 'node:assert/strict'
import test from 'node:test'

import { reminderDeliveryKey, scheduledReminderAt } from './schedule.ts'

test('schedules a reminder using the selected lead time', () => {
  const startsAt = new Date('2026-09-12T10:00:00Z')
  const scheduled = scheduledReminderAt(startsAt, 30, new Date('2026-09-12T08:00:00Z'))
  assert.equal(scheduled?.toISOString(), '2026-09-12T09:30:00.000Z')
})

test('schedules immediately when the preferred reminder time has passed', () => {
  const now = new Date('2026-09-12T09:50:00Z')
  const scheduled = scheduledReminderAt(new Date('2026-09-12T10:00:00Z'), 30, now)
  assert.equal(scheduled?.toISOString(), now.toISOString())
})

test('does not schedule reminders for activities that have started', () => {
  const scheduled = scheduledReminderAt(
    new Date('2026-09-12T10:00:00Z'),
    30,
    new Date('2026-09-12T10:00:00Z'),
  )
  assert.equal(scheduled, null)
})

test('keeps delivery keys stable and changes them when the schedule changes', () => {
  const base = {
    activityId: 'activity-1',
    userId: 'user-1',
    startsAt: new Date('2026-09-12T10:00:00Z'),
    leadMinutes: 30 as const,
  }
  assert.equal(reminderDeliveryKey(base), reminderDeliveryKey(base))
  assert.notEqual(reminderDeliveryKey(base), reminderDeliveryKey({ ...base, leadMinutes: 60 }))
})
