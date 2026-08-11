import { randomUUID } from 'node:crypto'

import { createDatabaseClient } from './client.ts'

const initialChecklist = [
  {
    title: 'Documentos importantes',
    owner: 'family',
    position: 0,
    items: ['Passaportes e cartões', 'Seguro de viagem', 'Bilhetes de comboio', 'Guardar reservas offline'],
  },
  {
    title: 'Preparação',
    owner: 'family',
    position: 1,
    items: ['Fazer check-in do voo', 'Confirmar hospedagens', 'Baixar mapas offline', 'Verificar roaming dos telemóveis'],
  },
  {
    title: 'Mochila',
    owner: 'organizer',
    position: 0,
    items: ['Carregador e cabo', 'Power bank', 'Fones', 'Medicamentos pessoais'],
  },
  {
    title: 'Mala',
    owner: 'organizer',
    position: 1,
    items: ['Roupa para 7 dias', 'Sapatos confortáveis', 'Pijama', 'Higiene pessoal'],
  },
] as const

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
          start_date, end_date, base_currency, timezone
        ) values (
          ${tripId}, ${context.householdId}, ${context.organizerId},
          ${'Itália 2026'},
          ${'Viagem de 10 dias por Roma, Veneza, Tivoli e Cidade do Vaticano.'},
          ${'2026-08-17'}, ${'2026-08-26'}, ${'EUR'}, ${'Europe/Rome'}
        )
      `
      await transaction`
        insert into trip_members (trip_id, user_id, role)
        select ${tripId}, user_id, role
        from household_members
        where household_id = ${context.householdId}
      `
      for (const group of initialChecklist) {
        const groupId = randomUUID()
        await transaction`
          insert into checklist_groups (id, trip_id, owner_user_id, title, position)
          values (
            ${groupId}, ${tripId},
            ${group.owner === 'organizer' ? context.organizerId : null},
            ${group.title}, ${group.position}
          )
        `
        for (const [itemPosition, title] of group.items.entries()) {
          await transaction`
            insert into checklist_items (id, group_id, title, position)
            values (${randomUUID()}, ${groupId}, ${title}, ${itemPosition})
          `
        }
      }
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
