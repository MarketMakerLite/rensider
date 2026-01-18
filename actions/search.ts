'use server'

import { query } from '@/lib/sec/duckdb'
import { getFilerNames } from '@/lib/sec/filer-names'

export interface SearchResult {
  type: 'stock' | 'fund'
  id: string
  ticker?: string
  name: string
  cik?: string
}

/**
 * Escape a string value for safe use in SQL queries.
 */
function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''")
}

/**
 * Validate search query - alphanumeric, spaces, and common punctuation only
 */
function validateSearchQuery(query: string): string | null {
  const cleaned = query.trim()
  if (cleaned.length < 1 || cleaned.length > 100) return null
  // Allow alphanumeric, spaces, dots, ampersands, commas, hyphens
  if (!/^[a-zA-Z0-9\s.,&'-]+$/.test(cleaned)) return null
  return cleaned
}

/**
 * Search for stocks in the database
 * Fast path: ticker search in cusip_mappings (indexed)
 * Slow path: name search only if ticker search returns nothing
 */
async function searchStocks(searchQuery: string, limit: number): Promise<SearchResult[]> {
  const validated = validateSearchQuery(searchQuery)
  if (!validated) return []

  const queryUpper = escapeSqlString(validated.toUpperCase())
  const safeLimit = Math.min(Math.max(1, limit), 50)

  try {
    // FAST: Single query for ticker matches (exact + prefix) - indexed lookup
    const tickerMatches = await query<{ cusip: string; ticker: string | null; name: string | null }>(`
      SELECT cusip, ticker, name
      FROM rensider.cusip_mappings
      WHERE ticker LIKE '${queryUpper}%'
      ORDER BY CASE WHEN ticker = '${queryUpper}' THEN 0 ELSE 1 END, ticker
      LIMIT ${safeLimit}
    `)

    if (tickerMatches.length > 0) {
      return tickerMatches.map(r => ({
        type: 'stock' as const,
        id: r.ticker || r.cusip,
        ticker: r.ticker || undefined,
        name: r.name || r.ticker || r.cusip,
      }))
    }

    // SLOW PATH: Only search by name if no ticker matches (requires 3+ chars)
    if (validated.length < 3) return []

    // Search company name in cusip_mappings only (skip holdings_13f - too slow)
    const nameMatches = await query<{ cusip: string; ticker: string | null; name: string | null }>(`
      SELECT cusip, ticker, name
      FROM rensider.cusip_mappings
      WHERE UPPER(name) LIKE '%${queryUpper}%'
      LIMIT ${safeLimit}
    `)

    return nameMatches.map(r => ({
      type: 'stock' as const,
      id: r.ticker || r.cusip,
      ticker: r.ticker || undefined,
      name: r.name || r.ticker || r.cusip,
    }))
  } catch (error) {
    console.error('Error searching stocks:', error instanceof Error ? error.message : error)
    return []
  }
}

/**
 * Search for funds in the database
 * Only supports CIK search (name search requires too many API calls)
 */
async function searchFunds(searchQuery: string, limit: number): Promise<SearchResult[]> {
  const validated = validateSearchQuery(searchQuery)
  if (!validated) return []

  // Only search funds by CIK (numeric queries)
  // Name-based fund search is too slow (requires fetching names from SEC API)
  if (!/^\d+$/.test(validated)) return []

  const safeLimit = Math.min(Math.max(1, limit), 50)
  const escapedCik = escapeSqlString(validated)

  try {
    const results = await query<{ CIK: string }>(`
      SELECT DISTINCT CIK
      FROM submissions_13f
      WHERE LTRIM(CIK, '0') LIKE '${escapedCik}%'
      LIMIT ${safeLimit}
    `)

    if (results.length === 0) return []

    // Resolve filer names
    const ciks = results.map(r => r.CIK)
    const namesMap = await getFilerNames(ciks, { fetchMissing: true })

    return results.map(r => ({
      type: 'fund' as const,
      id: r.CIK.replace(/^0+/, '') || r.CIK,
      name: namesMap.get(r.CIK) || `CIK ${r.CIK}`,
      cik: r.CIK.replace(/^0+/, '') || r.CIK,
    }))
  } catch (error) {
    console.error('Error searching funds:', error instanceof Error ? error.message : error)
    return []
  }
}

/**
 * Combined search for stocks and funds
 * Searches stocks by ticker/name and funds by CIK/name
 */
export async function searchAll(searchQuery: string, limit: number = 8): Promise<SearchResult[]> {
  if (!searchQuery || searchQuery.length < 1) {
    return []
  }

  const queryTrimmed = searchQuery.trim()

  // Run searches in parallel
  const [stockResults, fundResults] = await Promise.all([
    searchStocks(queryTrimmed, limit),
    searchFunds(queryTrimmed, limit),
  ])

  const results: SearchResult[] = []
  const seen = new Set<string>()

  // Prioritize exact ticker matches
  for (const stock of stockResults) {
    const key = `stock-${stock.id}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push(stock)
    }
  }

  // Add fund matches
  for (const fund of fundResults) {
    const key = `fund-${fund.id}`
    if (!seen.has(key)) {
      seen.add(key)
      results.push(fund)
    }
  }

  return results.slice(0, limit)
}
