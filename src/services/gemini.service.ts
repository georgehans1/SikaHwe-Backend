import { GoogleGenAI } from '@google/genai'
import type { Environment } from '../config/environment.js'
import {
  type AskInterpretRequest,
  type AskInterpretResponse,
  askInterpretResponseSchema,
  type CategorizationRequest,
  type CategorizationResponse,
  categorizationResponseSchema,
  type ReceiptParseRequest,
  type ReceiptParseResponse,
  receiptParseResponseSchema,
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

  async interpretQuestion(request: AskInterpretRequest): Promise<AskInterpretResponse> {
    const result = await this.generateStructured(
      `Translate one user question into a supported local SikaHwe query operation.
The iOS app will execute the query and calculate every financial value locally. You must not answer the financial question, calculate money, or invent transaction data.
Choose exactly one operation from supportedOperations.

Operation guidance:
- total_spend: total or average spending and expense count
- top_categories: category ranking
- top_purchases: purchased item or purchase-description ranking
- top_merchants: merchant or payee ranking
- categories_over_allocation: monthly categories above allocation
- largest_expenses: largest individual transactions
- repeated_merchants: merchants paid more than once
- find_transactions: locate transactions using any combination of text, merchant, category, source, amount range, or date range. Use searchTerm only for genuine free-text matching.
- compare_previous_budget: compare the selected monthly budget with the previous monthly plan
- explain_available_to_allocate: explain the monthly planning buffer
- remaining_budget: total budget minus actual spending for the selected monthly plan
- budget_forecast: estimate whether the selected monthly plan is likely to exceed its budget
- allocation_accuracy: compare category allocations with their actual spending
- uncategorized_expenses: find expenses that still need a category
- outside_budget_period: find expenses assigned outside the selected monthly plan's configured spending dates
- likely_duplicates: find possible duplicate expense records
- outstanding_commitments: list unpaid or unresolved recurring commitments
- close_monthly_budget: prepare a confirmed action to close the selected monthly budget; use only when the user explicitly asks to close it

If the question is ambiguous, choose the closest safe operation, lower confidence, and provide a concise clarification. Use a result limit from 1 to 12.
Resolve relative dates such as today, yesterday, last Friday, or 14 August using currentDate and timeZoneIdentifier. Return dateStart inclusive and dateEndExclusive exclusive as ISO 8601 instants. Use previousQuestion only to understand a direct follow-up; never copy its filters unless the new question refers to them.

DATA:
${JSON.stringify(request)}`,
      {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            enum: request.supportedOperations
          },
          searchTerm: { type: 'string' },
          limit: { type: 'integer', minimum: 1, maximum: 12 },
          confidence: { type: 'number', minimum: 0, maximum: 1 },
          clarification: { type: 'string' },
          dateStart: { type: 'string' },
          dateEndExclusive: { type: 'string' },
          minimumAmountMinor: { type: 'integer', minimum: 0 },
          maximumAmountMinor: { type: 'integer', minimum: 0 },
          categoryName: { type: 'string' },
          merchantName: { type: 'string' },
          sourceName: { type: 'string' }
        },
        required: ['operation', 'limit', 'confidence']
      },
      askInterpretResponseSchema
    )

    if (!request.supportedOperations.includes(result.operation)) {
      throw new Error('Gemini selected an unsupported Ask SikaHwe operation')
    }
    return result
  }

  async parseReceipt(request: ReceiptParseRequest): Promise<ReceiptParseResponse> {
    const result = await this.generateStructured(
      `Extract the purchase details from one receipt using only the supplied on-device OCR text and layout blocks.
Never invent a merchant, date, amount, adjustment, or line item. Amounts must be nonnegative integer minor currency units. Use ISO 8601 for transactionDate when a date is visible. Return a three-letter uppercase currencyCode, defaulting to GHS only when the receipt uses Ghana cedi notation.

For each line item, amountMinor is that line's full amount after quantity, not a unit price. If quantity is returned, it must be greater than zero. taxMinor, feeMinor, and discountMinor must be zero when absent. When OCR contains every line, the values should satisfy exactly:
sum(lineItems.amountMinor) + taxMinor + feeMinor - discountMinor = totalMinor.
If OCR is incomplete, preserve the known total, return only defensible line items, allow that equation not to balance, and include lineItems in fieldsRequiringReview. Never fabricate a balancing item. subtotalMinor is optional and must only be returned when printed on the receipt. Confidence is from 0 to 1.

OCR DATA:
${JSON.stringify(request)}`,
      {
        type: 'object',
        properties: {
          merchant: { type: 'string' },
          transactionDate: { type: 'string' },
          totalMinor: { type: 'integer' },
          subtotalMinor: { type: 'integer' },
          taxMinor: { type: 'integer' },
          feeMinor: { type: 'integer' },
          discountMinor: { type: 'integer' },
          currencyCode: { type: 'string' },
          lineItems: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                description: { type: 'string' },
                quantity: { type: 'number' },
                amountMinor: { type: 'integer' }
              },
              required: ['description', 'amountMinor']
            }
          },
          confidence: { type: 'number' },
          fieldsRequiringReview: {
            type: 'array',
            items: { type: 'string' }
          }
        },
        required: [
          'totalMinor',
          'taxMinor',
          'feeMinor',
          'discountMinor',
          'currencyCode',
          'lineItems',
          'confidence',
          'fieldsRequiringReview'
        ]
      },
      receiptParseResponseSchema
    )

    const reconciledTotal = result.lineItems.reduce(
      (sum, item) => sum + item.amountMinor,
      0
    ) + result.taxMinor + result.feeMinor - result.discountMinor
    const fieldsRequiringReview = reconciledTotal === result.totalMinor
      ? result.fieldsRequiringReview
      : Array.from(new Set([...result.fieldsRequiringReview, 'lineItems']))
    return {
      ...result,
      currencyCode: result.currencyCode.toUpperCase(),
      fieldsRequiringReview
    }
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
