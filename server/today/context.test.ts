import assert from 'node:assert/strict'
import test from 'node:test'

import { contextualChecklistLimit, currentTripDate, tripPhase } from './context.ts'

test('classifies the trip phase from local calendar dates', () => {
  assert.equal(tripPhase('2026-08-16', '2026-08-17', '2026-08-26'), 'before')
  assert.equal(tripPhase('2026-08-17', '2026-08-17', '2026-08-26'), 'during')
  assert.equal(tripPhase('2026-08-26', '2026-08-17', '2026-08-26'), 'during')
  assert.equal(tripPhase('2026-08-27', '2026-08-17', '2026-08-26'), 'after')
})

test('keeps the contextual checklist compact', () => {
  assert.equal(contextualChecklistLimit('before'), 4)
  assert.equal(contextualChecklistLimit('during'), 3)
  assert.equal(contextualChecklistLimit('after'), 0)
})

test('chooses the relevant trip day for the current local date', () => {
  const dates = ['2026-08-17', '2026-08-18', '2026-08-20']
  assert.equal(currentTripDate('2026-08-14', dates), '2026-08-17')
  assert.equal(currentTripDate('2026-08-18', dates), '2026-08-18')
  assert.equal(currentTripDate('2026-08-19', dates), '2026-08-20')
  assert.equal(currentTripDate('2026-08-27', dates), '2026-08-20')
  assert.equal(currentTripDate('2026-08-14', []), null)
})
