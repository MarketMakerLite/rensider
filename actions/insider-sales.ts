'use server'

import type {
  InsiderTransaction,
  TickerInsiderActivity,
  InsiderProfile,
  RecentInsiderActivity,
  InsiderRelationship,
  TransactionCode,
  AcquiredDisposedCode,
  OwnershipType,
} from '@/types/insider-sales'
import { queryForm345 } from '@/lib/sec/form345-db'

/**
 * Parse SEC date format to Unix timestamp
 * Supports: YYYY-MM-DD, DD-MMM-YYYY
 */
function parseSecDate(dateStr: string | null): number {
  if (!dateStr) return 0

  // Try YYYY-MM-DD format first (form345 format)
  const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10)
    const month = parseInt(isoMatch[2], 10) - 1 // JS months are 0-indexed
    const day = parseInt(isoMatch[3], 10)
    return new Date(year, month, day).getTime()
  }

  // Try DD-MMM-YYYY format (13F format)
  const months: Record<string, number> = {
    'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
    'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11,
  }

  const secMatch = dateStr.match(/^(\d{2})-([A-Z]{3})-(\d{4})$/i)
  if (secMatch) {
    const day = parseInt(secMatch[1], 10)
    const month = months[secMatch[2].toUpperCase()]
    const year = parseInt(secMatch[3], 10)

    if (month === undefined) return 0
    return new Date(year, month, day).getTime()
  }

  // Last resort: try standard Date parsing
  const parsed = new Date(dateStr)
  return isNaN(parsed.getTime()) ? 0 : parsed.getTime()
}

/**
 * Get recent insider transactions
 */
export async function getRecentInsiderTransactions({
  limit = 50,
  transactionTypes,
}: {
  limit?: number
  transactionTypes?: ('buy' | 'sell')[]
} = {}): Promise<RecentInsiderActivity> {
  try {
    // Build transaction code filter
    let codeFilter = ''
    if (transactionTypes?.length) {
      const codes: string[] = []
      if (transactionTypes.includes('buy')) codes.push("'P'", "'A'")
      if (transactionTypes.includes('sell')) codes.push("'S'", "'D'", "'F'")
      if (codes.length) {
        codeFilter = `AND t.TRANS_CODE IN (${codes.join(', ')})`
      }
    }

    const rows = await queryForm345<{
      ACCESSION_NUMBER: string
      FILING_DATE: string
      TRANS_DATE: string
      ISSUERTRADINGSYMBOL: string
      ISSUERNAME: string
      ISSUERCIK: string
      RPTOWNERCIK: string
      RPTOWNERNAME: string
      RPTOWNER_TITLE: string | null
      RPTOWNER_RELATIONSHIP: string
      SECURITY_TITLE: string
      TRANS_CODE: string
      TRANS_ACQUIRED_DISP_CD: string
      TRANS_SHARES: number | null
      TRANS_PRICEPERSHARE: number | null
      SHRS_OWND_FOLWNG_TRANS: number | null
      DIRECT_INDIRECT_OWNERSHIP: string
    }>(`
      SELECT
        s.ACCESSION_NUMBER,
        s.FILING_DATE,
        t.TRANS_DATE,
        s.ISSUERTRADINGSYMBOL,
        s.ISSUERNAME,
        s.ISSUERCIK,
        r.RPTOWNERCIK,
        r.RPTOWNERNAME,
        r.RPTOWNER_TITLE,
        r.RPTOWNER_RELATIONSHIP,
        t.SECURITY_TITLE,
        t.TRANS_CODE,
        t.TRANS_ACQUIRED_DISP_CD,
        t.TRANS_SHARES,
        t.TRANS_PRICEPERSHARE,
        t.SHRS_OWND_FOLWNG_TRANS,
        t.DIRECT_INDIRECT_OWNERSHIP
      FROM form345_submissions s
      JOIN form345_reporting_owners r ON s.ACCESSION_NUMBER = r.ACCESSION_NUMBER
      JOIN form345_nonderiv_trans t ON s.ACCESSION_NUMBER = t.ACCESSION_NUMBER
      WHERE t.TRANS_SHARES IS NOT NULL
        AND t.TRANS_SHARES > 0
        ${codeFilter}
      ORDER BY s.FILING_DATE DESC, t.TRANS_DATE DESC
      LIMIT ${limit}
    `)

    const transactions: InsiderTransaction[] = rows.map(row => ({
      accessionNumber: row.ACCESSION_NUMBER,
      filingDate: parseSecDate(row.FILING_DATE),
      transactionDate: parseSecDate(row.TRANS_DATE),
      ticker: row.ISSUERTRADINGSYMBOL || '',
      issuerName: row.ISSUERNAME,
      issuerCik: row.ISSUERCIK,
      insiderCik: row.RPTOWNERCIK,
      insiderName: row.RPTOWNERNAME,
      insiderTitle: row.RPTOWNER_TITLE,
      relationship: (row.RPTOWNER_RELATIONSHIP || 'Other') as InsiderRelationship,
      securityTitle: row.SECURITY_TITLE || 'Common Stock',
      transactionCode: (row.TRANS_CODE || 'P') as TransactionCode,
      acquiredDisposed: (row.TRANS_ACQUIRED_DISP_CD || 'A') as AcquiredDisposedCode,
      shares: row.TRANS_SHARES || 0,
      pricePerShare: row.TRANS_PRICEPERSHARE,
      totalValue: row.TRANS_SHARES && row.TRANS_PRICEPERSHARE
        ? row.TRANS_SHARES * row.TRANS_PRICEPERSHARE
        : null,
      sharesOwnedAfter: row.SHRS_OWND_FOLWNG_TRANS,
      isDerivative: false,
      ownershipType: (row.DIRECT_INDIRECT_OWNERSHIP || 'D') as OwnershipType,
    }))

    // Get total count
    const countResult = await queryForm345<{ cnt: number }>(`
      SELECT COUNT(*) as cnt
      FROM form345_nonderiv_trans
      WHERE TRANS_SHARES IS NOT NULL AND TRANS_SHARES > 0
    `)

    return {
      transactions,
      totalCount: countResult[0]?.cnt ?? 0,
    }
  } catch (error) {
    console.error('Error fetching recent insider transactions:', error)
    return { transactions: [], totalCount: 0 }
  }
}

