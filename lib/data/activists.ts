/**
 * Data access layer for beneficial ownership filings (13D/13G)
 * Uses DuckDB tables for efficient querying
 */

import { query } from '../sec/duckdb'
import { mapCUSIPs } from '../sec/openfigi'
import { parseDateToTimestamp } from '../validators/dates'
import type { ActivistActivity, IntentCategory } from '@/types/activists'

interface Filing13DGRow {
  ACCESSION_NUMBER: string
  FORM_TYPE: string
  FILING_DATE: string
  ISSUER_CIK: string
  ISSUER_NAME: string
  ISSUER_CUSIP: string | null
  FILED_BY_CIK: string
  FILED_BY_NAME: string
  SECURITIES_CLASS_TITLE: string | null
  PERCENT_OF_CLASS: number
  SHARES_OWNED: number
}

/**
 * Get recent 13D/13G filings from the database
 */
export async function getRecentFilings13DG(options: {
  days?: number
  limit?: number
  formTypes?: string[]
}): Promise<ActivistActivity[]> {
  const { days = 90, limit = 100, formTypes = ['SC 13D', 'SC 13D/A', 'SC 13G', 'SC 13G/A', 'SCHEDULE 13D', 'SCHEDULE 13D/A', 'SCHEDULE 13G', 'SCHEDULE 13G/A'] } = options

  try {
    const formTypeList = formTypes.map(f => `'${f}'`).join(', ')

    // Calculate cutoff date for filtering
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - days)
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    // Query all filings ordered by date, deduplicated by accession number
    const results = await query<Filing13DGRow>(`
      SELECT
        ACCESSION_NUMBER,
        FIRST(FORM_TYPE) as FORM_TYPE,
        FIRST(FILING_DATE) as FILING_DATE,
        FIRST(ISSUER_CIK) as ISSUER_CIK,
        FIRST(ISSUER_NAME) as ISSUER_NAME,
        FIRST(ISSUER_CUSIP) as ISSUER_CUSIP,
        FIRST(FILED_BY_CIK) as FILED_BY_CIK,
        FIRST(FILED_BY_NAME) as FILED_BY_NAME,
        FIRST(SECURITIES_CLASS_TITLE) as SECURITIES_CLASS_TITLE,
        MAX(PERCENT_OF_CLASS) as PERCENT_OF_CLASS,
        MAX(SHARES_OWNED) as SHARES_OWNED
      FROM filings_13dg
      WHERE FORM_TYPE IN (${formTypeList})
        AND FILING_DATE >= '${cutoffDateStr}'
      GROUP BY ACCESSION_NUMBER
      ORDER BY FIRST(FILING_DATE) DESC
      LIMIT ${limit}
    `)

    // Try to look up tickers for CUSIPs
    const cusipToTicker = new Map<string, string>()
    const cusips = [...new Set(results.map(r => r.ISSUER_CUSIP).filter(Boolean))] as string[]

    // Batch lookup tickers (limit to avoid too many API calls)
    if (cusips.length > 0) {
      try {
        const mappings = await mapCUSIPs(cusips.slice(0, 50))
        for (const mapping of mappings) {
          if (mapping.ticker && !mapping.error) {
            cusipToTicker.set(mapping.cusip, mapping.ticker)
          }
        }
      } catch {
        // Ignore lookup failures
      }
    }

    return results.map(r => {
      const isAmendment = r.FORM_TYPE.includes('/A')
      const is13D = r.FORM_TYPE.includes('13D')

      // Determine intent category based on form type
      let intentCategory: IntentCategory = 'passive'
      if (is13D) {
        // 13D filers have some active intent by definition
        intentCategory = 'activist'
      }

      return {
        accessionNumber: r.ACCESSION_NUMBER,
        filingDate: parseDateToTimestamp(r.FILING_DATE) ?? 0,
        ownerName: r.FILED_BY_NAME || 'Unknown',
        ownerCik: r.FILED_BY_CIK || '',
        ticker: (r.ISSUER_CUSIP ? cusipToTicker.get(r.ISSUER_CUSIP) : null) || '',
        issuerName: r.ISSUER_NAME || 'Unknown',
        issuerCik: r.ISSUER_CIK || '',
        percentOfClass: r.PERCENT_OF_CLASS || 0,
        shares: r.SHARES_OWNED || 0,
        intentCategory,
        purposeSummary: is13D ? 'Schedule 13D filing - potential activist intent' : 'Schedule 13G filing - passive investment',
        eventType: isAmendment ? 'increase' : 'initial',
        previousPercent: null,
      }
    })
  } catch (error) {
    console.error('Error fetching 13D/G filings:', error)
    return []
  }
}

