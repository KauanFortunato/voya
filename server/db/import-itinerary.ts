import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import { createDatabaseClient } from './client.ts'

type ImportedActivity = {
  ordem: number
  titulo: string
  categoria: string
  horario_inicio: string | null
  horario_fim: string | null
  endereco: string | null
  status: string
  observacoes: string | null
}

type ImportedTrip = {
  viagem: { nome: string }
  roteiro: Array<{ data: string; cidade: string; atividades: ImportedActivity[] }>
}

function italianDateTime(date: string, time: string | null) {
  return time ? `${date}T${time}:00+02:00` : null
}

export async function importItinerary(sourcePath = 'src/data/private-trip.json') {
  const source = JSON.parse(await readFile(resolve(sourcePath), 'utf8')) as ImportedTrip
  const sql = createDatabaseClient()

  try {
    const [trip] = await sql<{ id: string }[]>`
      select id from trips where title = ${source.viagem.nome} order by created_at desc limit 1
    `
    if (!trip) throw new Error(`Viagem não encontrada: ${source.viagem.nome}`)

    await sql.begin(async (transaction) => {
      for (const [dayIndex, day] of source.roteiro.entries()) {
        const [tripDay] = await transaction<{ id: string }[]>`
          insert into trip_days (id, trip_id, day_date, city, position)
          values (${randomUUID()}, ${trip.id}, ${day.data}, ${day.cidade}, ${dayIndex})
          on conflict (trip_id, day_date) do update
          set city = excluded.city, position = excluded.position
          returning id
        `
        if (!tripDay) throw new Error(`Não foi possível importar o dia ${day.data}`)

        for (const [activityIndex, activity] of day.atividades.entries()) {
          const sourceKey = `${day.data}-${activity.ordem}`
          await transaction`
            insert into activities (
              id, trip_day_id, source_key, title, category, starts_at, ends_at,
              address, notes, status, position
            ) values (
              ${randomUUID()}, ${tripDay.id}, ${sourceKey}, ${activity.titulo},
              ${activity.categoria}, ${italianDateTime(day.data, activity.horario_inicio)},
              ${italianDateTime(day.data, activity.horario_fim)}, ${activity.endereco},
              ${activity.observacoes},
              ${activity.status === 'concluido' ? 'completed' : 'planned'}, ${activityIndex}
            )
            on conflict (trip_day_id, source_key) where source_key is not null do update
            set title = excluded.title, category = excluded.category,
                starts_at = excluded.starts_at, ends_at = excluded.ends_at,
                address = excluded.address, notes = excluded.notes,
                status = excluded.status, position = excluded.position,
                updated_at = now()
          `
        }
      }
    })

    console.info(`Roteiro importado: ${source.roteiro.length} dias`)
  } finally {
    await sql.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await importItinerary(process.argv[2])
}
