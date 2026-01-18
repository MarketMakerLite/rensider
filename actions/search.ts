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
 * Searches cusip_mappings by ticker AND name, plus holdings_13f for issuer names
 */
async function searchStocks(searchQuery: string, limit: number): Promise<SearchResult[]> {
  const validated = validateSearchQuery(searchQuery)
  if (!validated) return []

  const queryUpper = escapeSqlString(validated.toUpperCase())
  const safeLimit = Math.min(Math.max(1, limit), 50)

  try {
    // Run all searches in parallel for speed
    const [tickerExact, tickerPrefix, nameMatches, issuerMatches] = await Promise.all([
      // Exact ticker match (highest priority)
      query<{ cusip: string; ticker: string | null; name: string | null }>(`
        SELECT cusip, ticker, name
        FROM rensider.cusip_mappings
        WHERE ticker = '${queryUpper}'
        LIMIT ${safeLimit}
      `),
      // Ticker prefix match
      query<{ cusip: string; ticker: string | null; name: string | null }>(`
        SELECT cusip, ticker, name
        FROM rensider.cusip_mappings
        WHERE ticker LIKE '${queryUpper}%' AND ticker != '${queryUpper}'
        LIMIT ${safeLimit}
      `),
      // Company name match in cusip_mappings
      query<{ cusip: string; ticker: string | null; name: string | null }>(`
        SELECT cusip, ticker, name
        FROM rensider.cusip_mappings
        WHERE UPPER(name) LIKE '%${queryUpper}%'
        LIMIT ${safeLimit}
      `),
      // Issuer name match in holdings_13f
      query<{ CUSIP: string; NAMEOFISSUER: string }>(`
        SELECT DISTINCT CUSIP, NAMEOFISSUER
        FROM holdings_13f
        WHERE UPPER(NAMEOFISSUER) LIKE '%${queryUpper}%'
        LIMIT ${safeLimit}
      `),
    ])

    // Combine results with priority: exact ticker > prefix ticker > name matches
    const results: SearchResult[] = []
    const seen = new Set<string>()

    // Add exact ticker matches first
    for (const r of tickerExact) {
      const id = r.ticker || r.cusip
      if (!seen.has(id)) {
        seen.add(id)
        results.push({
          type: 'stock',
          id,
          ticker: r.ticker || undefined,
          name: r.name || r.ticker || r.cusip,
        })
      }
    }

    // Add ticker prefix matches
    for (const r of tickerPrefix) {
      const id = r.ticker || r.cusip
      if (!seen.has(id)) {
        seen.add(id)
        results.push({
          type: 'stock',
          id,
          ticker: r.ticker || undefined,
          name: r.name || r.ticker || r.cusip,
        })
      }
    }

    // Add company name matches from cusip_mappings
    for (const r of nameMatches) {
      const id = r.ticker || r.cusip
      if (!seen.has(id)) {
        seen.add(id)
        results.push({
          type: 'stock',
          id,
          ticker: r.ticker || undefined,
          name: r.name || r.ticker || r.cusip,
        })
      }
    }

    // Add issuer name matches from holdings_13f
    for (const r of issuerMatches) {
      if (!seen.has(r.CUSIP)) {
        seen.add(r.CUSIP)
        results.push({
          type: 'stock',
          id: r.CUSIP,
          ticker: undefined,
          name: r.NAMEOFISSUER,
        })
      }
    }

    return results.slice(0, safeLimit)
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