/**
 * Get insider activity for a specific ticker
 */
export async function getTickerInsiderActivity({
  ticker,
  limit = 50,
}: {
  ticker: string
  limit?: number
}): Promise<TickerInsiderActivity | null> {
  try {
    const upperTicker = ticker.toUpperCase()

    // Get recent transactions for this ticker
    const rows = await queryForm345<{
      ACCESSION_NUMBER: string
      FILING_DATE: string
      TRANS_DATE: string
      ISSUERNAME: string
      ISSUERCIK: string
      RPTOWNERCIK: string
      RPTOWNERNAME: string
      RPTOWNER_TITLE: string | null
      RPTOWNER_RELATIONSHIP: string
      SECURITY_TITLE: string
      TRANS_CODE: string
      TRANS_ACQUIRED_DISP_CD: string
      TRANS_SHARES: number | null
      TRANS_PRICEPERSHARE: number | null
      SHRS_OWND_FOLWNG_TRANS: number | null
      DIRECT_INDIRECT_OWNERSHIP: string
    }>(`
      SELECT
        s.ACCESSION_NUMBER,
        s.FILING_DATE,
        t.TRANS_DATE,
        s.ISSUERNAME,
        s.ISSUERCIK,
        r.RPTOWNERCIK,
        r.RPTOWNERNAME,
        r.RPTOWNER_TITLE,
        r.RPTOWNER_RELATIONSHIP,
        t.SECURITY_TITLE,
        t.TRANS_CODE,
        t.TRANS_ACQUIRED_DISP_CD,
        t.TRANS_SHARES,
        t.TRANS_PRICEPERSHARE,
        t.SHRS_OWND_FOLWNG_TRANS,
        t.DIRECT_INDIRECT_OWNERSHIP
      FROM form345_submissions s
      JOIN form345_reporting_owners r ON s.ACCESSION_NUMBER = r.ACCESSION_NUMBER
      JOIN form345_nonderiv_trans t ON s.ACCESSION_NUMBER = t.ACCESSION_NUMBER
      WHERE UPPER(s.ISSUERTRADINGSYMBOL) = '${upperTicker}'
        AND t.TRANS_SHARES IS NOT NULL
        AND t.TRANS_SHARES > 0
      ORDER BY s.FILING_DATE DESC, t.TRANS_DATE DESC
      LIMIT ${limit}
    `)

    if (rows.length === 0) {
      return null
    }

    const transactions: InsiderTransaction[] = rows.map(row => ({
      accessionNumber: row.ACCESSION_NUMBER,
      filingDate: parseSecDate(row.FILING_DATE),
      transactionDate: parseSecDate(row.TRANS_DATE),
      ticker: upperTicker,
      issuerName: row.ISSUERNAME,
      issuerCik: row.ISSUERCIK,
      insiderCik: row.RPTOWNERCIK,
      insiderName: row.RPTOWNERNAME,
      insiderTitle: row.RPTOWNER_TITLE,
      relationship: (row.RPTOWNER_RELATIONSHIP || 'Other') as InsiderRelationship,
      securityTitle: row.SECURITY_TITLE || 'Common Stock',
      transactionCode: (row.TRANS_CODE || 'P') as TransactionCode,
      acquiredDisposed: (row.TRANS_ACQUIRED_DISP_CD || 'A') as AcquiredDisposedCode,
      shares: row.TRANS_SHARES || 0,
      pricePerShare: row.TRANS_PRICEPERSHARE,
      totalValue: row.TRANS_SHARES && row.TRANS_PRICEPERSHARE
        ? row.TRANS_SHARES * row.TRANS_PRICEPERSHARE
        : null,
      sharesOwnedAfter: row.SHRS_OWND_FOLWNG_TRANS,
      isDerivative: false,
      ownershipType: (row.DIRECT_INDIRECT_OWNERSHIP || 'D') as OwnershipType,
    }))

    // Calculate stats
    const now = Date.now()
    const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000
    const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000

    const transLast30 = transactions.filter(t => t.transactionDate >= thirtyDaysAgo)
    const transLast90 = transactions.filter(t => t.transactionDate >= ninetyDaysAgo)

    const calcNetShares = (trans: InsiderTransaction[]) =>
      trans.reduce((sum, t) => {
        const shares = t.shares || 0
        return sum + (t.acquiredDisposed === 'A' ? shares : -shares)
      }, 0)

    // Get top insiders
    const insiderMap = new Map<string, {
      cik: string
      name: string
      title: string | null
      relationship: InsiderRelationship
      transactionCount: number
      netShares: number
    }>()

    for (const t of transactions) {
      const existing = insiderMap.get(t.insiderCik)
      const shares = t.acquiredDisposed === 'A' ? t.shares : -t.shares
      if (existing) {
        existing.transactionCount++
        existing.netShares += shares
      } else {
        insiderMap.set(t.insiderCik, {
          cik: t.insiderCik,
          name: t.insiderName,
          title: t.insiderTitle,
          relationship: t.relationship,
          transactionCount: 1,
          netShares: shares,
        })
      }
    }

    const topInsiders = Array.from(insiderMap.values())
      .sort((a, b) => b.transactionCount - a.transactionCount)
      .slice(0, 10)

    // Find largest transaction
    const largestTransaction = transactions.reduce<InsiderTransaction | null>((max, t) => {
      const value = t.totalValue || 0
      const maxValue = max?.totalValue || 0
      return value > maxValue ? t : max
    }, null)

    return {
      ticker: upperTicker,
      issuerName: rows[0].ISSUERNAME,
      recentTransactions: transactions,
      stats: {
        totalInsiders: insiderMap.size,
        netSharesLast30Days: calcNetShares(transLast30),
        netSharesLast90Days: calcNetShares(transLast90),
        totalBuysLast90Days: transLast90.filter(t => t.acquiredDisposed === 'A').length,
        totalSalesLast90Days: transLast90.filter(t => t.acquiredDisposed === 'D').length,
        largestTransaction,
      },
      topInsiders,
    }
  } catch (error) {
    console.error('Error fetching ticker insider activity:', error)
    return null
  }
}

