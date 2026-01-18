/**
 * CUSIP Validator
 *
 * Validates CUSIP (Committee on Uniform Securities Identification Procedures) identifiers.
 * Supports multiple formats:
 *   - 9 characters: Full CUSIP (6 issuer + 2 issue + 1 check digit)
 *   - 8 characters: CUSIP without check digit
 *   - 6 characters: Issuer-only identifier
 *
 * Examples: 037833100 (AAPL), 594918104 (MSFT), 037833 (AAPL issuer)
 */

import type { Validator, ValidationResult } from './index'

// Regex for valid CUSIPs: 6-9 alphanumeric characters
const CUSIP_REGEX = /^[A-Z0-9]{6,9}$/

/**
 * Calculate CUSIP check digit using the Luhn-like algorithm
 * Exported for external use (e.g., generating valid CUSIPs)
 */
export function calculateCusipCheckDigit(cusip: string): number {
  let sum = 0
  // Use first 8 characters (or pad with 00 if only issuer)
  const chars = cusip.substring(0, 8).toUpperCase().padEnd(8, '0')

  for (let i = 0; i < 8; i++) {
    let value: number
    const char = chars[i]

    // Convert letters to numbers (A=10, B=11, ..., Z=35)
    // Also handle special characters: * = 36, @ = 37, # = 38
    if (/[A-Z]/.test(char)) {
      value = char.charCodeAt(0) - 55 // A=65-55=10
    } else if (char === '*') {
      value = 36
    } else if (char === '@') {
      value = 37
    } else if (char === '#') {
      value = 38
    } else {
      value = parseInt(char, 10)
    }

    // Double every second digit (0-indexed, so positions 1, 3, 5, 7)
    if (i % 2 === 1) {
      value *= 2
    }

    // Sum the digits (value can be > 9 after doubling)
    sum += Math.floor(value / 10) + (value % 10)
  }

  return (10 - (sum % 10)) % 10
}

/**
 * Validate CUSIP check digit
 */
function isValidCheckDigit(cusip: string): boolean {
  if (cusip.length < 9) return true // Can't validate without check digit
  const calculated = calculateCusipCheckDigit(cusip)
  const actual = parseInt(cusip[8], 10)
  return calculated === actual
}

/**
 * Normalize CUSIP to standard 9-character format
 * - 6-char issuer: pad with "000" to make 9 chars
 * - 8-char CUSIP: calculate and append check digit
 * - 9-char CUSIP: return as-is
 */
function normalizeCusipFormat(cusip: string): string {
  const upper = cusip.toUpperCase()

  if (upper.length === 6) {
    // Issuer-only: pad with 00 + calculated check digit
    const padded = upper + '00'
    return padded + calculateCusipCheckDigit(padded)
  }

  if (upper.length === 8) {
    // Missing check digit: calculate and append
    return upper + calculateCusipCheckDigit(upper)
  }

  return upper
}

export const validateCusip: Validator = {
  validate(value: string): ValidationResult {
    if (typeof value !== 'string') {
      return {
        valid: false,
        error: `Expected string, got ${typeof value}`,
      }
    }

    const trimmed = value.trim().toUpperCase()

    if (trimmed.length === 0) {
      return {
        valid: false,
        error: 'CUSIP cannot be empty',
      }
    }

    if (!CUSIP_REGEX.test(trimmed)) {
      return {
        valid: false,
        error: `Invalid CUSIP format: "${value}". Must be 6-9 alphanumeric characters`,
      }
    }

    // Normalize to 9 characters
    const normalized = normalizeCusipFormat(trimmed)

    // Validate check digit and include in result
    const checkDigitValid = isValidCheckDigit(normalized)

    if (!checkDigitValid) {
      console.debug(`CUSIP ${normalized} has invalid check digit (may be legacy data)`)
    }

    return {
      valid: true,
      normalized,
      checkDigitValid,
      metadata: {
        originalLength: trimmed.length,
        issuer: normalized.substring(0, 6),
        issue: normalized.substring(6, 8),
        checkDigit: normalized.substring(8, 9),
      },
    }
  },

  assert(value: string): string {
    const result = this.validate(value)
    if (!result.valid) {
      throw new Error(result.error!)
    }
    return result.normalized!
  },
}
