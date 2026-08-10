import postgres from 'postgres'

import { readEnvironment } from '../config.ts'

function quoteLiteral(value: string) {
  return `'${value.replaceAll("'", "''")}'`
}

export async function provisionDatabase() {
  const environment = readEnvironment()
  if (!environment.POSTGRES_ADMIN_URL || !environment.VOYA_DATABASE_PASSWORD) {
    throw new Error('Defina POSTGRES_ADMIN_URL e VOYA_DATABASE_PASSWORD antes do provisionamento')
  }

  const admin = postgres(environment.POSTGRES_ADMIN_URL, {
    max: 1,
    connect_timeout: 5,
  })

  try {
    const [privileges] = await admin<{
      canCreateRole: boolean
      canCreateDatabase: boolean
      isSuperuser: boolean
    }[]>`
      select
        rolcreaterole as can_create_role,
        rolcreatedb as can_create_database,
        rolsuper as is_superuser
      from pg_roles
      where rolname = current_user
    `

    if (!privileges || (!privileges.isSuperuser && !privileges.canCreateRole)) {
      throw new Error('O usuário de provisionamento não possui permissão para criar roles')
    }
    if (!privileges.isSuperuser && !privileges.canCreateDatabase) {
      throw new Error('O usuário de provisionamento não possui permissão para criar bancos')
    }

    const [role] = await admin<{ exists: boolean }[]>`
      select exists(select 1 from pg_roles where rolname = 'voya_app') as exists
    `
    const password = quoteLiteral(environment.VOYA_DATABASE_PASSWORD)

    if (role?.exists) {
      await admin.unsafe(`alter role voya_app with login password ${password}`)
      console.info('Role voya_app atualizada')
    } else {
      await admin.unsafe(`create role voya_app with login password ${password}`)
      console.info('Role voya_app criada')
    }

    const [database] = await admin<{ exists: boolean }[]>`
      select exists(select 1 from pg_database where datname = 'voya') as exists
    `

    if (database?.exists) {
      console.info('Banco voya já existe')
    } else {
      await admin.unsafe('create database voya owner voya_app')
      console.info('Banco voya criado')
    }
  } finally {
    await admin.end()
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await provisionDatabase()
}