/**
 * Get insider profile by CIK
 */
export async function getInsiderProfile({
  cik,
}: {
  cik: string
}): Promise<InsiderProfile | null> {
  try {
    // Get insider info and transactions
    const rows = await queryForm345<{
      ACCESSION_NUMBER: string
      FILING_DATE: string
      TRANS_DATE: string
      ISSUERTRADINGSYMBOL: string
      ISSUERNAME: string
      ISSUERCIK: string
      RPTOWNERNAME: string
      RPTOWNER_TITLE: string | null
      RPTOWNER_RELATIONSHIP: string
      SECURITY_TITLE: string
      TRANS_CODE: string
      TRANS_ACQUIRED_DISP_CD: string
      TRANS_SHARES: number | null
      TRANS_PRICEPERSHARE: number | null
      SHRS_OWND_FOLWNG_TRANS: number | null
      DIRECT_INDIRECT_OWNERSHIP: string
    }>(`
      SELECT
        s.ACCESSION_NUMBER,
        s.FILING_DATE,
        t.TRANS_DATE,
        s.ISSUERTRADINGSYMBOL,
        s.ISSUERNAME,
        s.ISSUERCIK,
        r.RPTOWNERNAME,
        r.RPTOWNER_TITLE,
        r.RPTOWNER_RELATIONSHIP,
        t.SECURITY_TITLE,
        t.TRANS_CODE,
        t.TRANS_ACQUIRED_DISP_CD,
        t.TRANS_SHARES,
        t.TRANS_PRICEPERSHARE,
        t.SHRS_OWND_FOLWNG_TRANS,
        t.DIRECT_INDIRECT_OWNERSHIP
      FROM form345_submissions s
      JOIN form345_reporting_owners r ON s.ACCESSION_NUMBER = r.ACCESSION_NUMBER
      LEFT JOIN form345_nonderiv_trans t ON s.ACCESSION_NUMBER = t.ACCESSION_NUMBER
      WHERE r.RPTOWNERCIK = '${cik}'
      ORDER BY s.FILING_DATE DESC, t.TRANS_DATE DESC
      LIMIT 200
    `)

    if (rows.length === 0) {
      return null
    }

    const insiderName = rows[0].RPTOWNERNAME

    // Build transactions list (filter out null trans_date which means no transaction)
    const transactions: InsiderTransaction[] = rows
      .filter(row => row.TRANS_DATE && row.TRANS_SHARES)
      .map(row => ({
        accessionNumber: row.ACCESSION_NUMBER,
        filingDate: parseSecDate(row.FILING_DATE),
        transactionDate: parseSecDate(row.TRANS_DATE),
        ticker: row.ISSUERTRADINGSYMBOL || '',
        issuerName: row.ISSUERNAME,
        issuerCik: row.ISSUERCIK,
        insiderCik: cik,
        insiderName: row.RPTOWNERNAME,
        insiderTitle: row.RPTOWNER_TITLE,
        relationship: (row.RPTOWNER_RELATIONSHIP || 'Other') as InsiderRelationship,
        securityTitle: row.SECURITY_TITLE || 'Common Stock',
        transactionCode: (row.TRANS_CODE || 'P') as TransactionCode,
        acquiredDisposed: (row.TRANS_ACQUIRED_DISP_CD || 'A') as AcquiredDisposedCode,
        shares: row.TRANS_SHARES || 0,
        pricePerShare: row.TRANS_PRICEPERSHARE,
        totalValue: row.TRANS_SHARES && row.TRANS_PRICEPERSHARE
          ? row.TRANS_SHARES * row.TRANS_PRICEPERSHARE
          : null,
        sharesOwnedAfter: row.SHRS_OWND_FOLWNG_TRANS,
        isDerivative: false,
        ownershipType: (row.DIRECT_INDIRECT_OWNERSHIP || 'D') as OwnershipType,
      }))

    // Build current positions (most recent filing per company)
    const positionMap = new Map<string, {
      ticker: string
      issuerName: string
      relationship: InsiderRelationship
      title: string | null
      sharesOwned: number
      lastFilingDate: number
    }>()

    for (const row of rows) {
      const ticker = row.ISSUERTRADINGSYMBOL || row.ISSUERCIK
      if (!positionMap.has(ticker)) {
        positionMap.set(ticker, {
          ticker: row.ISSUERTRADINGSYMBOL || '',
          issuerName: row.ISSUERNAME,
          relationship: (row.RPTOWNER_RELATIONSHIP || 'Other') as InsiderRelationship,
          title: row.RPTOWNER_TITLE,
          sharesOwned: row.SHRS_OWND_FOLWNG_TRANS || 0,
          lastFilingDate: parseSecDate(row.FILING_DATE),
        })
      }
    }

    const currentPositions = Array.from(positionMap.values())
      .filter(p => p.sharesOwned > 0)
      .sort((a, b) => b.lastFilingDate - a.lastFilingDate)

    // Calculate stats
    const netSharesAllTime = transactions.reduce((sum, t) => {
      const shares = t.shares || 0
      return sum + (t.acquiredDisposed === 'A' ? shares : -shares)
    }, 0)

    return {
      cik,
      name: insiderName,
      currentPositions,
      recentTransactions: transactions.slice(0, 50),
      stats: {
        totalCompanies: positionMap.size,
        totalTransactions: transactions.length,
        netSharesAllTime,
      },
    }
  } catch (error) {
    console.error('Error fetching insider profile:', error)
    return null
  }
}

/**
 * Search for insiders by name
 */
export async function searchInsiders({
  query,
  limit = 20,
}: {
  query: string
  limit?: number
}): Promise<{ cik: string; name: string; companies: number }[]> {
  try {
    const searchTerm = query.toUpperCase()

    const rows = await queryForm345<{
      RPTOWNERCIK: string
      RPTOWNERNAME: string
      company_count: number
    }>(`
      SELECT
        RPTOWNERCIK,
        RPTOWNERNAME,
        COUNT(DISTINCT ACCESSION_NUMBER) as company_count
      FROM form345_reporting_owners
      WHERE UPPER(RPTOWNERNAME) LIKE '%${searchTerm}%'
      GROUP BY RPTOWNERCIK, RPTOWNERNAME
      ORDER BY company_count DESC
      LIMIT ${limit}
    `)

    return rows.map(row => ({
      cik: row.RPTOWNERCIK,
      name: row.RPTOWNERNAME,
      companies: row.company_count,
    }))
  } catch (error) {
    console.error('Error searching insiders:', error)
    return []
  }
}
