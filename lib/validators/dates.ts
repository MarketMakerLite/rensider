/**
 * Date and Quarter Validators
 *
 * Validates temporal data formats used in the application.
 */

import type { Validator, ValidationResult } from './index'

// Quarter format: YYYYQN where N is 1-4
const QUARTER_REGEX = /^(\d{4})Q([1-4])$/

// Reasonable timestamp bounds
const MIN_TIMESTAMP = 631152000000 // Jan 1, 1990
const MAX_TIMESTAMP = 4102444800000 // Jan 1, 2100

/**
 * Quarter Validator
 *
 * Format: YYYYQN where N is 1-4
 * Examples: 2024Q1, 2023Q4
 */
export const validateQuarter: Validator = {
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
        error: 'Quarter cannot be empty',
      }
    }

    const match = QUARTER_REGEX.exec(trimmed)
    if (!match) {
      return {
        valid: false,
        error: `Invalid quarter format: "${value}". Must be YYYYQN (e.g., 2024Q1)`,
      }
    }

    const year = parseInt(match[1], 10)

    // Sanity check: reasonable year range
    if (year < 1990 || year > 2050) {
      return {
        valid: false,
        error: `Invalid year in quarter: "${value}". Year must be between 1990-2050`,
      }
    }

    return { valid: true, normalized: trimmed }
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
 * Timestamp Validator
 *
 * Validates Unix timestamp in milliseconds.
 * Must be within reasonable bounds (1990-2100).
 */
export const validateTimestamp: Validator<number> = {
  validate(value: number): ValidationResult {
    if (typeof value !== 'number') {
      return {
        valid: false,
        error: `Expected number, got ${typeof value}`,
      }
    }

    if (!Number.isInteger(value)) {
      return {
        valid: false,
        error: `Timestamp must be an integer, got ${value}`,
      }
    }

    if (value < MIN_TIMESTAMP || value > MAX_TIMESTAMP) {
      return {
        valid: false,
        error: `Timestamp ${value} out of range. Must be between 1990 and 2100`,
      }
    }

    return { valid: true, normalized: value.toString() }
  },

  assert(value: number): string {
    const result = this.validate(value)
    if (!result.valid) {
      throw new Error(result.error!)
    }
    return result.normalized!
  },
}

/**
 * Convert Date to quarter string
 */
export function dateToQuarter(date: Date | string): string {
  const d = typeof date === 'string' ? parseDate(date) : date
  const year = d.getFullYear()
  const quarter = Math.floor(d.getMonth() / 3) + 1
  return `${year}Q${quarter}`
}

/**
 * Month abbreviations used in DD-MMM-YYYY format
 */
const MONTH_MAP: Record<string, number> = {
  JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
  JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
}

/**
 * Parse date string in various formats.
 * Supports:
 * - DD-MMM-YYYY (e.g., '30-OCT-2020') - SEC filing format
 * - YYYY-MM-DD (e.g., '2024-11-15') - ISO format
 * - Any format parseable by Date constructor
 *
 * Returns a Date object or throws if invalid.
 */
export function parseDate(dateStr: string): Date {
  if (!dateStr || typeof dateStr !== 'string') {
    throw new Error(`Invalid date: ${dateStr}`)
  }

  const trimmed = dateStr.trim()

  // Try DD-MMM-YYYY format first (e.g., '30-OCT-2020')
  const ddMmmYyyyMatch = /^(\d{1,2})-([A-Z]{3})-(\d{4})$/i.exec(trimmed)
  if (ddMmmYyyyMatch) {
    const day = parseInt(ddMmmYyyyMatch[1], 10)
    const month = MONTH_MAP[ddMmmYyyyMatch[2].toUpperCase()]
    const year = parseInt(ddMmmYyyyMatch[3], 10)

    if (month !== undefined && day >= 1 && day <= 31 && year >= 1900 && year <= 2100) {
      return new Date(year, month, day)
    }
  }

  // Try standard Date parsing (handles YYYY-MM-DD and other formats)
  const date = new Date(trimmed)
  if (!isNaN(date.getTime())) {
    return date
  }

  throw new Error(`Unable to parse date: ${dateStr}`)
}

/**
 * Safely parse a date string, returning timestamp in milliseconds.
 * Returns null if parsing fails instead of throwing.
 */
export function parseDateToTimestamp(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null

  try {
    return parseDate(dateStr).getTime()
  } catch {
    return null
  }
}

