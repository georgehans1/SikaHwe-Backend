import { z } from 'zod'

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  HOST: z.string().min(1).default('0.0.0.0'),
  GEMINI_API_KEY: z.string().min(1),
  GEMINI_MODEL: z.string().min(1).default('gemini-2.5-flash'),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(60),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  MAX_REQUEST_BYTES: z.coerce.number().int().positive().default(32_768)
})

export type Environment = z.infer<typeof environmentSchema>

export function loadEnvironment(values: NodeJS.ProcessEnv = process.env): Environment {
  const result = environmentSchema.safeParse(values)
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join(', ')
    throw new Error(`Invalid environment configuration: ${details}`)
  }
  return result.data
}
