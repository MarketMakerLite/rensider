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
 * Searches cusip_mappings and holdings_13f for ticker/name matches
 */
async function searchStocks(searchQuery: string, limit: number): Promise<SearchResult[]> {
  const validated = validateSearchQuery(searchQuery)
  if (!validated) return []

  const queryUpper = escapeSqlString(validated.toUpperCase())
  const safeLimit = Math.min(Math.max(1, limit), 50)

  try {
    // First try exact ticker match in cusip_mappings
    const exactMatches = await query<{
      cusip: string
      ticker: string | null
      name: string | null
    }>(`
      SELECT cusip, ticker, name
      FROM rensider.cusip_mappings
      WHERE ticker = '${queryUpper}'
      LIMIT ${safeLimit}
    `)

    if (exactMatches.length > 0) {
      return exactMatches.map(r => ({
        type: 'stock' as const,
        id: r.ticker || r.cusip,
        ticker: r.ticker || undefined,
        name: r.name || r.ticker || r.cusip,
      }))
    }

    // Try prefix match on ticker
    const prefixMatches = await query<{
      cusip: string
      ticker: string | null
      name: string | null
    }>(`
      SELECT cusip, ticker, name
      FROM rensider.cusip_mappings
      WHERE ticker LIKE '${queryUpper}%'
      LIMIT ${safeLimit}
    `)

    if (prefixMatches.length > 0) {
      return prefixMatches.map(r => ({
        type: 'stock' as const,
        id: r.ticker || r.cusip,
        ticker: r.ticker || undefined,
        name: r.name || r.ticker || r.cusip,
      }))
    }

    // Fallback: search holdings_13f by issuer name
    const issuerMatches = await query<{
      CUSIP: string
      NAMEOFISSUER: string
    }>(`
      SELECT DISTINCT CUSIP, NAMEOFISSUER
      FROM holdings_13f
      WHERE UPPER(NAMEOFISSUER) LIKE '%${queryUpper}%'
      LIMIT ${safeLimit}
    `)

    return issuerMatches.map(r => ({
      type: 'stock' as const,
      id: r.CUSIP,
      ticker: undefined,
      name: r.NAMEOFISSUER,
    }))
  } catch (error) {
    console.error('Error searching stocks:', error instanceof Error ? error.message : error)
    return []
  }
}

/**
 * Search for funds in the database
 * Searches submissions_13f for CIK matches, then resolves names
 */
async function searchFunds(searchQuery: string, limit: number): Promise<SearchResult[]> {
  const validated = validateSearchQuery(searchQuery)
  if (!validated) return []

  const safeLimit = Math.min(Math.max(1, limit), 50)

  try {
    // Check if query looks like a CIK (all digits)
    const isCikQuery = /^\d+$/.test(validated)

    if (isCikQuery) {
      const escapedCik = escapeSqlString(validated)
      // Search by CIK prefix - simpler query
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
    } else {
      // For name-based search, get top filers and filter by name
      // Limit to 100 to keep it fast
      const results = await query<{ CIK: string }>(`
        SELECT DISTINCT CIK
        FROM submissions_13f
        LIMIT 100
      `)

      if (results.length === 0) return []

      // Resolve all names and filter
      const ciks = results.map(r => r.CIK)
      const namesMap = await getFilerNames(ciks, { fetchMissing: true })

      const queryLower = validated.toLowerCase()
      const matches: SearchResult[] = []

      for (const [cik, name] of namesMap.entries()) {
        if (name.toLowerCase().includes(queryLower)) {
          matches.push({
            type: 'fund',
            id: cik.replace(/^0+/, '') || cik,
            name,
            cik: cik.replace(/^0+/, '') || cik,
          })
          if (matches.length >= safeLimit) break
        }
      }

      return matches
    }
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
