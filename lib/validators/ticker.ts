/**
 * Ticker Symbol Validator
 *
 * Validates stock ticker symbols with support for various formats:
 *   - Standard tickers: 1-5 uppercase letters (AAPL, GOOGL, META)
 *   - Share class suffixes: .A, .B, .WS, .PR, etc. (BRK.B, ACHR.WS)
 *   - Preferred shares: -P suffix (BAC-PL, BAC-PA)
 *   - Numeric tickers: Some ADRs and international stocks
 *
 * Examples: AAPL, BRK.B, GOOGL, META, BAC-PL, SPY.PRA
 */

import type { Validator, ValidationResult } from './index'

// More permissive regex for valid tickers:
// - 1-5 alphanumeric characters (base ticker)
// - Optional suffix: .XX (share class) or -PX (preferred)
// - Some tickers can be pure numeric (rare but valid)
const TICKER_REGEX = /^[A-Z0-9]{1,5}(\.[A-Z]{1,3}|-P[A-Z])?$/

// Strict regex for common US tickers (more restrictive)
const STRICT_TICKER_REGEX = /^[A-Z]{1,5}(\.[A-Z])?$/

export const validateTicker: Validator = {
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
        error: 'Ticker cannot be empty',
      }
    }

    // Check max length (including suffix)
    if (trimmed.length > 10) {
      return {
        valid: false,
        error: `Invalid ticker length: "${value}". Maximum 10 characters including suffix.`,
      }
    }

    if (!TICKER_REGEX.test(trimmed)) {
      return {
        valid: false,
        error: `Invalid ticker format: "${value}". Must be 1-5 alphanumeric characters, optionally followed by share class (.XX) or preferred (-PX)`,
      }
    }

    // Extract base ticker and suffix for metadata
    const match = trimmed.match(/^([A-Z0-9]{1,5})(\.[A-Z]{1,3}|-P[A-Z])?$/)
    const baseTicker = match?.[1] || trimmed
    const suffix = match?.[2] || undefined

    return {
      valid: true,
      normalized: trimmed,
      metadata: {
        baseTicker,
        suffix,
        isPreferred: suffix?.startsWith('-P') ?? false,
        isShareClass: suffix?.startsWith('.') ?? false,
        isStrictFormat: STRICT_TICKER_REGEX.test(trimmed),
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
 * Validate ticker with strict rules (common US stocks only)
 */
export function validateTickerStrict(value: string): ValidationResult {
  const result = validateTicker.validate(value)
  if (!result.valid) return result

  if (!STRICT_TICKER_REGEX.test(result.normalized!)) {
    return {
      valid: false,
      error: `Ticker "${value}" uses extended format. For strict validation, use 1-5 letters with optional .X suffix.`,
    }
  }

  return result
}