/**
 * Get activist-only activity (13D filings)
 */
export async function getActivistFilings(options: {
  days?: number
  limit?: number
}): Promise<ActivistActivity[]> {
  return getRecentFilings13DG({
    ...options,
    formTypes: ['SC 13D', 'SC 13D/A', 'SCHEDULE 13D', 'SCHEDULE 13D/A'],
  })
}

/**
 * Get filings for a specific issuer (by name search or ticker lookup)
 */
export async function getFilingsForIssuer(options: {
  ticker?: string
  issuerName?: string
  limit?: number
}): Promise<ActivistActivity[]> {
  const { ticker, issuerName, limit = 50 } = options

  try {
    // Build WHERE clause based on search criteria
    let whereClause = '1=1'
    if (ticker) {
      // Search by issuer name containing ticker-like patterns
      whereClause += ` AND (UPPER(ISSUER_NAME) LIKE '%${ticker.toUpperCase()}%')`
    } else if (issuerName) {
      whereClause += ` AND (UPPER(ISSUER_NAME) LIKE '%${issuerName.toUpperCase()}%')`
    }

    const results = await query<{
      ACCESSION_NUMBER: string
      FORM_TYPE: string
      FILING_DATE: string
      ISSUER_CIK: string
      ISSUER_NAME: string
      ISSUER_CUSIP: string | null
      FILED_BY_CIK: string
      FILED_BY_NAME: string
      PERCENT_OF_CLASS: number
      SHARES_OWNED: number
    }>(`
      SELECT
        ACCESSION_NUMBER,
        FIRST(FORM_TYPE) as FORM_TYPE,
        FIRST(FILING_DATE) as FILING_DATE,
        FIRST(ISSUER_CIK) as ISSUER_CIK,
        FIRST(ISSUER_NAME) as ISSUER_NAME,
        FIRST(ISSUER_CUSIP) as ISSUER_CUSIP,
        FIRST(FILED_BY_CIK) as FILED_BY_CIK,
        FIRST(FILED_BY_NAME) as FILED_BY_NAME,
        MAX(PERCENT_OF_CLASS) as PERCENT_OF_CLASS,
        MAX(SHARES_OWNED) as SHARES_OWNED
      FROM filings_13dg
      WHERE ${whereClause}
      GROUP BY ACCESSION_NUMBER
      ORDER BY FIRST(FILING_DATE) DESC
      LIMIT ${limit}
    `)

    return results.map(r => {
      const isAmendment = r.FORM_TYPE.includes('/A')
      const is13D = r.FORM_TYPE.includes('13D')

      return {
        accessionNumber: r.ACCESSION_NUMBER,
        filingDate: parseDateToTimestamp(r.FILING_DATE) ?? 0,
        ownerName: r.FILED_BY_NAME || 'Unknown',
        ownerCik: r.FILED_BY_CIK || '',
        ticker: ticker?.toUpperCase() || '',
        issuerName: r.ISSUER_NAME || 'Unknown',
        issuerCik: r.ISSUER_CIK || '',
        percentOfClass: r.PERCENT_OF_CLASS || 0,
        shares: r.SHARES_OWNED || 0,
        intentCategory: is13D ? 'activist' : 'passive',
        purposeSummary: is13D ? 'Schedule 13D filing' : 'Schedule 13G filing',
        eventType: isAmendment ? 'increase' : 'initial',
        previousPercent: null,
      }
    })
  } catch (error) {
    console.error('Error fetching filings for issuer:', error)
    return []
  }
}

/**
 * Get filing count stats
 */
export async function getFilingStats(): Promise<{
  total13D: number
  total13G: number
  recentCount: number
}> {
  try {
    const cutoffDate = new Date(Date.now() - (30 * 24 * 60 * 60 * 1000))
    const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

    const stats = await query<{ form_type: string; count: number }>(`
      SELECT
        CASE
          WHEN FORM_TYPE LIKE '%13D%' THEN '13D'
          ELSE '13G'
        END as form_type,
        COUNT(*) as count
      FROM filings_13dg
      GROUP BY 1
    `)

    const recentStats = await query<{ count: number }>(`
      SELECT COUNT(*) as count
      FROM filings_13dg
      WHERE FILING_DATE >= '${cutoffDateStr}'
    `)

    const total13D = stats.find(s => s.form_type === '13D')?.count || 0
    const total13G = stats.find(s => s.form_type === '13G')?.count || 0

    return {
      total13D,
      total13G,
      recentCount: recentStats[0]?.count || 0,
    }
  } catch (error) {
    console.error('Error fetching filing stats:', error)
    return { total13D: 0, total13G: 0, recentCount: 0 }
  }
}
