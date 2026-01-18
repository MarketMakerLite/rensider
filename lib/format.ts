/**
 * Centralized formatting utilities for consistent display across the app
 * All formatters use explicit locales/timezones for consistent SSR hydration
 */

// Shared number formatter for consistent SSR
const numberFormatter = new Intl.NumberFormat('en-US')

// Formatter with decimals for abbreviated values
function formatWithDecimals(value: number, decimals: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export interface FormatNumberOptions {
  decimals?: number
  useLocale?: boolean
}

/**
 * Format large numbers with abbreviated suffixes (K, M, B, T)
 * Includes thousands separators in the abbreviated value
 */
export function formatLargeNumber(
  num: number,
  options: FormatNumberOptions = {}
): string {
  const { decimals = 1, useLocale = true } = options

  if (num >= 1e12) return `${formatWithDecimals(num / 1e12, decimals)}T`
  if (num >= 1e9) return `${formatWithDecimals(num / 1e9, decimals)}B`
  if (num >= 1e6) return `${formatWithDecimals(num / 1e6, decimals)}M`
  if (num >= 1e3) return `${formatWithDecimals(num / 1e3, decimals)}K`

  return useLocale ? numberFormatter.format(num) : num.toString()
}

/**
 * Format a number as currency with abbreviated suffixes
 */
export function formatCurrency(
  amount: number,
  options: FormatNumberOptions = {}
): string {
  return `$${formatLargeNumber(amount, options)}`
}

/**
 * Format a timestamp as a readable date
 * Uses UTC to ensure consistent SSR hydration
 */
export function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Format a timestamp as a short date (Month Day)
 * Uses UTC to ensure consistent SSR hydration
 */
export function formatShortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Format a timestamp as a full datetime string
 * Uses UTC to ensure consistent SSR hydration
 */
export function formatDateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
  })
}

/**
 * Format a number with locale-independent formatting
 * Uses explicit 'en-US' locale for consistent SSR
 */
export function formatNumber(value: number): string {
  return numberFormatter.format(value)
}

/**
 * Format a percentage with specified decimal places
 */
export function formatPercent(value: number, decimals = 1): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
}

/**
 * Format a change multiple (e.g., "5.2x")
 */
export function formatMultiple(value: number, decimals = 1): string {
  return `${value.toFixed(decimals)}x`
}

/**
 * Decode HTML entities in text (commonly found in SEC filing data)
 * Handles: &amp; &lt; &gt; &quot; &#39; and numeric entities
 */
export function decodeHtmlEntities(text: string | null | undefined): string {
  if (!text) return ''

  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)))
}

/**
 * Generate SEC EDGAR filing URL from accession number
 * Accession format: 0001234567-24-000001
 */
export function getSecFilingUrl(accessionNumber: string): string {
  // SEC URLs use accession without dashes
  const cleanAccession = accessionNumber.replace(/-/g, '')
  // Extract CIK from accession (first 10 digits, strip leading zeros)
  const cik = accessionNumber.split('-')[0].replace(/^0+/, '')
  return `https://www.sec.gov/Archives/edgar/data/${cik}/${cleanAccession}/${accessionNumber}-index.htm`
}
