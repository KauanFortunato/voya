import { randomUUID } from 'node:crypto'

import { readEnvironment } from '../config.ts'
import { hashPassword } from '../security/password.ts'
import { createDatabaseClient } from './client.ts'

const travelers = [
  { name: 'Kauan', role: 'organizer' },
  { name: 'Kairon', role: 'traveler' },
  { name: 'Helieny', role: 'traveler' },
  { name: 'Anicio', role: 'traveler' },
] as const

export async function seedFamily() {
  const environment = readEnvironment()
  if (!environment.VOYA_BOOTSTRAP_PASSWORD) {
    throw new Error('Defina VOYA_BOOTSTRAP_PASSWORD antes de criar os usuários iniciais')
  }

  const sql = createDatabaseClient()
  const passwordHash = await hashPassword(environment.VOYA_BOOTSTRAP_PASSWORD)

  try {
    await sql.begin(async (transaction) => {
      const [existing] = await transaction<{ count: string }[]>`
        select count(*)::text as count from households
      `
      if (existing && Number(existing.count) > 0) {
        throw new Error('O seed inicial não pode rodar em um banco que já possui família')
      }

      const householdId = randomUUID()
      await transaction`
        insert into households (id, name) values (${householdId}, ${'Família Fortunato'})
      `

      for (const traveler of travelers) {
        const userId = randomUUID()
        await transaction`
          insert into users (id, display_name, password_hash)
          values (${userId}, ${traveler.name}, ${passwordHash})
        `
        await transaction`
          insert into household_members (household_id, user_id, role)
          values (${householdId}, ${userId}, ${traveler.role})
        `
      }
    })

    console.info('Família inicial criada com Kauan como organizador')
  } finally {
    await sql.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await seedFamily()
}
