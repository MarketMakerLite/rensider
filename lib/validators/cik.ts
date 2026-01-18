/**
 * CIK (Central Index Key) Validator
 *
 * Validates SEC CIK identifiers used to identify filers.
 * Format: 1-10 digits (leading zeros are optional)
 * Examples: 0001318605, 1318605 (Tesla)
 */

import type { Validator, ValidationResult } from './index'

// Regex for valid CIKs: 1-10 digits
const CIK_REGEX = /^\d{1,10}$/

export const validateCik: Validator = {
  validate(value: string): ValidationResult {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `Expected string, got ${typeof value}`,
      }
    }

    const trimmed = value.trim()

    if (trimmed.length === 0) {
      return {
        valid: false,
        error: 'CIK cannot be empty',
      }
    }

    if (!CIK_REGEX.test(trimmed)) {
      return {
        valid: false,
        error: `Invalid CIK format: "${value}". Must be 1-10 digits`,
      }
    }

    // Normalize by removing leading zeros for storage consistency
    const normalized = trimmed.replace(/^0+/, '') || '0'

    return { valid: true, normalized }
  },

  assert(value: string): string {
    const result = this.validate(value)
    if (!result.valid) {
      throw new Error(result.error!)
    }
    return result.normalized!
  },
}

/**
 * Pad CIK with leading zeros to standard SEC format (10 digits)
 * Used when constructing SEC API URLs
 */
export function padCik(cik: string): string {
  const normalized = cik.replace(/^0+/, '') || '0'
  return normalized.padStart(10, '0')
}

/**
 * Normalize CIK by removing leading zeros
 * Used for database storage
 */
export function normalizeCik(cik: string): string {
  return cik.replace(/^0+/, '') || '0'
}
