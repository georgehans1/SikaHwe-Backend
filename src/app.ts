import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import Fastify, { type FastifyInstance } from 'fastify'
import { ZodError } from 'zod'
import type { Environment } from './config/environment.js'
import { registerAIRoutes } from './routes/ai.route.js'
import { GeminiService } from './services/gemini.service.js'

export async function createApp(environment: Environment): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: environment.NODE_ENV === 'production' ? 'info' : 'debug',
      redact: {
        paths: ['req.body', 'request.body', 'body', 'headers.authorization'],
        censor: '[REDACTED]'
      }
    },
    bodyLimit: environment.MAX_REQUEST_BYTES,
    requestTimeout: environment.REQUEST_TIMEOUT_MS,
    trustProxy: true
  })

  await app.register(helmet)
  await app.register(rateLimit, {
    max: environment.RATE_LIMIT_MAX,
    timeWindow: environment.RATE_LIMIT_WINDOW_MS,
    keyGenerator: (request) => {
      const installationID = request.headers['x-sikahwe-installation-id']
      return typeof installationID === 'string' && installationID.length <= 100
        ? `${request.ip}:${installationID}`
        : request.ip
    }
  })

  app.get('/health', async () => ({
    success: true,
    data: { status: 'ok' }
  }))

  await registerAIRoutes(app, {
    geminiService: new GeminiService(environment)
  })

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: 'The request was invalid.',
        details: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message
        }))
      })
    }

    const normalizedError = error instanceof Error
      ? error
      : new Error('Unknown backend error')
    const statusCode = (
      typeof error === 'object' &&
      error !== null &&
      'statusCode' in error &&
      typeof error.statusCode === 'number' &&
      error.statusCode >= 400
    )
      ? error.statusCode
      : 502

    request.log.error({
      errorName: normalizedError.name,
      errorMessage: normalizedError.message,
      requestID: request.id
    }, 'Request failed')

    return reply.status(statusCode).send({
      success: false,
      error: statusCode === 429
        ? 'Too many requests. Please try again later.'
        : 'The AI service could not complete the request.'
    })
  })

  return app
}
