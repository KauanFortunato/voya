import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'

import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import staticFiles from '@fastify/static'
import Fastify from 'fastify'
import type { FastifyRequest } from 'fastify'
import { z } from 'zod'

import { readEnvironment } from './config.ts'
import { createDatabaseClient } from './db/client.ts'
import {
  ensureDocumentsStorage,
  isAllowedDocumentMimeType,
  normalizeOriginalFilename,
  openDocumentFile,
  removeDocumentFile,
  stageDocumentRemoval,
  storeDocumentFile,
} from './documents/storage.ts'
import { verifyPassword } from './security/password.ts'

const sessionCookie = 'voya_session'
const sessionDurationMs = 1000 * 60 * 60 * 24 * 30
const loginSchema = z.object({
  name: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(256),
})
const documentMetadataSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(['Voo', 'Hospedagem', 'Transporte', 'Ingresso', 'Seguro', 'Outro']).default('Outro'),
  travelerIds: z.array(z.enum(['kauan', 'kairon', 'helieny', 'anicio'])).min(1),
  activityIds: z.array(z.string().uuid()).max(50).default([]),
})
const associationSchema = z.object({ ids: z.array(z.string().uuid()).max(50) })

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function start() {
  const environment = readEnvironment()
  const sql = createDatabaseClient()
  const app = Fastify({ logger: true })

  await app.register(cookie)
  await app.register(multipart, {
    limits: {
      files: 1,
      fileSize: environment.VOYA_MAX_DOCUMENT_SIZE_MB * 1024 * 1024,
      fields: 8,
    },
  })
  await ensureDocumentsStorage(environment.VOYA_DOCUMENTS_PATH)

  if (environment.VOYA_WEB_ROOT) {
    const webRoot = resolve(environment.VOYA_WEB_ROOT)
    if (!existsSync(webRoot)) throw new Error(`Interface web não encontrada em ${webRoot}`)
    await app.register(staticFiles, { root: webRoot })
  }

  app.addHook('onClose', async () => {
    await sql.end()
  })

  app.get('/api/health', async () => {
    const [database] = await sql<{ now: Date }[]>`select now() as now`
    return { status: 'ok', databaseTime: database?.now }
  })

  async function authenticate(request: FastifyRequest) {
    const token = request.cookies[sessionCookie]
    if (!token) return null

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
    return user ?? null
  }

  async function getCurrentTrip(userId: string) {
    const [trip] = await sql<{ id: string; title: string }[]>`
      select t.id, t.title
      from trips t
      join trip_members tm on tm.trip_id = t.id
      where tm.user_id = ${userId}
      order by t.start_date desc
      limit 1
    `
    return trip ?? null
  }

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
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Sessão inválida ou expirada' })
    return { user }
  })

  app.post('/api/auth/logout', async (request, reply) => {
    const token = request.cookies[sessionCookie]
    if (token) await sql`delete from sessions where token_hash = ${hashSessionToken(token)}`
    reply.clearCookie(sessionCookie, { path: '/' })
    return reply.code(204).send()
  })

  app.get('/api/documents', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para ver os documentos' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const documents = await sql<{
      id: string
      title: string
      category: string
      bookingCode: string | null
      status: 'draft' | 'confirmed' | 'attention' | 'expired'
      startsAt: Date | null
      originalFilename: string
      mimeType: string
      fileSize: string
      createdAt: Date
      travelerIds: string[]
      activityIds: string[]
    }[]>`
      select
        d.id, d.title, d.category, d.booking_code, d.status, d.starts_at,
        d.original_filename, d.mime_type, d.file_size, d.created_at,
        coalesce(
          (select array_agg(lower(u.display_name) order by u.display_name)
           from document_travelers dt join users u on u.id = dt.user_id
           where dt.document_id = d.id),
          array[]::text[]
        ) as traveler_ids,
        coalesce(
          (select array_agg(da.activity_id order by da.activity_id)
           from document_activities da where da.document_id = d.id),
          array[]::uuid[]
        ) as activity_ids
      from documents d
      join trip_members viewer on viewer.trip_id = d.trip_id and viewer.user_id = ${user.id}
      where d.trip_id = ${trip.id}
      order by d.created_at desc
    `

    const activities = await sql<{
      id: string
      sourceKey: string | null
      title: string
      category: string
      dayDate: string
      city: string
      time: string | null
      endTime: string | null
      address: string | null
      notes: string | null
      status: 'planned' | 'current' | 'completed' | 'cancelled'
      position: number
      dayPosition: number
    }[]>`
      select a.id, a.source_key, a.title, a.category, td.day_date::text,
             td.city, to_char(a.starts_at at time zone 'Europe/Rome', 'HH24:MI') as time,
             to_char(a.ends_at at time zone 'Europe/Rome', 'HH24:MI') as end_time,
             a.address, a.notes, a.status, a.position, td.position as day_position
      from activities a
      join trip_days td on td.id = a.trip_day_id
      where td.trip_id = ${trip.id}
      order by td.position, a.position
    `

    return { trip, documents, activities }
  })

  app.post('/api/documents', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para importar documentos' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const fields: Record<string, string> = {}
    let uploaded: { storagePath: string; fileSize: number } | null = null
    let filename = ''
    let mimeType = ''

    try {
      for await (const part of request.parts()) {
        if (part.type === 'field') {
          fields[part.fieldname] = String(part.value)
          continue
        }

        if (uploaded || part.fieldname !== 'file') {
          part.file.resume()
          if (uploaded) await removeDocumentFile(environment.VOYA_DOCUMENTS_PATH, uploaded.storagePath)
          return reply.code(400).send({ error: 'Envie apenas um ficheiro no campo file' })
        }
        if (!isAllowedDocumentMimeType(part.mimetype)) {
          part.file.resume()
          return reply.code(415).send({ error: 'Use um ficheiro PDF, JPG, PNG ou WebP' })
        }

        filename = normalizeOriginalFilename(part.filename)
        mimeType = part.mimetype
        uploaded = await storeDocumentFile(
          environment.VOYA_DOCUMENTS_PATH,
          trip.id,
          mimeType,
          part.file,
        )
        if (part.file.truncated) {
          await removeDocumentFile(environment.VOYA_DOCUMENTS_PATH, uploaded.storagePath)
          return reply.code(413).send({
            error: `O ficheiro deve ter no máximo ${environment.VOYA_MAX_DOCUMENT_SIZE_MB} MB`,
          })
        }
      }
    } catch (error) {
      if (uploaded) await removeDocumentFile(environment.VOYA_DOCUMENTS_PATH, uploaded.storagePath)
      if (error instanceof app.multipartErrors.RequestFileTooLargeError) {
        return reply.code(413).send({
          error: `O ficheiro deve ter no máximo ${environment.VOYA_MAX_DOCUMENT_SIZE_MB} MB`,
        })
      }
      throw error
    }

    if (!uploaded) return reply.code(400).send({ error: 'Selecione um ficheiro para importar' })

    let travelerIds: unknown
    let activityIds: unknown
    try {
      travelerIds = JSON.parse(fields.travelerIds ?? '[]')
      activityIds = JSON.parse(fields.activityIds ?? '[]')
    } catch {
      await removeDocumentFile(environment.VOYA_DOCUMENTS_PATH, uploaded.storagePath)
      return reply.code(400).send({ error: 'Associações do documento inválidas' })
    }
    const metadata = documentMetadataSchema.safeParse({
      title: fields.title,
      category: fields.category,
      travelerIds,
      activityIds,
    })
    if (!metadata.success) {
      await removeDocumentFile(environment.VOYA_DOCUMENTS_PATH, uploaded.storagePath)
      return reply.code(400).send({ error: 'Preencha o título, a categoria e os viajantes' })
    }

    const tripTravelers = await sql<{ id: string; travelerId: string }[]>`
      select u.id, lower(u.display_name) as traveler_id
      from trip_members tm
      join users u on u.id = tm.user_id
      where tm.trip_id = ${trip.id}
    `
    const selectedTravelers = tripTravelers.filter((traveler) =>
      metadata.data.travelerIds.includes(traveler.travelerId as typeof metadata.data.travelerIds[number]),
    )
    if (selectedTravelers.length !== metadata.data.travelerIds.length) {
      await removeDocumentFile(environment.VOYA_DOCUMENTS_PATH, uploaded.storagePath)
      return reply.code(400).send({ error: 'Um dos viajantes não pertence a esta viagem' })
    }

    const selectedActivities = metadata.data.activityIds.length
      ? await sql<{ id: string }[]>`
          select a.id from activities a
          join trip_days td on td.id = a.trip_day_id
          where td.trip_id = ${trip.id} and a.id in ${sql(metadata.data.activityIds)}
        `
      : []
    if (selectedActivities.length !== new Set(metadata.data.activityIds).size) {
      await removeDocumentFile(environment.VOYA_DOCUMENTS_PATH, uploaded.storagePath)
      return reply.code(400).send({ error: 'Uma das atividades não pertence a esta viagem' })
    }

    const documentId = randomUUID()
    try {
      await sql.begin(async (transaction) => {
        await transaction`
          insert into documents (
            id, trip_id, uploaded_by, title, category, status, storage_path,
            original_filename, mime_type, file_size
          ) values (
            ${documentId}, ${trip.id}, ${user.id}, ${metadata.data.title},
            ${metadata.data.category}, ${'confirmed'}, ${uploaded.storagePath},
            ${filename}, ${mimeType}, ${uploaded.fileSize}
          )
        `
        for (const traveler of selectedTravelers) {
          await transaction`
            insert into document_travelers (document_id, user_id)
            values (${documentId}, ${traveler.id})
          `
        }
        for (const activity of selectedActivities) {
          await transaction`
            insert into document_activities (document_id, activity_id)
            values (${documentId}, ${activity.id})
          `
        }
      })
    } catch (error) {
      await removeDocumentFile(environment.VOYA_DOCUMENTS_PATH, uploaded.storagePath)
      throw error
    }

    return reply.code(201).send({
      document: {
        id: documentId,
        title: metadata.data.title,
        category: metadata.data.category,
        status: 'confirmed',
        originalFilename: filename,
        mimeType,
        fileSize: uploaded.fileSize,
        createdAt: new Date(),
        travelerIds: metadata.data.travelerIds,
        activityIds: metadata.data.activityIds,
      },
    })
  })

  app.put('/api/documents/:id/activities', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para alterar documentos' })
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
    const body = associationSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: 'Associação inválida' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const [document] = await sql<{ id: string }[]>`
      select id from documents where id = ${params.data.id} and trip_id = ${trip.id}
    `
    if (!document) return reply.code(404).send({ error: 'Documento não encontrado' })
    const uniqueIds = [...new Set(body.data.ids)]
    const activities = uniqueIds.length
      ? await sql<{ id: string }[]>`
          select a.id from activities a join trip_days td on td.id = a.trip_day_id
          where td.trip_id = ${trip.id} and a.id in ${sql(uniqueIds)}
        `
      : []
    if (activities.length !== uniqueIds.length) {
      return reply.code(400).send({ error: 'Uma das atividades não pertence a esta viagem' })
    }

    await sql.begin(async (transaction) => {
      await transaction`delete from document_activities where document_id = ${document.id}`
      for (const activity of activities) {
        await transaction`insert into document_activities (document_id, activity_id) values (${document.id}, ${activity.id})`
      }
    })
    return { activityIds: uniqueIds }
  })

  app.delete('/api/documents/:id', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para apagar documentos' })
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: 'Documento inválido' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const [document] = await sql<{ id: string; uploadedBy: string; storagePath: string }[]>`
      select d.id, d.uploaded_by, d.storage_path
      from documents d
      where d.id = ${params.data.id} and d.trip_id = ${trip.id}
    `
    if (!document) return reply.code(404).send({ error: 'Documento não encontrado' })
    if (user.role !== 'organizer' && document.uploadedBy !== user.id) {
      return reply.code(403).send({ error: 'Apenas o organizador ou quem enviou pode apagar este documento' })
    }

    const staged = await stageDocumentRemoval(environment.VOYA_DOCUMENTS_PATH, document.storagePath)
    try {
      await sql`delete from documents where id = ${document.id}`
    } catch (error) {
      await staged.rollback()
      throw error
    }
    await staged.commit().catch((error) => request.log.error(error, 'Não foi possível limpar o ficheiro apagado'))
    return reply.code(204).send()
  })

  app.put('/api/activities/:id/documents', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para alterar o roteiro' })
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
    const body = associationSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: 'Associação inválida' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const [activity] = await sql<{ id: string }[]>`
      select a.id from activities a join trip_days td on td.id = a.trip_day_id
      where a.id = ${params.data.id} and td.trip_id = ${trip.id}
    `
    if (!activity) return reply.code(404).send({ error: 'Atividade não encontrada' })
    const uniqueIds = [...new Set(body.data.ids)]
    const documents = uniqueIds.length
      ? await sql<{ id: string }[]>`
          select id from documents where trip_id = ${trip.id} and id in ${sql(uniqueIds)}
        `
      : []
    if (documents.length !== uniqueIds.length) {
      return reply.code(400).send({ error: 'Um dos documentos não pertence a esta viagem' })
    }

    await sql.begin(async (transaction) => {
      await transaction`delete from document_activities where activity_id = ${activity.id}`
      for (const document of documents) {
        await transaction`insert into document_activities (document_id, activity_id) values (${document.id}, ${activity.id})`
      }
    })
    return { documentIds: uniqueIds }
  })

  app.get('/api/documents/:id/file', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para abrir documentos' })
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: 'Documento inválido' })

    const [document] = await sql<{
      storagePath: string
      originalFilename: string
      mimeType: string
    }[]>`
      select d.storage_path, d.original_filename, d.mime_type
      from documents d
      join trip_members tm on tm.trip_id = d.trip_id and tm.user_id = ${user.id}
      where d.id = ${params.data.id}
      limit 1
    `
    if (!document) return reply.code(404).send({ error: 'Documento não encontrado' })

    try {
      const file = await openDocumentFile(environment.VOYA_DOCUMENTS_PATH, document.storagePath)
      reply.header('Content-Type', document.mimeType)
      reply.header('Content-Length', file.size)
      reply.header('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(document.originalFilename)}`)
      reply.header('Cache-Control', 'private, max-age=3600')
      return reply.send(file.stream)
    } catch (error) {
      request.log.error(error, 'Ficheiro de documento ausente no armazenamento')
      return reply.code(404).send({ error: 'O ficheiro não está disponível no armazenamento' })
    }
  })

  await app.listen({ host: environment.VOYA_API_HOST, port: environment.VOYA_API_PORT })
}

await start()
