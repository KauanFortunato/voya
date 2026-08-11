import { randomUUID } from 'node:crypto'

import { createDatabaseClient } from './client.ts'

export async function seedInitialTrip() {
  const sql = createDatabaseClient()

  try {
    const [context] = await sql<{ householdId: string; organizerId: string }[]>`
      select h.id as household_id, u.id as organizer_id
      from households h
      join household_members hm on hm.household_id = h.id and hm.role = 'organizer'
      join users u on u.id = hm.user_id
      where lower(u.display_name) = 'kauan'
      limit 1
    `
    if (!context) throw new Error('Crie a família inicial antes de criar a viagem')

    const [existing] = await sql<{ id: string }[]>`
      select id from trips
      where household_id = ${context.householdId} and title = 'Itália 2026'
      limit 1
    `
    if (existing) {
      console.info('Viagem inicial já existe')
      return existing.id
    }

    const tripId = randomUUID()
    await sql.begin(async (transaction) => {
      await transaction`
        insert into trips (
          id, household_id, created_by, title, description,
          start_date, end_date, base_currency
        ) values (
          ${tripId}, ${context.householdId}, ${context.organizerId},
          ${'Itália 2026'},
          ${'Viagem de 10 dias por Roma, Veneza, Tivoli e Cidade do Vaticano.'},
          ${'2026-08-17'}, ${'2026-08-26'}, ${'EUR'}
        )
      `
      await transaction`
        insert into trip_members (trip_id, user_id, role)
        select ${tripId}, user_id, role
        from household_members
        where household_id = ${context.householdId}
      `
    })

    console.info('Viagem inicial criada com os quatro viajantes')
    return tripId
  } finally {
    await sql.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedInitialTrip()
}
