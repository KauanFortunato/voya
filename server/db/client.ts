import postgres from 'postgres'

import { readEnvironment } from '../config.ts'

export function createDatabaseClient() {
  const { DATABASE_URL } = readEnvironment()

  return postgres(DATABASE_URL, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 5,
    transform: postgres.camel,
  })
}

export type DatabaseClient = ReturnType<typeof createDatabaseClient>
