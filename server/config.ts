import { z } from 'zod'

const environmentSchema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  POSTGRES_ADMIN_URL: z.string().url().startsWith('postgresql://').optional(),
  VOYA_DATABASE_PASSWORD: z.string().min(16).optional(),
  VOYA_API_HOST: z.string().default('127.0.0.1'),
  VOYA_API_PORT: z.coerce.number().int().positive().default(3333),
  VOYA_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
  VOYA_DOCUMENTS_PATH: z.string().min(1).default('./.data/documents'),
  VOYA_MAX_DOCUMENT_SIZE_MB: z.coerce.number().int().min(1).max(100).default(25),
  VOYA_WEB_ROOT: z.string().min(1).optional(),
  GOOGLE_MAPS_SERVER_API_KEY: z.string().min(20).optional(),
})

export type Environment = z.infer<typeof environmentSchema>

export function readEnvironment(): Environment {
  const result = environmentSchema.safeParse(process.env)

  if (!result.success) {
    const fields = result.error.issues.map((issue) => issue.path.join('.')).join(', ')
    throw new Error(`Configuração inválida ou ausente: ${fields}`)
  }

  return result.data
}
