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

export const askOperationSchema = z.enum([
  'total_spend',
  'top_categories',
  'top_purchases',
  'top_merchants',
  'categories_over_allocation',
  'largest_expenses',
  'repeated_merchants',
  'find_transactions',
  'compare_previous_budget',
  'explain_available_to_allocate'
])

export const askInterpretRequestSchema = z.object({
  question: z.string().trim().min(2).max(500),
  scopeTitle: z.string().trim().min(1).max(160),
  planType: z.enum(['monthly', 'annual', 'project', 'all_data', 'unknown']),
  availableCategories: z.array(z.string().trim().min(1).max(100)).max(100),
  supportedOperations: z.array(askOperationSchema).min(1).max(20)
})

export const askInterpretResponseSchema = z.object({
  operation: askOperationSchema,
  searchTerm: z.string().trim().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(12).default(5),
  confidence: z.number().min(0).max(1),
  clarification: z.string().trim().min(1).max(240).optional()
}).superRefine((value, context) => {
  if (value.operation === 'find_transactions' && !value.searchTerm) {
    context.addIssue({
      code: 'custom',
      path: ['searchTerm'],
      message: 'searchTerm is required for find_transactions'
    })
  }
})

export const receiptTextBlockSchema = z.object({
  text: z.string().trim().min(1).max(500),
  // Vision normally produces normalized coordinates, but edge detections can
  // exceed 0...1 by tiny floating-point amounts. Normalize at the route edge.
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite(),
  height: z.number().finite()
})

export const receiptParseRequestSchema = z.object({
  text: z.string().trim().min(1).max(12_000),
  blocks: z.array(receiptTextBlockSchema).max(300)
})

export const receiptLineItemSchema = z.object({
  description: z.string().trim().min(1).max(300),
  quantity: z.number().finite().positive().max(10_000).optional(),
  amountMinor: moneyMinor
})

export const receiptParseResponseSchema = z.object({
  merchant: z.string().trim().min(1).max(240).optional(),
  transactionDate: z.string().trim().min(10).max(35).optional(),
  totalMinor: moneyMinor,
  subtotalMinor: moneyMinor.optional(),
  taxMinor: moneyMinor,
  feeMinor: moneyMinor,
  discountMinor: moneyMinor,
  currencyCode: z.string().trim().length(3),
  lineItems: z.array(receiptLineItemSchema).max(100),
  confidence: z.number().min(0).max(1),
  fieldsRequiringReview: z.array(z.string().trim().min(1).max(100)).max(20)
})

export type StatisticsInsightsRequest = z.infer<typeof statisticsInsightsRequestSchema>
export type StatisticsInsightsResponse = z.infer<typeof statisticsInsightsResponseSchema>
export type CategorizationRequest = z.infer<typeof categorizationRequestSchema>
export type CategorizationResponse = z.infer<typeof categorizationResponseSchema>
export type TransactionParseRequest = z.infer<typeof transactionParseRequestSchema>
export type TransactionParseResponse = z.infer<typeof transactionParseResponseSchema>
export type AskInterpretRequest = z.infer<typeof askInterpretRequestSchema>
export type AskInterpretResponse = z.infer<typeof askInterpretResponseSchema>
export type ReceiptParseRequest = z.infer<typeof receiptParseRequestSchema>
export type ReceiptParseResponse = z.infer<typeof receiptParseResponseSchema>
