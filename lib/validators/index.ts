/**
 * Centralized Validators
 *
 * Provides format validation and normalization for all data types used in the application.
 * Used at API boundaries, database insert functions, and for data integrity checks.
 */

export interface ValidationResult {
  valid: boolean
  normalized?: string
  error?: string
  /** For CUSIP validation - indicates if check digit is valid */
  checkDigitValid?: boolean
  /** Additional metadata from validation */
  metadata?: Record<string, unknown>
}

export interface Validator<T = string> {
  validate(value: T): ValidationResult
  assert(value: T): string // Throws on invalid, returns normalized value
}

export { validateTicker } from './ticker'
export { validateCusip, calculateCusipCheckDigit } from './cusip'
export { validateCik, padCik, normalizeCik } from './cik'
export { validateQuarter, validateTimestamp, parseDate, parseDateToTimestamp, dateToQuarter } from './dates'
export { validateIsin, calculateIsinCheckDigit } from './isin'
