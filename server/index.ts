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
import { reminderDeliveryKey, scheduledReminderAt, type ReminderLeadMinutes } from './reminders/schedule.ts'
import { contextualChecklistLimit, tripPhase } from './today/context.ts'
import { googleMapsDirectionsUrl, googleMapsSearchUrl } from './maps/urls.ts'
import { computeTravelPreview, GoogleRoutesError, type TravelMode } from './maps/routes.ts'

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
const travelerProfileSchema = z.object({
  travelPace: z.enum(['relaxed', 'balanced', 'intense']),
  interests: z.array(z.enum(['art', 'history', 'food', 'nature', 'shopping', 'photography'])).max(6),
  dietaryNotes: z.string().trim().max(500),
  accessibilityNotes: z.string().trim().max(500),
  emergencyContactName: z.string().trim().max(120),
  emergencyContactPhone: z.string().trim().max(40),
  notes: z.string().trim().max(1000),
})
const budgetSchema = z.object({
  amount: z.number().finite().min(0).max(99_999_999.99),
})
const expenseSchema = z.object({
  title: z.string().trim().min(1).max(160),
  category: z.enum(['Hospedagem', 'Alimentação', 'Transporte', 'Ingressos', 'Compras', 'Outro']),
  amount: z.number().finite().positive().max(99_999_999.99),
  paidBy: z.string().uuid(),
  travelerIds: z.array(z.string().uuid()).min(1).max(20),
  spentAt: z.string().date(),
})
const todayQuerySchema = z.object({ date: z.string().date().optional() })
const activityCompletionSchema = z.object({ completed: z.boolean() })
const placeStatusSchema = z.object({ status: z.enum(['saved', 'planned', 'visited']) })
const reminderPreferencesSchema = z.object({
  enabled: z.boolean(),
  defaultLeadMinutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(1440)]),
})
const activityTimeSchema = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/).nullable()
const activityEditorSchema = z.object({
  dayDate: z.string().date(),
  title: z.string().trim().min(1).max(160),
  category: z.enum(['atracao', 'comboio', 'deslocamento', 'hospedagem', 'passeio', 'refeicao', 'tempo_livre', 'voo']),
  startTime: activityTimeSchema,
  endTime: activityTimeSchema,
  address: z.string().trim().max(500),
  notes: z.string().trim().max(2000),
  isImportant: z.boolean(),
  reminderLeadMinutes: z.union([z.literal(15), z.literal(30), z.literal(60), z.literal(1440)]).nullable(),
  reminderRecipientIds: z.array(z.string().uuid()).max(20),
}).superRefine((activity, context) => {
  if (activity.startTime && activity.endTime && activity.endTime <= activity.startTime) {
    context.addIssue({ code: 'custom', path: ['endTime'], message: 'O fim deve ser posterior ao início' })
  }
  if (activity.isImportant && activity.reminderRecipientIds.length === 0) {
    context.addIssue({ code: 'custom', path: ['reminderRecipientIds'], message: 'Escolha pelo menos um destinatário' })
  }
})
const databaseUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
)
const travelPreviewSchema = z.object({
  originActivityId: databaseUuidSchema,
  destinationActivityId: databaseUuidSchema,
  mode: z.enum(['WALK', 'TRANSIT', 'DRIVE']).default('WALK'),
}).refine((value) => value.originActivityId !== value.destinationActivityId)
const checklistItemSchema = z.object({
  groupId: databaseUuidSchema,
  title: z.string().trim().min(1).max(160),
})

function splitAmount(amount: number, travelerIds: string[]) {
  const uniqueIds = [...new Set(travelerIds)]
  const totalCents = Math.round(amount * 100)
  const baseCents = Math.floor(totalCents / uniqueIds.length)
  const remainder = totalCents % uniqueIds.length
  return uniqueIds.map((userId, index) => ({
    userId,
    amount: ((baseCents + (index < remainder ? 1 : 0)) / 100).toFixed(2),
  }))
}

function dateInTimezone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value)
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value
  return `${part('year')}-${part('month')}-${part('day')}`
}

function hashSessionToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

