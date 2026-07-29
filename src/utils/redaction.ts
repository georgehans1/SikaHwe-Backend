const accountNumberPattern = /\b\d{3,6}[*xX•]+\d{2,6}\b/g
const phoneNumberPattern = /\b(?:\+?233|0)\d{9}\b/g
const longReferencePattern = /\b[A-Z0-9-]{18,}\b/gi

export function redactSensitiveText(value: string): string {
  return value
    .replace(accountNumberPattern, '[REDACTED ACCOUNT]')
    .replace(phoneNumberPattern, '[REDACTED PHONE]')
    .replace(longReferencePattern, '[REDACTED REFERENCE]')
}

export function redactUnknownValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return redactSensitiveText(value)
  }
  if (Array.isArray(value)) {
    return value.map(redactUnknownValue)
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, redactUnknownValue(entry)])
    )
  }
  return value
}
