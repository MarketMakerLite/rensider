/**
 * ISIN Validator
 *
 * Validates ISIN (International Securities Identification Number) identifiers.
 * Format: 12 characters
 *   - First 2: Country code (ISO 3166-1 alpha-2)
 *   - Next 9: National Securities Identifying Number (NSIN)
 *   - Last 1: Check digit
 *
 * Examples: US0378331005 (AAPL), US5949181045 (MSFT)
 *
 * The first 9 characters of a US ISIN after the country code is the CUSIP.
 */

import type { Validator, ValidationResult } from './index'

// Regex for valid ISINs: 2 letters + 9 alphanumeric + 1 digit
const ISIN_REGEX = /^[A-Z]{2}[A-Z0-9]{9}[0-9]$/

// Common country codes for securities
const VALID_COUNTRY_CODES = new Set([
  'US', 'CA', 'GB', 'DE', 'FR', 'JP', 'CH', 'AU', 'NL', 'BE', 'IT', 'ES',
  'HK', 'SG', 'KR', 'TW', 'IN', 'BR', 'MX', 'ZA', 'IE', 'LU', 'AT', 'DK',
  'SE', 'NO', 'FI', 'PT', 'GR', 'NZ', 'IL', 'AE', 'SA', 'QA', 'KW', 'BH',
])

/**
 * Calculate ISIN check digit using the Luhn algorithm
 * Exported for external use (e.g., generating valid ISINs)
 */
export function calculateIsinCheckDigit(isin: string): number {
  // Convert letters to numbers (A=10, B=11, ..., Z=35)
  const converted = isin
    .substring(0, 11)
    .toUpperCase()
    .split('')
    .map(char => {
      if (/[A-Z]/.test(char)) {
        return (char.charCodeAt(0) - 55).toString() // A=10, B=11, etc.
      }
      return char
    })
    .join('')

  // Apply Luhn algorithm
  let sum = 0
  let doubleNext = true // Start from the right, double every second digit

  for (let i = converted.length - 1; i >= 0; i--) {
    let digit = parseInt(converted[i], 10)

    if (doubleNext) {
      digit *= 2
      if (digit > 9) {
        digit -= 9
      }
    }

    sum += digit
    doubleNext = !doubleNext
  }

  return (10 - (sum % 10)) % 10
}

/**
 * Validate ISIN check digit
 */
function isValidCheckDigit(isin: string): boolean {
  const calculated = calculateIsinCheckDigit(isin)
  const actual = parseInt(isin[11], 10)
  return calculated === actual
}

/**
 * Extract CUSIP from US ISIN
 */
function extractCusip(isin: string): string | undefined {
  if (isin.startsWith('US')) {
    return isin.substring(2, 11) // Characters 3-11 are the CUSIP
  }
  return undefined
}

export const validateIsin: Validator = {
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
        error: 'ISIN cannot be empty',
      }
    }

    if (trimmed.length !== 12) {
      return {
        valid: false,
        error: `Invalid ISIN length: "${value}". Must be exactly 12 characters, got ${trimmed.length}`,
      }
    }

    if (!ISIN_REGEX.test(trimmed)) {
      return {
        valid: false,
        error: `Invalid ISIN format: "${value}". Must be 2 letters (country) + 9 alphanumeric (NSIN) + 1 digit (check)`,
      }
    }

    const countryCode = trimmed.substring(0, 2)
    const isKnownCountry = VALID_COUNTRY_CODES.has(countryCode)

    // Validate check digit
    const checkDigitValid = isValidCheckDigit(trimmed)

    if (!checkDigitValid) {
      console.debug(`ISIN ${trimmed} has invalid check digit`)
    }

    return {
      valid: true,
      normalized: trimmed,
      checkDigitValid,
      metadata: {
        countryCode,
        nsin: trimmed.substring(2, 11),
        checkDigit: trimmed.substring(11, 12),
        cusip: extractCusip(trimmed),
        isKnownCountry,
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

/**
 * Convert CUSIP to ISIN (US securities only)
 */
export function cusipToIsin(cusip: string): string {
  const normalized = cusip.toUpperCase().padEnd(9, '0').substring(0, 9)
  const withCountry = 'US' + normalized
  const checkDigit = calculateIsinCheckDigit(withCountry)
  return withCountry + checkDigit
}

/**
 * Extract CUSIP from ISIN if it's a US security
 */
export function isinToCusip(isin: string): string | undefined {
  const result = validateIsin.validate(isin)
  if (!result.valid) return undefined
  return result.metadata?.cusip as string | undefined
}