async function start() {
  const environment = readEnvironment()
  const sql = createDatabaseClient()
  const app = Fastify({ logger: true })
  const travelPreviewCache = new Map<string, { expiresAt: number; preview: { distanceMeters: number; durationSeconds: number; mode: TravelMode } }>()

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
    const [trip] = await sql<{ id: string; title: string; timezone: string }[]>`
      select t.id, t.title, t.timezone
      from trips t
      join trip_members tm on tm.trip_id = t.id
      where tm.user_id = ${userId}
      order by t.start_date desc
      limit 1
    `
    return trip ?? null
  }

  async function reconcileActivityReminders(activityId: string, now = new Date()) {
    await sql.begin(async (transaction) => {
      const [activity] = await transaction<{
        id: string
        startsAt: Date | null
        isImportant: boolean
        completed: boolean
        status: 'planned' | 'current' | 'completed' | 'cancelled'
        reminderLeadMinutes: ReminderLeadMinutes | null
      }[]>`
        select a.id, a.starts_at, a.is_important, a.status, a.reminder_lead_minutes,
               exists(select 1 from activity_completions ac where ac.activity_id = a.id) as completed
        from activities a where a.id = ${activityId}
      `

      await transaction`
        update reminder_jobs set status = 'cancelled', updated_at = now()
        where activity_id = ${activityId} and status in ('scheduled', 'processing')
      `
      if (!activity?.isImportant || activity.completed || !activity.startsAt || !['planned', 'current'].includes(activity.status)) return

      const recipients = await transaction<{
        userId: string
        defaultLeadMinutes: ReminderLeadMinutes
      }[]>`
        select arr.user_id, urp.default_lead_minutes
        from activity_reminder_recipients arr
        join user_reminder_preferences urp on urp.user_id = arr.user_id and urp.enabled
        where arr.activity_id = ${activity.id}
      `

      for (const recipient of recipients) {
        const leadMinutes = activity.reminderLeadMinutes ?? recipient.defaultLeadMinutes
        const scheduledFor = scheduledReminderAt(activity.startsAt, leadMinutes, now)
        if (!scheduledFor) continue
        const deliveryKey = reminderDeliveryKey({
          activityId: activity.id,
          userId: recipient.userId,
          startsAt: activity.startsAt,
          leadMinutes,
        })
        await transaction`
          insert into reminder_jobs (
            id, activity_id, user_id, delivery_key, lead_minutes, scheduled_for, status
          ) values (
            ${randomUUID()}, ${activity.id}, ${recipient.userId}, ${deliveryKey},
            ${leadMinutes}, ${scheduledFor}, 'scheduled'
          )
          on conflict (delivery_key) do update set
            lead_minutes = excluded.lead_minutes,
            scheduled_for = excluded.scheduled_for,
            status = case when reminder_jobs.status = 'sent' then 'sent' else 'scheduled' end,
            attempt_count = case when reminder_jobs.status = 'sent' then reminder_jobs.attempt_count else 0 end,
            last_error = case when reminder_jobs.status = 'sent' then reminder_jobs.last_error else null end,
            updated_at = now()
        `
      }
    })
  }

  async function reconcileUserReminders(userId: string) {
    const activities = await sql<{ id: string }[]>`
      select arr.activity_id as id
      from activity_reminder_recipients arr
      where arr.user_id = ${userId}
    `
    for (const activity of activities) await reconcileActivityReminders(activity.id)
  }

  async function reconcileAllReminders() {
    const activities = await sql<{ id: string }[]>`
      select id from activities where is_important and status in ('planned', 'current')
    `
    for (const activity of activities) await reconcileActivityReminders(activity.id)
  }

  async function getReminderScheduleSummary(userId: string) {
    const [summary] = await sql<{
      scheduledCount: string
      nextScheduledFor: Date | null
    }[]>`
      select count(*)::text as scheduled_count, min(scheduled_for) as next_scheduled_for
      from reminder_jobs
      where user_id = ${userId} and status = 'scheduled'
    `
    return {
      scheduledCount: Number(summary?.scheduledCount ?? 0),
      nextScheduledFor: summary?.nextScheduledFor ?? null,
    }
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

  app.get('/api/reminder-preferences', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para ver as preferências' })

    const [preferences] = await sql<{
      enabled: boolean
      defaultLeadMinutes: 15 | 30 | 60 | 1440
      updatedAt: Date
    }[]>`
      select enabled, default_lead_minutes, updated_at
      from user_reminder_preferences
      where user_id = ${user.id}
    `

    return {
      ...(preferences ?? { enabled: false, defaultLeadMinutes: 30, updatedAt: null }),
      schedule: await getReminderScheduleSummary(user.id),
    }
  })

  app.put('/api/reminder-preferences', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para alterar as preferências' })
    const body = reminderPreferencesSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: 'Preferências de lembrete inválidas' })

    const [preferences] = await sql<{
      enabled: boolean
      defaultLeadMinutes: 15 | 30 | 60 | 1440
      updatedAt: Date
    }[]>`
      insert into user_reminder_preferences (user_id, enabled, default_lead_minutes, updated_at)
      values (${user.id}, ${body.data.enabled}, ${body.data.defaultLeadMinutes}, now())
      on conflict (user_id) do update set
        enabled = excluded.enabled,
        default_lead_minutes = excluded.default_lead_minutes,
        updated_at = now()
      returning enabled, default_lead_minutes, updated_at
    `
    await reconcileUserReminders(user.id)
    return { ...preferences, schedule: await getReminderScheduleSummary(user.id) }
  })

  app.get('/api/travelers', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para ver os viajantes' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const travelers = await sql<{
      id: string
      displayName: string
      role: 'organizer' | 'traveler'
      travelPace: 'relaxed' | 'balanced' | 'intense'
      interests: string[]
      dietaryNotes: string
      accessibilityNotes: string
      emergencyContactName: string
      emergencyContactPhone: string
      notes: string
      updatedAt: Date | null
    }[]>`
      select u.id, u.display_name, tm.role,
             coalesce(tp.travel_pace, 'balanced') as travel_pace,
             coalesce(tp.interests, array[]::text[]) as interests,
             coalesce(tp.dietary_notes, '') as dietary_notes,
             coalesce(tp.accessibility_notes, '') as accessibility_notes,
             coalesce(tp.emergency_contact_name, '') as emergency_contact_name,
             coalesce(tp.emergency_contact_phone, '') as emergency_contact_phone,
             coalesce(tp.notes, '') as notes,
             tp.updated_at
      from trip_members tm
      join users u on u.id = tm.user_id
      left join traveler_profiles tp on tp.user_id = u.id
      where tm.trip_id = ${trip.id}
      order by case tm.role when 'organizer' then 0 else 1 end, u.display_name
    `

    return {
      trip,
      travelers: travelers.map((traveler) => ({
        ...traveler,
        canEdit: user.role === 'organizer' || traveler.id === user.id,
      })),
    }
  })

  app.put('/api/travelers/:id/profile', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para alterar preferências' })
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
    const body = travelerProfileSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: 'Preferências inválidas' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const [traveler] = await sql<{ id: string }[]>`
      select user_id as id from trip_members
      where trip_id = ${trip.id} and user_id = ${params.data.id}
    `
    if (!traveler) return reply.code(404).send({ error: 'Viajante não encontrado nesta viagem' })
    if (user.role !== 'organizer' && traveler.id !== user.id) {
      return reply.code(403).send({ error: 'Só pode alterar as suas próprias preferências' })
    }

    const [profile] = await sql<{
      travelPace: 'relaxed' | 'balanced' | 'intense'
      interests: string[]
      dietaryNotes: string
      accessibilityNotes: string
      emergencyContactName: string
      emergencyContactPhone: string
      notes: string
      updatedAt: Date
    }[]>`
      insert into traveler_profiles (
        user_id, travel_pace, interests, dietary_notes, accessibility_notes,
        emergency_contact_name, emergency_contact_phone, notes, updated_at
      ) values (
        ${traveler.id}, ${body.data.travelPace}, ${body.data.interests},
        ${body.data.dietaryNotes}, ${body.data.accessibilityNotes},
        ${body.data.emergencyContactName}, ${body.data.emergencyContactPhone},
        ${body.data.notes}, now()
      )
      on conflict (user_id) do update set
        travel_pace = excluded.travel_pace,
        interests = excluded.interests,
        dietary_notes = excluded.dietary_notes,
        accessibility_notes = excluded.accessibility_notes,
        emergency_contact_name = excluded.emergency_contact_name,
        emergency_contact_phone = excluded.emergency_contact_phone,
        notes = excluded.notes,
        updated_at = now()
      returning travel_pace, interests, dietary_notes, accessibility_notes,
                emergency_contact_name, emergency_contact_phone, notes, updated_at
    `
    return { profile }
  })

  app.get('/api/checklist', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para ver a checklist' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const groups = await sql<{
      id: string
      title: string
      ownerUserId: string | null
      ownerName: string | null
      position: number
    }[]>`
      select cg.id, cg.title, cg.owner_user_id, owner.display_name as owner_name, cg.position
      from checklist_groups cg
      left join users owner on owner.id = cg.owner_user_id
      where cg.trip_id = ${trip.id}
        and (cg.owner_user_id is null or cg.owner_user_id = ${user.id})
      order by case when cg.owner_user_id is null then 0 else 1 end, cg.position, cg.title
    `
    const groupIds = groups.map(({ id }) => id)
    const items = groupIds.length
      ? await sql<{
          id: string
          groupId: string
          title: string
          completedAt: Date | null
          completedByName: string | null
          position: number
        }[]>`
          select ci.id, ci.group_id, ci.title, ci.completed_at,
                 completed_by.display_name as completed_by_name, ci.position
          from checklist_items ci
          left join users completed_by on completed_by.id = ci.completed_by
          where ci.group_id in ${sql(groupIds)}
          order by ci.position, ci.title
        `
      : []

    return {
      trip,
      currentUser: user,
      groups: groups.map((group) => ({
        ...group,
        scope: group.ownerUserId ? 'personal' : 'family',
        canAddItems: group.ownerUserId === user.id || (group.ownerUserId === null && user.role === 'organizer'),
        items: items
          .filter((item) => item.groupId === group.id)
          .map((item) => ({ ...item, completed: Boolean(item.completedAt) })),
      })),
    }
  })

  app.post('/api/checklist/items', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para adicionar itens' })
    const body = checklistItemSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: 'Preencha o item e escolha uma lista' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const itemId = randomUUID()
    const item = await sql.begin(async (transaction) => {
      const [group] = await transaction<{ id: string; ownerUserId: string | null }[]>`
        select id, owner_user_id from checklist_groups
        where id = ${body.data.groupId} and trip_id = ${trip.id}
        for update
      `
      if (!group) return null
      const canAdd = group.ownerUserId === user.id || (group.ownerUserId === null && user.role === 'organizer')
      if (!canAdd) return false
      const [position] = await transaction<{ next: number }[]>`
        select coalesce(max(position), -1) + 1 as next
        from checklist_items where group_id = ${group.id}
      `
      const [created] = await transaction<{
        id: string
        title: string
        position: number
      }[]>`
        insert into checklist_items (id, group_id, title, position)
        values (${itemId}, ${group.id}, ${body.data.title}, ${position?.next ?? 0})
        returning id, title, position
      `
      return created
    })
    if (item === null) return reply.code(404).send({ error: 'Lista não encontrada' })
    if (item === false) return reply.code(403).send({ error: 'Não pode adicionar itens a esta lista' })
    return reply.code(201).send({
      item: { ...item, completed: false, completedAt: null, completedByName: null },
    })
  })

  app.put('/api/checklist/items/:id/completion', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para concluir itens' })
    const params = z.object({ id: databaseUuidSchema }).safeParse(request.params)
    const body = activityCompletionSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: 'Estado de conclusão inválido' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const [item] = await sql<{ id: string }[]>`
      select ci.id from checklist_items ci
      join checklist_groups cg on cg.id = ci.group_id
      where ci.id = ${params.data.id} and cg.trip_id = ${trip.id}
        and (cg.owner_user_id is null or cg.owner_user_id = ${user.id})
    `
    if (!item) return reply.code(404).send({ error: 'Item não encontrado nesta checklist' })

    if (body.data.completed) {
      const [completion] = await sql<{ completedAt: Date }[]>`
        update checklist_items
        set completed_by = ${user.id}, completed_at = now()
        where id = ${item.id}
        returning completed_at
      `
      return { completed: true, completedAt: completion.completedAt, completedByName: user.displayName }
    }
    await sql`
      update checklist_items set completed_by = null, completed_at = null
      where id = ${item.id}
    `
    return { completed: false, completedAt: null, completedByName: null }
  })

  app.get('/api/today', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para ver o seu dia' })
    const query = todayQuerySchema.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: 'Data inválida' })
    const currentTrip = await getCurrentTrip(user.id)
    if (!currentTrip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const [trip] = await sql<{
      id: string
      title: string
      startDate: string
      endDate: string
      timezone: string
      baseCurrency: string
      budgetAmount: string | null
    }[]>`
      select id, title, start_date::text, end_date::text, timezone,
             base_currency, budget_amount
      from trips where id = ${currentTrip.id}
    `
    if (!trip) return reply.code(404).send({ error: 'Viagem não encontrada' })

    const localDate = dateInTimezone(new Date(), trip.timezone)
    const checklistPhase = tripPhase(localDate, trip.startDate, trip.endDate)
    const checklistLimit = contextualChecklistLimit(checklistPhase)
    const [day] = query.data.date
      ? await sql<{ id: string; dayDate: string; city: string; position: number }[]>`
          select id, day_date::text, city, position from trip_days
          where trip_id = ${trip.id} and day_date = ${query.data.date}
        `
      : await sql<{ id: string; dayDate: string; city: string; position: number }[]>`
          select id, day_date::text, city, position from trip_days
          where trip_id = ${trip.id}
          order by
            case when day_date >= ${localDate} then 0 else 1 end,
            case when day_date >= ${localDate} then day_date end asc,
            case when day_date < ${localDate} then day_date end desc
          limit 1
        `
    if (!day) {
      return reply.code(404).send({ error: query.data.date ? 'Este dia não pertence à viagem' : 'O roteiro ainda não possui dias' })
    }

    const [previousDay] = await sql<{ dayDate: string }[]>`
      select day_date::text from trip_days
      where trip_id = ${trip.id} and position < ${day.position}
      order by position desc limit 1
    `
    const [nextDay] = await sql<{ dayDate: string }[]>`
      select day_date::text from trip_days
      where trip_id = ${trip.id} and position > ${day.position}
      order by position asc limit 1
    `
    const activities = await sql<{
      id: string
      title: string
      category: string
      startsAt: Date | null
      endsAt: Date | null
      time: string | null
      endTime: string | null
      address: string | null
      latitude: string | null
      longitude: string | null
      notes: string | null
      status: 'planned' | 'current' | 'completed' | 'cancelled'
      position: number
      completedAt: Date | null
      completedByName: string | null
      documents: Array<{
        id: string
        title: string
        category: string
        bookingCode: string | null
        mimeType: string
      }>
    }[]>`
      select a.id, a.title, a.category, a.starts_at, a.ends_at,
             to_char(a.starts_at at time zone ${trip.timezone}, 'HH24:MI') as time,
             to_char(a.ends_at at time zone ${trip.timezone}, 'HH24:MI') as end_time,
             a.address, a.latitude, a.longitude, a.notes, a.status, a.position,
             ac.completed_at, completed_by.display_name as completed_by_name,
             coalesce(
               (select jsonb_agg(jsonb_build_object(
                  'id', d.id, 'title', d.title, 'category', d.category,
                  'bookingCode', d.booking_code, 'mimeType', d.mime_type
                ) order by d.title)
                from document_activities da
                join documents d on d.id = da.document_id
                where da.activity_id = a.id),
               '[]'::jsonb
             ) as documents
      from activities a
      left join activity_completions ac on ac.activity_id = a.id
      left join users completed_by on completed_by.id = ac.completed_by
      where a.trip_day_id = ${day.id}
      order by a.position
    `

    const [expenseSummary] = await sql<{
      spentForDay: string
      totalSpent: string
    }[]>`
      select
        coalesce(sum(amount) filter (
          where (spent_at at time zone ${trip.timezone})::date = ${day.dayDate}
        ), 0)::text as spent_for_day,
        coalesce(sum(amount), 0)::text as total_spent
      from expenses where trip_id = ${trip.id}
    `
    const [checklistSummary] = await sql<{ pendingCount: string }[]>`
      select count(*)::text as pending_count
      from checklist_items ci
      join checklist_groups cg on cg.id = ci.group_id
      where cg.trip_id = ${trip.id}
        and ci.completed_at is null
        and (cg.owner_user_id is null or cg.owner_user_id = ${user.id})
    `
    const contextualChecklist = checklistLimit > 0
      ? await sql<{
          id: string
          title: string
          groupTitle: string
          scope: 'family' | 'personal'
          completedAt: Date | null
          completedByName: string | null
          position: number
        }[]>`
          select ci.id, ci.title, cg.title as group_title,
                 case when cg.owner_user_id is null then 'family' else 'personal' end as scope,
                 ci.completed_at, completed_by.display_name as completed_by_name, ci.position
          from checklist_items ci
          join checklist_groups cg on cg.id = ci.group_id
          left join users completed_by on completed_by.id = ci.completed_by
          where cg.trip_id = ${trip.id}
            and ci.completed_at is null
            and (cg.owner_user_id is null or cg.owner_user_id = ${user.id})
          order by ci.position, case when cg.owner_user_id is null then 0 else 1 end, cg.position
          limit ${checklistLimit}
        `
      : []
    const mode = day.dayDate === localDate ? 'today' : day.dayDate > localDate ? 'upcoming' : 'past'
    const normalizedActivities = activities.map((activity) => ({
      ...activity,
      completed: Boolean(activity.completedAt),
      mapsUrl: googleMapsSearchUrl({ ...activity, city: day.city }),
    }))
    const incomplete = normalizedActivities.filter((activity) => !activity.completed && activity.status !== 'cancelled')
    const now = Date.now()
    const current = mode === 'today'
      ? incomplete.find((activity) => activity.startsAt && activity.startsAt.getTime() <= now && (!activity.endsAt || activity.endsAt.getTime() > now))
      : undefined
    const upcoming = mode === 'today'
      ? incomplete.find((activity) => activity.startsAt && activity.startsAt.getTime() > now)
      : undefined
    const highlighted = current ?? upcoming ?? incomplete[0] ?? null
    const spentForDay = Number(expenseSummary?.spentForDay ?? 0)
    const totalSpent = Number(expenseSummary?.totalSpent ?? 0)
    const budgetAmount = Number(trip.budgetAmount ?? 0)

    return {
      user: { id: user.id, displayName: user.displayName },
      trip: {
        id: trip.id,
        title: trip.title,
        startDate: trip.startDate,
        endDate: trip.endDate,
        timezone: trip.timezone,
        currency: trip.baseCurrency,
      },
      day: {
        date: day.dayDate,
        city: day.city,
        mode,
        previousDate: previousDay?.dayDate ?? null,
        nextDate: nextDay?.dayDate ?? null,
      },
      activities: normalizedActivities,
      highlightedActivityId: highlighted?.id ?? null,
      checklist: {
        phase: checklistPhase,
        pendingCount: Number(checklistSummary?.pendingCount ?? 0),
        items: contextualChecklist.map((item) => ({ ...item, completed: Boolean(item.completedAt) })),
      },
      expenses: {
        spentForDay,
        totalSpent,
        budgetAmount,
        remaining: budgetAmount - totalSpent,
      },
    }
  })

  app.put('/api/activities/:id/completion', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para concluir atividades' })
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
    const body = activityCompletionSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: 'Estado de conclusão inválido' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })
    const [activity] = await sql<{ id: string }[]>`
      select a.id from activities a
      join trip_days td on td.id = a.trip_day_id
      where a.id = ${params.data.id} and td.trip_id = ${trip.id}
    `
    if (!activity) return reply.code(404).send({ error: 'Atividade não encontrada nesta viagem' })

    if (body.data.completed) {
      const [completion] = await sql<{ completedAt: Date }[]>`
        insert into activity_completions (activity_id, completed_by, completed_at)
        values (${activity.id}, ${user.id}, now())
        on conflict (activity_id) do update set completed_by = excluded.completed_by, completed_at = now()
        returning completed_at
      `
      await reconcileActivityReminders(activity.id)
      return { completed: true, completedAt: completion.completedAt, completedByName: user.displayName }
    }
    await sql`delete from activity_completions where activity_id = ${activity.id}`
    await reconcileActivityReminders(activity.id)
    return { completed: false, completedAt: null, completedByName: null }
  })

  app.post('/api/routes/preview', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para calcular o deslocamento' })
    if (!environment.GOOGLE_MAPS_SERVER_API_KEY) {
      return reply.code(503).send({ error: 'As estimativas de deslocamento ainda não estão configuradas' })
    }
    const body = travelPreviewSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: 'Escolha duas atividades válidas' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const ids = [body.data.originActivityId, body.data.destinationActivityId]
    const activities = await sql<{
      id: string
      title: string
      address: string | null
      city: string
      latitude: string | null
      longitude: string | null
      tripDayId: string
      updatedAt: Date
    }[]>`
      select a.id, a.title, a.address, td.city, a.latitude, a.longitude,
             a.trip_day_id, a.updated_at
      from activities a
      join trip_days td on td.id = a.trip_day_id
      where td.trip_id = ${trip.id} and a.id in ${sql(ids)}
    `
    if (activities.length !== 2) return reply.code(404).send({ error: 'Atividade não encontrada nesta viagem' })

    const origin = activities.find((activity) => activity.id === body.data.originActivityId)!
    const destination = activities.find((activity) => activity.id === body.data.destinationActivityId)!
    if (origin.tripDayId !== destination.tripDayId) {
      return reply.code(400).send({ error: 'As atividades devem pertencer ao mesmo dia' })
    }
    if (!origin.address || !destination.address) {
      return reply.code(422).send({ error: 'Defina o local das duas atividades para calcular o deslocamento' })
    }

    const cacheKey = [origin.id, origin.updatedAt.toISOString(), destination.id, destination.updatedAt.toISOString(), body.data.mode].join(':')
    const cached = travelPreviewCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return { ...cached.preview, originTitle: origin.title, destinationTitle: destination.title, cached: true }
    }

    try {
      const preview = await computeTravelPreview({
        apiKey: environment.GOOGLE_MAPS_SERVER_API_KEY,
        origin: { ...origin, address: origin.address },
        destination: { ...destination, address: destination.address },
        mode: body.data.mode,
      })
      travelPreviewCache.set(cacheKey, { expiresAt: Date.now() + 15 * 60_000, preview })
      return { ...preview, originTitle: origin.title, destinationTitle: destination.title, cached: false }
    } catch (error) {
      request.log.warn({ err: error }, 'Não foi possível calcular o deslocamento')
      if (error instanceof GoogleRoutesError && error.statusCode === 404) {
        return reply.code(404).send({ error: 'Não foi encontrado um percurso neste modo entre estes locais' })
      }
      return reply.code(502).send({ error: 'O Google Maps não conseguiu calcular esta estimativa agora' })
    }
  })

  app.get('/api/places', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para ver os lugares' })

    const savedPlaces = await sql<{
      id: string
      name: string
      category: string
      city: string | null
      address: string | null
      latitude: string | null
      longitude: string | null
      mapsUrl: string | null
      status: 'saved' | 'planned' | 'visited'
    }[]>`
      select p.id, p.name, p.category, p.city, p.address, p.latitude, p.longitude,
             p.maps_url, p.status
      from places p
      join household_members viewer
        on viewer.household_id = p.household_id and viewer.user_id = ${user.id}
      order by
        case p.status when 'planned' then 0 when 'saved' then 1 else 2 end,
        p.city nulls last,
        p.name
    `

    return {
      places: savedPlaces.map((place) => {
        const location = { ...place, title: place.name }
        return {
          ...place,
          mapsUrl: place.mapsUrl ?? googleMapsSearchUrl(location),
          directionsUrl: googleMapsDirectionsUrl(location),
        }
      }),
    }
  })

  app.put('/api/places/:id/status', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para organizar os lugares' })
    const params = z.object({ id: databaseUuidSchema }).safeParse(request.params)
    const body = placeStatusSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: 'Estado do lugar inválido' })

    const [place] = await sql<{ id: string; status: 'saved' | 'planned' | 'visited' }[]>`
      update places p
      set status = ${body.data.status}
      from household_members viewer
      where p.id = ${params.data.id}
        and viewer.household_id = p.household_id
        and viewer.user_id = ${user.id}
      returning p.id, p.status
    `
    if (!place) return reply.code(404).send({ error: 'Lugar não encontrado nesta família' })
    return place
  })

  app.get('/api/budget', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para ver o orçamento' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const [budget] = await sql<{ amount: string | null }[]>`
      select budget_amount as amount from trips where id = ${trip.id}
    `
    const travelers = await sql<{ id: string; displayName: string }[]>`
      select u.id, u.display_name
      from trip_members tm
      join users u on u.id = tm.user_id
      where tm.trip_id = ${trip.id}
      order by case tm.role when 'organizer' then 0 else 1 end, u.display_name
    `
    const expenses = await sql<{
      id: string
      title: string
      category: string
      amount: string
      currency: string
      spentAt: Date
      createdAt: Date
      paidBy: string
      paidByName: string
      splits: Array<{ userId: string; amount: number }>
    }[]>`
      select e.id, e.title, e.category, e.amount, e.currency, e.spent_at,
             e.created_at, e.paid_by, payer.display_name as paid_by_name,
             coalesce(
               jsonb_agg(jsonb_build_object('userId', es.user_id, 'amount', es.amount)
                 order by member.display_name) filter (where es.user_id is not null),
               '[]'::jsonb
             ) as splits
      from expenses e
      join users payer on payer.id = e.paid_by
      left join expense_splits es on es.expense_id = e.id
      left join users member on member.id = es.user_id
      where e.trip_id = ${trip.id}
      group by e.id, payer.display_name
      order by e.spent_at desc, e.created_at desc
    `

    return {
      trip: { ...trip, budgetAmount: Number(budget?.amount ?? 0), currency: 'EUR' },
      travelers,
      expenses: expenses.map((expense) => ({
        ...expense,
        amount: Number(expense.amount),
        splits: expense.splits.map((split) => ({ ...split, amount: Number(split.amount) })),
        canDelete: user.role === 'organizer' || expense.paidBy === user.id,
      })),
      canEditBudget: user.role === 'organizer',
    }
  })

  app.put('/api/budget', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para alterar o orçamento' })
    if (user.role !== 'organizer') return reply.code(403).send({ error: 'Só o organizador pode alterar o orçamento' })
    const body = budgetSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: 'Valor de orçamento inválido' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const [updated] = await sql<{ amount: string }[]>`
      update trips set budget_amount = ${body.data.amount.toFixed(2)}
      where id = ${trip.id}
      returning budget_amount as amount
    `
    return { budgetAmount: Number(updated.amount) }
  })

  app.post('/api/expenses', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para adicionar uma despesa' })
    const body = expenseSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: 'Dados da despesa inválidos' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const memberIds = [...new Set([body.data.paidBy, ...body.data.travelerIds])]
    const members = await sql<{ id: string }[]>`
      select user_id as id from trip_members
      where trip_id = ${trip.id} and user_id in ${sql(memberIds)}
    `
    if (members.length !== memberIds.length) {
      return reply.code(400).send({ error: 'Todos os participantes devem pertencer à viagem' })
    }

    const expenseId = randomUUID()
    const splits = splitAmount(body.data.amount, body.data.travelerIds)
    await sql.begin(async (transaction) => {
      await transaction`
        insert into expenses (id, trip_id, paid_by, title, category, amount, currency, spent_at)
        values (
          ${expenseId}, ${trip.id}, ${body.data.paidBy}, ${body.data.title},
          ${body.data.category}, ${body.data.amount.toFixed(2)}, 'EUR',
          ${new Date(`${body.data.spentAt}T12:00:00Z`)}
        )
      `
      for (const split of splits) {
        await transaction`
          insert into expense_splits (expense_id, user_id, amount)
          values (${expenseId}, ${split.userId}, ${split.amount})
        `
      }
    })
    return reply.code(201).send({ id: expenseId })
  })

  app.delete('/api/expenses/:id', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para apagar uma despesa' })
    const params = z.object({ id: z.string().uuid() }).safeParse(request.params)
    if (!params.success) return reply.code(400).send({ error: 'Despesa inválida' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const [expense] = await sql<{ paidBy: string }[]>`
      select paid_by from expenses where id = ${params.data.id} and trip_id = ${trip.id}
    `
    if (!expense) return reply.code(404).send({ error: 'Despesa não encontrada' })
    if (user.role !== 'organizer' && expense.paidBy !== user.id) {
      return reply.code(403).send({ error: 'Só quem pagou ou o organizador pode apagar esta despesa' })
    }
    await sql`delete from expenses where id = ${params.data.id}`
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
      isImportant: boolean
      reminderLeadMinutes: 15 | 30 | 60 | 1440 | null
      reminderRecipientIds: string[]
      position: number
      dayPosition: number
    }[]>`
      select a.id, a.source_key, a.title, a.category, td.day_date::text,
             td.city, to_char(a.starts_at at time zone ${trip.timezone}, 'HH24:MI') as time,
             to_char(a.ends_at at time zone ${trip.timezone}, 'HH24:MI') as end_time,
             a.address, a.notes, a.status, a.is_important, a.reminder_lead_minutes,
             coalesce(
               (select array_agg(arr.user_id order by arr.created_at)
                from activity_reminder_recipients arr where arr.activity_id = a.id),
               array[]::uuid[]
             ) as reminder_recipient_ids,
             a.position, td.position as day_position
      from activities a
      join trip_days td on td.id = a.trip_day_id
      where td.trip_id = ${trip.id}
      order by td.position, a.position
    `

    return { trip, documents, activities }
  })

  app.post('/api/activities', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para adicionar uma atividade' })
    if (user.role !== 'organizer') return reply.code(403).send({ error: 'Só o organizador pode alterar o roteiro' })
    const body = activityEditorSchema.safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: 'Preencha os dados da atividade corretamente' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const [day] = await sql<{ id: string }[]>`
      select id from trip_days where trip_id = ${trip.id} and day_date = ${body.data.dayDate}
    `
    if (!day) return reply.code(404).send({ error: 'Dia não encontrado nesta viagem' })

    const recipientIds = body.data.isImportant ? [...new Set(body.data.reminderRecipientIds)] : []
    const recipients = recipientIds.length ? await sql<{ id: string }[]>`
      select user_id as id from trip_members
      where trip_id = ${trip.id} and user_id in ${sql(recipientIds)}
    ` : []
    if (recipients.length !== recipientIds.length) {
      return reply.code(400).send({ error: 'Um dos destinatários não pertence a esta viagem' })
    }

    const activityId = randomUUID()
    const startLocal = body.data.startTime ? `${body.data.dayDate}T${body.data.startTime}:00` : null
    const endLocal = body.data.endTime ? `${body.data.dayDate}T${body.data.endTime}:00` : null
    await sql.begin(async (transaction) => {
      await transaction`
        insert into activities (
          id, trip_day_id, title, category, starts_at, ends_at, address, notes,
          is_important, reminder_lead_minutes, status, position
        ) values (
          ${activityId}, ${day.id}, ${body.data.title}, ${body.data.category},
          ${startLocal}::timestamp at time zone ${trip.timezone},
          ${endLocal}::timestamp at time zone ${trip.timezone},
          ${body.data.address || null}, ${body.data.notes || null},
          ${body.data.isImportant}, ${body.data.isImportant ? body.data.reminderLeadMinutes : null}, 'planned',
          (select coalesce(max(position), -1) + 1 from activities where trip_day_id = ${day.id})
        )
      `
      for (const recipientId of recipientIds) {
        await transaction`insert into activity_reminder_recipients (activity_id, user_id) values (${activityId}, ${recipientId})`
      }
    })
    await reconcileActivityReminders(activityId)
    return reply.code(201).send({ id: activityId })
  })

  app.put('/api/activities/:id', async (request, reply) => {
    const user = await authenticate(request)
    if (!user) return reply.code(401).send({ error: 'Inicie sessão para alterar uma atividade' })
    if (user.role !== 'organizer') return reply.code(403).send({ error: 'Só o organizador pode alterar o roteiro' })
    const params = z.object({ id: databaseUuidSchema }).safeParse(request.params)
    const body = activityEditorSchema.safeParse(request.body)
    if (!params.success || !body.success) return reply.code(400).send({ error: 'Dados da atividade inválidos' })
    const trip = await getCurrentTrip(user.id)
    if (!trip) return reply.code(409).send({ error: 'A viagem inicial ainda não foi criada' })

    const [activity] = await sql<{ id: string; dayDate: string }[]>`
      select a.id, td.day_date::text
      from activities a join trip_days td on td.id = a.trip_day_id
      where a.id = ${params.data.id} and td.trip_id = ${trip.id}
    `
    if (!activity) return reply.code(404).send({ error: 'Atividade não encontrada nesta viagem' })
    if (activity.dayDate !== body.data.dayDate) return reply.code(400).send({ error: 'Não é possível mover a atividade entre dias neste editor' })

    const recipientIds = body.data.isImportant ? [...new Set(body.data.reminderRecipientIds)] : []
    const recipients = recipientIds.length ? await sql<{ id: string }[]>`
      select user_id as id from trip_members
      where trip_id = ${trip.id} and user_id in ${sql(recipientIds)}
    ` : []
    if (recipients.length !== recipientIds.length) {
      return reply.code(400).send({ error: 'Um dos destinatários não pertence a esta viagem' })
    }

    const startLocal = body.data.startTime ? `${body.data.dayDate}T${body.data.startTime}:00` : null
    const endLocal = body.data.endTime ? `${body.data.dayDate}T${body.data.endTime}:00` : null
    await sql.begin(async (transaction) => {
      await transaction`
        update activities set
          title = ${body.data.title}, category = ${body.data.category},
          starts_at = ${startLocal}::timestamp at time zone ${trip.timezone},
          ends_at = ${endLocal}::timestamp at time zone ${trip.timezone},
          address = ${body.data.address || null}, notes = ${body.data.notes || null},
          is_important = ${body.data.isImportant},
          reminder_lead_minutes = ${body.data.isImportant ? body.data.reminderLeadMinutes : null},
          updated_at = now()
        where id = ${activity.id}
      `
      await transaction`delete from activity_reminder_recipients where activity_id = ${activity.id}`
      for (const recipientId of recipientIds) {
        await transaction`insert into activity_reminder_recipients (activity_id, user_id) values (${activity.id}, ${recipientId})`
      }
    })
    await reconcileActivityReminders(activity.id)
    return { id: activity.id }
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

  await reconcileAllReminders()
  await app.listen({ host: environment.VOYA_API_HOST, port: environment.VOYA_API_PORT })
}

await start()
