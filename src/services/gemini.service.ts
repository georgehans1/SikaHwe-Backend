import { GoogleGenAI } from '@google/genai'
import type { Environment } from '../config/environment.js'
import {
  type CategorizationRequest,
  type CategorizationResponse,
  categorizationResponseSchema,
  type StatisticsInsightsRequest,
  type StatisticsInsightsResponse,
  statisticsInsightsResponseSchema,
  type TransactionParseRequest,
  type TransactionParseResponse,
  transactionParseResponseSchema
} from '../schemas/api.js'

export class GeminiService {
  private readonly client: GoogleGenAI

  constructor(private readonly environment: Environment) {
    this.client = new GoogleGenAI({ apiKey: environment.GEMINI_API_KEY })
  }

  async generateStatisticsInsights(
    request: StatisticsInsightsRequest
  ): Promise<StatisticsInsightsResponse> {
    return this.generateStructured(
      `You are the monthly budget review assistant inside SikaHwe, a Ghanaian local-first budgeting app.
The supplied numbers were calculated by the app and are authoritative. Never recalculate, extrapolate, or invent values.
Return one to four concise, actionable observations grounded only in the supplied facts. Prioritise allocation accuracy, meaningful changes, unusually large spending, and practical budget adjustments.
Do not repeat the same fact in different words. Do not provide generic financial advice. Explain exactly what each comparison means.
Do not give investment, credit, tax, or legal advice. Use Ghana cedi wording where money is mentioned.

DATA:
${JSON.stringify(request)}`,
      {
        type: 'object',
        properties: {
          insights: {
            type: 'array',
            minItems: 1,
            maxItems: 4,
            items: {
              type: 'object',
              properties: {
                type: {
                  type: 'string',
                  enum: ['trend', 'allocation_warning', 'category', 'pattern', 'positive']
                },
                title: { type: 'string' },
                message: { type: 'string' },
                severity: {
                  type: 'string',
                  enum: ['information', 'positive', 'warning']
                },
                supportingValue: { type: 'string' }
              },
              required: ['type', 'title', 'message', 'severity']
            }
          }
        },
        required: ['insights']
      },
      statisticsInsightsResponseSchema
    )
  }

  async categorize(request: CategorizationRequest): Promise<CategorizationResponse> {
    const result = await this.generateStructured(
      `Suggest a category for this SikaHwe expense.
You may only return categoryId and budgetItemId values present in the supplied candidates.
Budget items are optional. Prefer no budget item when the evidence is weak.
Do not infer a plan assignment. Return confidence from 0 to 1 and a concise explanation.

DATA:
${JSON.stringify(request)}`,
      {
        type: 'object',
        properties: {
          cleanedMerchant: { type: 'string' },
          purchaseDescription: { type: 'string' },
          categoryId: { type: 'string' },
          budgetItemId: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          explanation: { type: 'string' }
        },
        required: ['confidence', 'explanation']
      },
      categorizationResponseSchema
    )

    const validCategoryIDs = new Set(request.categories.map((category) => category.id))
    const validItemIDs = new Set(request.budgetItems.map((item) => item.id))
    const categoryId = result.categoryId && validCategoryIDs.has(result.categoryId)
      ? result.categoryId
      : undefined
    const budgetItemId = result.budgetItemId && validItemIDs.has(result.budgetItemId)
      ? result.budgetItemId
      : undefined
    return {
      confidence: result.confidence,
      explanation: result.explanation,
      ...(result.cleanedMerchant
        ? { cleanedMerchant: result.cleanedMerchant }
        : {}),
      ...(result.purchaseDescription
        ? { purchaseDescription: result.purchaseDescription }
        : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(budgetItemId ? { budgetItemId } : {})
    }
  }

  async parseTransaction(request: TransactionParseRequest): Promise<TransactionParseResponse> {
    return this.generateStructured(
      `Extract one financial transaction from the supplied text.
Never invent an amount, date, reference, merchant, fee, or provider.
Use ISO 8601 for transactionDate when the source provides a date.
If a field is absent, omit it and add it to fieldsRequiringReview when it is important.
An expense is a debit, payment, purchase, cash out, or money sent. Income is a credit or money received.
Return confidence from 0 to 1.

PARSER HINT: ${request.parserHint}
TEXT:
${request.text}`,
      {
        type: 'object',
        properties: {
          transactionType: {
            type: 'string',
            enum: ['expense', 'income', 'unknown']
          },
          amountMinor: { type: 'integer', minimum: 0 },
          feeMinor: { type: 'integer', minimum: 0 },
          currencyCode: { type: 'string' },
          merchant: { type: 'string' },
          purchaseDescription: { type: 'string' },
          transactionDate: { type: 'string' },
          reference: { type: 'string' },
          provider: { type: 'string' },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          fieldsRequiringReview: {
            type: 'array',
            items: {
              type: 'string',
              enum: [
                'transactionType',
                'amount',
                'fee',
                'merchant',
                'purchaseDescription',
                'transactionDate',
                'reference',
                'provider'
              ]
            }
          }
        },
        required: [
          'transactionType',
          'feeMinor',
          'currencyCode',
          'confidence',
          'fieldsRequiringReview'
        ]
      },
      transactionParseResponseSchema
    )
  }

  private async generateStructured<T>(
    prompt: string,
    responseSchema: Record<string, unknown>,
    validator: { parse(value: unknown): T }
  ): Promise<T> {
    let lastFailure: Error | undefined

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await this.client.models.generateContent({
        model: this.environment.GEMINI_MODEL,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: responseSchema,
          maxOutputTokens: 4_096,
          abortSignal: AbortSignal.timeout(this.environment.REQUEST_TIMEOUT_MS)
        }
      })
      if (!response.text) {
        lastFailure = new Error('Gemini returned an empty response')
        continue
      }

      try {
        return validator.parse(JSON.parse(response.text))
      } catch (error) {
        const finishReason = response.candidates?.[0]?.finishReason ?? 'unknown'
        const message = error instanceof Error ? error.message : 'Unknown parsing error'
        lastFailure = new Error(
          `Gemini returned invalid structured JSON (finish reason: ${finishReason}): ${message}`
        )
      }
    }

    throw lastFailure ?? new Error('Gemini could not produce a structured response')
  }
}
