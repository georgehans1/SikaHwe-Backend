import type { FastifyInstance } from 'fastify'
import type { GeminiService } from '../services/gemini.service.js'
import {
  categorizationRequestSchema,
  statisticsInsightsRequestSchema,
  transactionParseRequestSchema
} from '../schemas/api.js'
import { redactSensitiveText } from '../utils/redaction.js'

interface AIRouteDependencies {
  geminiService: GeminiService
}

export async function registerAIRoutes(
  app: FastifyInstance,
  dependencies: AIRouteDependencies
): Promise<void> {
  app.post('/v1/ai/statistics-insights', async (request) => {
    const input = statisticsInsightsRequestSchema.parse(request.body)
    const data = await dependencies.geminiService.generateStatisticsInsights(input)
    return { success: true, data }
  })

  app.post('/v1/ai/categorize', async (request) => {
    const input = categorizationRequestSchema.parse(request.body)
    const redactedInput = {
      categories: input.categories,
      budgetItems: input.budgetItems,
      ...(input.merchant
        ? { merchant: redactSensitiveText(input.merchant) }
        : {}),
      ...(input.purchaseDescription
        ? { purchaseDescription: redactSensitiveText(input.purchaseDescription) }
        : {}),
      ...(input.transactionDescription
        ? { transactionDescription: redactSensitiveText(input.transactionDescription) }
        : {})
    }
    const data = await dependencies.geminiService.categorize(redactedInput)
    return { success: true, data }
  })

  app.post('/v1/ai/parse-transaction', async (request) => {
    const input = transactionParseRequestSchema.parse(request.body)
    const data = await dependencies.geminiService.parseTransaction({
      ...input,
      text: redactSensitiveText(input.text)
    })
    return { success: true, data }
  })
}
