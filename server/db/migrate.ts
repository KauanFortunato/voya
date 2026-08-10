import { readdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { createDatabaseClient } from './client.ts'

const migrationsDirectory = fileURLToPath(new URL('./migrations', import.meta.url))

export async function migrate() {
  const sql = createDatabaseClient()

  try {
    await sql`
      create table if not exists schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )
    `

    const files = (await readdir(migrationsDirectory))
      .filter((file) => file.endsWith('.sql'))
      .sort()

    for (const file of files) {
      const [applied] = await sql<{ exists: boolean }[]>`
        select exists(select 1 from schema_migrations where name = ${file}) as exists
      `

      if (applied?.exists) continue

      const migration = await readFile(`${migrationsDirectory}/${file}`, 'utf8')
      await sql.begin(async (transaction) => {
        await transaction.unsafe(migration)
        await transaction`insert into schema_migrations (name) values (${file})`
      })

      console.info(`Migration aplicada: ${file}`)
    }
  } finally {
    await sql.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await migrate()
}
