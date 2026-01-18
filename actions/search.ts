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
 * Searches cusip_mappings for ticker/name matches
 */
async function searchStocks(searchQuery: string, limit: number): Promise<SearchResult[]> {
  const validated = validateSearchQuery(searchQuery)
  if (!validated) return []

  const queryUpper = escapeSqlString(validated.toUpperCase())
  const queryLower = escapeSqlString(validated.toLowerCase())
  const safeLimit = Math.min(Math.max(1, limit), 50)

  try {
    // Search cusip_mappings for ticker or name matches
    const results = await query<{
      cusip: string
      ticker: string | null
      name: string | null
    }>(`
      SELECT DISTINCT cusip, ticker, name
      FROM rensider.cusip_mappings
      WHERE ticker IS NOT NULL
        AND (
          ticker = '${queryUpper}'
          OR ticker LIKE '${queryUpper}%'
          OR LOWER(name) LIKE '%${queryLower}%'
        )
      ORDER BY
        CASE
          WHEN ticker = '${queryUpper}' THEN 0
          WHEN ticker LIKE '${queryUpper}%' THEN 1
          ELSE 2
        END,
        ticker
      LIMIT ${safeLimit}
    `)

    return results.map(r => ({
      type: 'stock' as const,
      id: r.ticker || r.cusip,
      ticker: r.ticker || undefined,
      name: r.name || r.ticker || r.cusip,
    }))
  } catch (error) {
    console.error('Error searching stocks:', error)
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
      // Search by CIK prefix
      const results = await query<{ CIK: string }>(`
        SELECT DISTINCT CIK
        FROM submissions_13f
        WHERE CIK LIKE '${escapedCik}%'
           OR LTRIM(CIK, '0') LIKE '${escapedCik}%'
        ORDER BY CIK
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
      // For name-based search, we need to get CIKs and check names
      // This is less efficient but necessary since names aren't in the DB
      // Get recent active filers
      const results = await query<{ CIK: string }>(`
        SELECT DISTINCT CIK
        FROM submissions_13f
        ORDER BY FILING_DATE DESC
        LIMIT 500
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
          if (matches.length >= limit) break
        }
      }

      return matches
    }
  } catch (error) {
    console.error('Error searching funds:', error)
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
