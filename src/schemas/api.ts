import { z } from 'zod'

const identifier = z.string().uuid()
const moneyMinor = z.number().int().nonnegative()

export const categoryCandidateSchema = z.object({
  id: identifier,
  name: z.string().trim().min(1).max(100)
})

export const budgetItemCandidateSchema = z.object({
  id: identifier,
  categoryId: identifier.optional(),
  name: z.string().trim().min(1).max(140)
})

export const statisticsInsightsRequestSchema = z.object({
  period: z.string().trim().min(1).max(100),
  totalSpendMinor: moneyMinor,
  previousPeriodSpendMinor: moneyMinor.optional(),
  expenseCount: z.number().int().nonnegative(),
  averageExpenseMinor: moneyMinor,
  activeSpendingDayCount: z.number().int().nonnegative(),
  categories: z.array(z.object({
    name: z.string().trim().min(1).max(100),
    spendMinor: moneyMinor,
    allocationMinor: moneyMinor.optional(),
    transactionCount: z.number().int().nonnegative()
  })).max(30),
  periods: z.array(z.object({
    label: z.string().trim().min(1).max(50),
    spendMinor: moneyMinor
  })).max(60),
  largestExpenseMinor: moneyMinor.optional()
})

export const statisticsInsightSchema = z.object({
  type: z.enum([
    'trend',
    'allocation_warning',
    'category',
    'pattern',
    'positive'
  ]),
  title: z.string().trim().min(1).max(90),
  message: z.string().trim().min(1).max(280),
  severity: z.enum(['information', 'positive', 'warning']),
  supportingValue: z.string().trim().max(60).optional()
})

export const statisticsInsightsResponseSchema = z.object({
  insights: z.array(statisticsInsightSchema).min(1).max(4)
})

export const categorizationRequestSchema = z.object({
  merchant: z.string().trim().max(240).optional(),
  purchaseDescription: z.string().trim().max(300).optional(),
  transactionDescription: z.string().trim().max(1_500).optional(),
  categories: z.array(categoryCandidateSchema).min(1).max(100),
  budgetItems: z.array(budgetItemCandidateSchema).max(200)
})

export const categorizationResponseSchema = z.object({
  cleanedMerchant: z.string().trim().max(240).optional(),
  purchaseDescription: z.string().trim().max(300).optional(),
  categoryId: identifier.optional(),
  budgetItemId: identifier.optional(),
  confidence: z.number().min(0).max(1),
  explanation: z.string().trim().min(1).max(240)
})

export const transactionParseRequestSchema = z.object({
  text: z.string().trim().min(1).max(12_000),
  parserHint: z.enum(['auto', 'mobile_money', 'bank_email']).default('auto')
})

export const transactionParseResponseSchema = z.object({
  transactionType: z.enum(['expense', 'income', 'unknown']),
  amountMinor: moneyMinor.optional(),
  feeMinor: moneyMinor.default(0),
  currencyCode: z.string().trim().length(3).default('GHS'),
  merchant: z.string().trim().max(240).optional(),
  purchaseDescription: z.string().trim().max(300).optional(),
  transactionDate: z.string().trim().min(10).max(35).optional(),
  reference: z.string().trim().max(180).optional(),
  provider: z.string().trim().max(100).optional(),
  confidence: z.number().min(0).max(1),
  fieldsRequiringReview: z.array(z.enum([
    'transactionType',
    'amount',
    'fee',
    'merchant',
    'purchaseDescription',
    'transactionDate',
    'reference',
    'provider'
  ])).max(8)
})

export type StatisticsInsightsRequest = z.infer<typeof statisticsInsightsRequestSchema>
export type StatisticsInsightsResponse = z.infer<typeof statisticsInsightsResponseSchema>
export type CategorizationRequest = z.infer<typeof categorizationRequestSchema>
export type CategorizationResponse = z.infer<typeof categorizationResponseSchema>
export type TransactionParseRequest = z.infer<typeof transactionParseRequestSchema>
export type TransactionParseResponse = z.infer<typeof transactionParseResponseSchema>
