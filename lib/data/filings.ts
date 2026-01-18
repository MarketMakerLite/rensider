/**
 * Data access layer for SEC filings
 * Uses DuckDB tables for efficient querying
 */

import { query } from '../sec/duckdb'
import { getFilerNames } from '../sec/filer-names'
import { parseDateToTimestamp } from '../validators/dates'
import type { Filing } from '@/types/ownership'

/**
 * Convert PERIODOFREPORT (DD-MMM-YYYY format) to quarter string (YYYY-QN)
 */
function periodToQuarter(periodOfReport: string): string | null {
  const months: Record<string, number> = {
    'JAN': 1, 'FEB': 2, 'MAR': 3, 'APR': 4, 'MAY': 5, 'JUN': 6,
    'JUL': 7, 'AUG': 8, 'SEP': 9, 'OCT': 10, 'NOV': 11, 'DEC': 12,
  }

  const match = periodOfReport?.match(/^\d{2}-([A-Z]{3})-(\d{4})$/i)
  if (!match) return null

  const monthNum = months[match[1].toUpperCase()]
  const year = match[2]

  if (!monthNum || !year) return null

  const quarter = Math.ceil(monthNum / 3)
  return `${year}-Q${quarter}`
}

/**
 * Infer quarter from filing date using fuzzy matching
 * 13F filings are due within 45 days of quarter end:
 * - Q1 (Mar 31) -> due by May 15
 * - Q2 (Jun 30) -> due by Aug 14
 * - Q3 (Sep 30) -> due by Nov 14
 * - Q4 (Dec 31) -> due by Feb 14
 */
function inferQuarterFromFilingDate(filingDate: string): string | null {
  if (!filingDate) return null

  // Parse various date formats (YYYY-MM-DD, MM/DD/YYYY, etc.)
  const date = new Date(filingDate)
  if (isNaN(date.getTime())) {
    console.log('Failed to parse filing date:', filingDate)
    return null
  }

  const month = date.getMonth() + 1 // 1-12
  const year = date.getFullYear()

  // Map filing month to the quarter being reported
  // Jan-Feb 14: Q4 of previous year
  // Feb 15-May 15: Q1 of current year
  // May 16-Aug 14: Q2 of current year
  // Aug 15-Nov 14: Q3 of current year
  // Nov 15-Dec 31: Q4 of current year

  if (month === 1 || (month === 2 && date.getDate() <= 14)) {
    return `${year - 1}-Q4`
  } else if (month >= 2 && month <= 5 && (month < 5 || date.getDate() <= 15)) {
    return `${year}-Q1`
  } else if (month >= 5 && month <= 8 && (month < 8 || date.getDate() <= 14)) {
    return `${year}-Q2`
  } else if (month >= 8 && month <= 11 && (month < 11 || date.getDate() <= 14)) {
    return `${year}-Q3`
  } else {
    return `${year}-Q4`
  }
}

/**
 * Get recent 13F filings
 */
export async function getRecentFilings(options: {
  days?: number
  limit?: number
}): Promise<Filing[]> {
  const { days = 365, limit = 100 } = options

  try {
    // Query submissions with holdings aggregation
    // Order by FILING_DATE to show most recently filed documents first
    const results = await query<{
      ACCESSION_NUMBER: string
      CIK: string
      SUBMISSIONTYPE: string
      PERIODOFREPORT: string
      FILING_DATE: string
      holdings_count: number
      total_value: number
    }>(`
      SELECT
        s.ACCESSION_NUMBER,
        s.CIK,
        s.SUBMISSIONTYPE,
        s.PERIODOFREPORT,
        s.FILING_DATE,
        COUNT(h.CUSIP) as holdings_count,
        COALESCE(SUM(h.VALUE), 0) as total_value
      FROM submissions_13f s
      LEFT JOIN holdings_13f h ON s.ACCESSION_NUMBER = h.ACCESSION_NUMBER
      WHERE s.FILING_DATE IS NOT NULL
      GROUP BY s.ACCESSION_NUMBER, s.CIK, s.SUBMISSIONTYPE, s.PERIODOFREPORT, s.FILING_DATE
      ORDER BY s.ACCESSION_NUMBER DESC
      LIMIT ${limit}
    `)

    // Batch resolve filer names
    const ciks = [...new Set(results.map(r => r.CIK))]
    const filerNamesMap = await getFilerNames(ciks)

    return results.map(r => ({
      accessionNumber: r.ACCESSION_NUMBER,
      cik: r.CIK,
      institutionName: filerNamesMap.get(r.CIK) || 'Unknown',
      filingDate: parseDateToTimestamp(r.FILING_DATE) ?? 0,
      reportDate: parseDateToTimestamp(r.PERIODOFREPORT) ?? 0,
      quarter: periodToQuarter(r.PERIODOFREPORT) || inferQuarterFromFilingDate(r.FILING_DATE) || '',
      formType: r.SUBMISSIONTYPE || '13F-HR',
      holdingsCount: Number(r.holdings_count),
      totalValue: Number(r.total_value),
    }))
  } catch (error) {
    console.error('Error fetching recent filings:', error)
    return []
  }
}

/**
 * Get filings for a specific filer
 */
export async function getFilerFilings(cik: string, limit: number = 20): Promise<Filing[]> {
  const normalizedCik = cik.replace(/^0+/, '')

  try {
    // Query submissions for this filer with holdings aggregation
    const results = await query<{
      ACCESSION_NUMBER: string
      CIK: string
      SUBMISSIONTYPE: string
      PERIODOFREPORT: string
      FILING_DATE: string
      holdings_count: number
      total_value: number
    }>(`
      SELECT
        s.ACCESSION_NUMBER,
        s.CIK,
        s.SUBMISSIONTYPE,
        s.PERIODOFREPORT,
        s.FILING_DATE,
        COUNT(h.CUSIP) as holdings_count,
        COALESCE(SUM(h.VALUE), 0) as total_value
      FROM submissions_13f s
      LEFT JOIN holdings_13f h ON s.ACCESSION_NUMBER = h.ACCESSION_NUMBER
      WHERE (LTRIM(s.CIK, '0') = '${normalizedCik}' OR s.CIK = '${normalizedCik}')
      GROUP BY s.ACCESSION_NUMBER, s.CIK, s.SUBMISSIONTYPE, s.PERIODOFREPORT, s.FILING_DATE
      ORDER BY s.FILING_DATE DESC
      LIMIT ${limit}
    `)

    // Batch resolve filer names
    const ciks = [...new Set(results.map(r => r.CIK))]
    const filerNamesMap = await getFilerNames(ciks)

    return results.map(r => ({
      accessionNumber: r.ACCESSION_NUMBER,
      cik: r.CIK,
      institutionName: filerNamesMap.get(r.CIK) || 'Unknown',
      filingDate: parseDateToTimestamp(r.FILING_DATE) ?? 0,
      reportDate: parseDateToTimestamp(r.PERIODOFREPORT) ?? 0,
      quarter: periodToQuarter(r.PERIODOFREPORT) || inferQuarterFromFilingDate(r.FILING_DATE) || '',
      formType: r.SUBMISSIONTYPE || '13F-HR',
      holdingsCount: Number(r.holdings_count),
      totalValue: Number(r.total_value),
    }))
  } catch (error) {
    console.error('Error fetching filer filings:', error instanceof Error ? error.message : error)
    return []
  }
}
