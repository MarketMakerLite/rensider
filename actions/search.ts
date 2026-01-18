'use server'

import { searchFilers } from '@/lib/sec/filer-names'
import { searchSecuritiesByName, getSecuritiesByTicker } from '@/lib/sec/securities-master'

export interface SearchResult {
  type: 'stock' | 'fund'
  id: string
  ticker?: string
  name: string
  cik?: string
}

/**
 * Combined search for stocks and funds
 * Searches stocks by ticker/name and funds by CIK/name
 */
export async function searchAll(query: string, limit: number = 8): Promise<SearchResult[]> {
  if (!query || query.length < 2) {
    return []
  }

  const queryTrimmed = query.trim()
  const queryUpper = queryTrimmed.toUpperCase()

  // Run searches in parallel
  const [fundResults, stocksByName, stocksByTicker] = await Promise.all([
    // Search funds by CIK or name
    searchFilers(queryTrimmed, limit),
    // Search stocks by name
    searchSecuritiesByName(queryTrimmed, limit),
    // Try exact ticker match
    getSecuritiesByTicker(queryUpper),
  ])

  const results: SearchResult[] = []
  const seen = new Set<string>()

  // Add ticker matches first (highest priority)
  for (const stock of stocksByTicker) {
    const id = stock.ticker || stock.cusip
    if (!seen.has(`stock-${id}`)) {
      seen.add(`stock-${id}`)
      results.push({
        type: 'stock',
        id: stock.ticker || stock.cusip,
        ticker: stock.ticker,
        name: stock.companyName || stock.issuerName || stock.cusip,
      })
    }
  }

  // Add stock name matches
  for (const stock of stocksByName) {
    const id = stock.ticker || stock.cusip
    if (!seen.has(`stock-${id}`)) {
      seen.add(`stock-${id}`)
      results.push({
        type: 'stock',
        id: stock.ticker || stock.cusip,
        ticker: stock.ticker,
        name: stock.companyName || stock.issuerName || stock.cusip,
      })
    }
  }

  // Add fund matches
  for (const fund of fundResults) {
    if (!seen.has(`fund-${fund.cik}`)) {
      seen.add(`fund-${fund.cik}`)
      results.push({
        type: 'fund',
        id: fund.cik,
        name: fund.name,
        cik: fund.cik,
      })
    }
  }

  // Return up to limit results
  return results.slice(0, limit)
}
