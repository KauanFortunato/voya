import { createHash, randomBytes, randomUUID } from 'node:crypto'

import cookie from '@fastify/cookie'
import Fastify from 'fastify'
import { z } from 'zod'

import { readEnvironment } from './config.ts'
import { createDatabaseClient } from './db/client.ts'
import { verifyPassword } from './security/password.ts'

const sessionCookie = 'voya_session'
const sessionDurationMs = 1000 * 60 * 60 * 24 * 30
const loginSchema = z.object({
  name: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(256),
})

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function start() {
  const environment = readEnvironment()
  const sql = createDatabaseClient()
  const app = Fastify({ logger: true })

  await app.register(cookie)

  app.addHook('onClose', async () => {
    await sql.end()
  })

  app.get('/api/health', async () => {
    const [database] = await sql<{ now: Date }[]>`select now() as now`
    return { status: 'ok', databaseTime: database?.now }
  })

  app.post('/api/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: 'Dados de login inválidos' })

    const [user] = await sql<{
      id: string
      displayName: string
      passwordHash: string
      role: 'organizer' | 'traveler'
    }[]>`
      select u.id, u.display_name, u.password_hash, hm.role
      from users u
      join household_members hm on hm.user_id = u.id
      where lower(u.display_name) = lower(${parsed.data.name})
      limit 1
    `

    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return reply.code(401).send({ error: 'Nome ou senha incorretos' })
    }

    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + sessionDurationMs)
    await sql`
      insert into sessions (id, user_id, token_hash, expires_at)
      values (${randomUUID()}, ${user.id}, ${hashSessionToken(token)}, ${expiresAt})
    `

    reply.setCookie(sessionCookie, token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      expires: expiresAt,
    })

    return { user: { id: user.id, displayName: user.displayName, role: user.role } }
  })

  app.get('/api/auth/me', async (request, reply) => {
    const token = request.cookies[sessionCookie]
    if (!token) return reply.code(401).send({ error: 'Sessão não encontrada' })

    const [user] = await sql<{
      id: string
      displayName: string
      role: 'organizer' | 'traveler'
    }[]>`
      select u.id, u.display_name, hm.role
      from sessions s
      join users u on u.id = s.user_id
      join household_members hm on hm.user_id = u.id
      where s.token_hash = ${hashSessionToken(token)} and s.expires_at > now()
      limit 1
    `

    if (!user) return reply.code(401).send({ error: 'Sessão inválida ou expirada' })
    return { user }
  })

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[sessionCookie]
    if (token) await sql`delete from sessions where token_hash = ${hashSessionToken(token)}`
    reply.clearCookie(sessionCookie, { path: '/' })
    return reply.code(204).send()
  })

  await app.listen({ host: environment.VOYA_API_HOST, port: environment.VOYA_API_PORT })
}

await start()
