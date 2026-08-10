import { z } from 'zod'

const environmentSchema = z.object({
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  POSTGRES_ADMIN_URL: z.string().url().startsWith('postgresql://').optional(),
  VOYA_DATABASE_PASSWORD: z.string().min(16).optional(),
  VOYA_API_HOST: z.string().default('127.0.0.1'),
  VOYA_API_PORT: z.coerce.number().int().positive().default(3333),
  VOYA_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
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
