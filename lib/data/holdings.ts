/**
 * Data access layer for 13F institutional holdings
 * Uses DuckDB tables for efficient querying
 */

import { getFilerHoldings as queryFilerHoldings } from '../sec/queries'
import { query } from '../sec/duckdb'
import { getFilerNames } from '../sec/filer-names'
import { parseDate, parseDateToTimestamp } from '../validators/dates'
import type {
  StockOwnershipData,
  FundHoldingsData,
  OwnershipHistoryEntry,
  Holding,
  OwnershipMetrics,
  SentimentScore,
  RecentFiler,
  ConcentrationMetrics,
} from '@/types/ownership'

// Cache for available quarters
let quartersCache: { quarters: string[]; loadedAt: number } | null = null
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes

/**
 * Convert PERIODOFREPORT (DD-MMM-YYYY format) to quarter string (YYYY-QN)
 */
function periodToQuarter(periodOfReport: string): string | null {
  // Parse DD-MMM-YYYY format
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

// Get list of available quarters from DuckDB tables
async function getAvailableQuarters(): Promise<string[]> {
  const now = Date.now()
  if (quartersCache && now - quartersCache.loadedAt < CACHE_TTL_MS) {
    return quartersCache.quarters
  }

  try {
    // Get distinct periods and convert to quarters
    const result = await query<{ PERIODOFREPORT: string }>(`
      SELECT DISTINCT PERIODOFREPORT
      FROM submissions_13f
      WHERE PERIODOFREPORT IS NOT NULL
      ORDER BY PERIODOFREPORT DESC
    `)

    // Convert to quarters and deduplicate
    const quarterSet = new Set<string>()
    for (const r of result) {
      const q = periodToQuarter(r.PERIODOFREPORT)
      if (q) quarterSet.add(q)
    }

    const quarters = Array.from(quarterSet).sort().reverse()
    quartersCache = { quarters, loadedAt: now }
    return quarters
  } catch (error) {
    console.error('Error getting available quarters:', error)
    return []
  }
}

/**
 * Get stock ownership data for a ticker
 * Searches DuckDB tables for holdings matching the company's CUSIP(s)
 */
export async function getStockOwnershipData(ticker: string): Promise<StockOwnershipData | null> {
  const upperTicker = ticker.toUpperCase()

  try {
    // Get company info and CUSIPs
    const companyInfo = await lookupCompanyByTicker(upperTicker)
    if (!companyInfo || companyInfo.cusips.length === 0) {
      console.debug(`No CUSIPs found for ticker ${upperTicker}`)
      return null
    }

    const cusips = companyInfo.cusips

    // Build CUSIP filter for SQL
    const cusipList = cusips.map(c => `'${c}'`).join(',')

    // First, find the most recent quarter that has data for this CUSIP
    const latestPeriodResult = await query<{ PERIODOFREPORT: string }>(`
      SELECT DISTINCT s.PERIODOFREPORT
      FROM holdings_13f h
      JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
      WHERE h.CUSIP IN (${cusipList})
        AND s.PERIODOFREPORT IS NOT NULL
      ORDER BY TRY_STRPTIME(s.PERIODOFREPORT, '%d-%b-%Y') DESC
      LIMIT 1
    `)

    if (latestPeriodResult.length === 0) {
      console.debug(`No holdings found for ${upperTicker} CUSIPs: ${cusips.join(', ')}`)
      return null
    }

    const latestPeriod = latestPeriodResult[0].PERIODOFREPORT
    const latestQuarter = periodToQuarter(latestPeriod) || 'Unknown'

    // Get previous quarter's period for comparison
    const prevPeriodResult = await query<{ PERIODOFREPORT: string }>(`
      SELECT DISTINCT s.PERIODOFREPORT
      FROM holdings_13f h
      JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
      WHERE h.CUSIP IN (${cusipList})
        AND s.PERIODOFREPORT IS NOT NULL
        AND TRY_STRPTIME(s.PERIODOFREPORT, '%d-%b-%Y') < TRY_STRPTIME('${latestPeriod}', '%d-%b-%Y')
      ORDER BY TRY_STRPTIME(s.PERIODOFREPORT, '%d-%b-%Y') DESC
      LIMIT 1
    `)
    const prevPeriod = prevPeriodResult.length > 0 ? prevPeriodResult[0].PERIODOFREPORT : null

    // Use DuckDB to efficiently query holdings for these CUSIPs in the latest period
    const results = await query<{
      CUSIP: string
      NAMEOFISSUER: string
      TITLEOFCLASS: string
      VALUE: number
      SSHPRNAMT: number
      SSHPRNAMTTYPE: string
      PUTCALL: string | null
      INVESTMENTDISCRETION: string
      CIK: string
      PERIODOFREPORT: string
      FILING_DATE: string
    }>(`
      SELECT
        h.CUSIP,
        h.NAMEOFISSUER,
        h.TITLEOFCLASS,
        h.VALUE,
        h.SSHPRNAMT,
        h.SSHPRNAMTTYPE,
        h.PUTCALL,
        h.INVESTMENTDISCRETION,
        s.CIK,
        s.PERIODOFREPORT,
        s.FILING_DATE
      FROM holdings_13f h
      JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
      WHERE s.PERIODOFREPORT = '${latestPeriod}'
        AND h.CUSIP IN (${cusipList})
      ORDER BY h.VALUE DESC
    `)

    if (results.length === 0) {
      console.debug(`No holdings found for ${upperTicker} CUSIPs: ${cusips.join(', ')} in period ${latestPeriod}`)
      return null
    }

    // Get previous quarter holdings for comparison (if available)
    const prevHoldingsMap = new Map<string, number>() // CIK -> shares
    if (prevPeriod) {
      const prevResults = await query<{ CIK: string; SSHPRNAMT: number }>(`
        SELECT s.CIK, SUM(h.SSHPRNAMT) as SSHPRNAMT
        FROM holdings_13f h
        JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
        WHERE s.PERIODOFREPORT = '${prevPeriod}'
          AND h.CUSIP IN (${cusipList})
        GROUP BY s.CIK
      `)
      for (const r of prevResults) {
        prevHoldingsMap.set(r.CIK, Number(r.SSHPRNAMT))
      }
    }

    // Get filer names from cache (fetchMissing: false to avoid rate limiting/hanging)
    // Names show as placeholders initially, fetched in background for future requests
    const uniqueCiks = [...new Set(results.map(r => r.CIK))]
    const filerNamesMap = await getFilerNames(uniqueCiks, { fetchMissing: false })

    // Aggregate current holdings by CIK for change calculation
    const currentByInstitution = new Map<string, { shares: number; value: number }>()
    for (const r of results) {
      const existing = currentByInstitution.get(r.CIK) || { shares: 0, value: 0 }
      currentByInstitution.set(r.CIK, {
        shares: existing.shares + Number(r.SSHPRNAMT),
        value: existing.value + Number(r.VALUE),
      })
    }

    // Calculate changeType and changePercent for each institution
    const changeInfoMap = new Map<string, { changeType: Holding['changeType']; changePercent: number | null }>()
    for (const [cik, current] of currentByInstitution) {
      const prevShares = prevHoldingsMap.get(cik)

      if (prevShares === undefined) {
        // New position
        changeInfoMap.set(cik, { changeType: 'NEW', changePercent: 100 })
      } else if (current.shares === 0) {
        // Closed position (shouldn't happen if they're in results, but just in case)
        changeInfoMap.set(cik, { changeType: 'CLOSED', changePercent: -100 })
      } else {
        const changePercent = prevShares > 0
          ? ((current.shares - prevShares) / prevShares) * 100
          : 100

        if (changePercent > 5) {
          changeInfoMap.set(cik, { changeType: 'ADDED', changePercent })
        } else if (changePercent < -5) {
          changeInfoMap.set(cik, { changeType: 'REDUCED', changePercent })
        } else {
          changeInfoMap.set(cik, { changeType: 'UNCHANGED', changePercent })
        }
      }
    }

    // Mark closed positions (in previous but not in current)
    const closedCiks: string[] = []
    for (const cik of prevHoldingsMap.keys()) {
      if (!currentByInstitution.has(cik)) {
        closedCiks.push(cik)
      }
    }

    const latestHoldings: Holding[] = results.map((r, idx) => {
      const changeInfo = changeInfoMap.get(r.CIK) || { changeType: null, changePercent: null }
      return {
        id: idx,
        cik: r.CIK,
        institutionName: filerNamesMap.get(r.CIK) || `CIK ${r.CIK}`,
        ticker: upperTicker,
        cusip: r.CUSIP,
        securityName: r.NAMEOFISSUER,
        shares: Number(r.SSHPRNAMT),
        value: Number(r.VALUE),
        filingDate: parseDateToTimestamp(r.FILING_DATE) ?? parseDateToTimestamp(r.PERIODOFREPORT) ?? Date.now(),
        reportDate: parseDateToTimestamp(r.PERIODOFREPORT) ?? Date.now(),
        quarter: latestQuarter,
        putCall: r.PUTCALL as 'PUT' | 'CALL' | null || null,
        changeType: changeInfo.changeType,
        changePercent: changeInfo.changePercent,
      }
    })

    // Calculate metrics (including closed positions)
    const metrics = calculateMetrics(latestHoldings, closedCiks.length)
    const sentiment = calculateSentiment(latestHoldings, latestQuarter, closedCiks.length)
    const concentrationMetrics = await calculateConcentration(latestHoldings)
    const recentFilers = getRecentFilers(latestHoldings)
    const putCallRatio = calculatePutCallRatio(latestHoldings)

    return {
      ticker: upperTicker,
      companyName: companyInfo.name,
      holders: latestHoldings,
      metrics,
      sentiment,
      putCallRatio,
      historicalChanges: [{
        quarter: latestQuarter,
        newPositions: 0,
        addedPositions: 0,
        reducedPositions: 0,
        closedPositions: 0,
        totalHolders: new Set(latestHoldings.map(h => h.cik)).size,
        totalValue: latestHoldings.reduce((sum, h) => sum + h.value, 0),
      }],
      recentFilers,
      concentrationMetrics,
      lastUpdated: Date.now(),
    }
  } catch (error) {
    console.error('Error fetching stock ownership:', error)
    return null
  }
}

/**
 * Get fund holdings by CIK
 * Uses DuckDB to query Parquet files directly
 * @param maxHoldings - Maximum number of holdings to return (default 500)
 */
export async function getFundHoldingsData(cik: string, maxHoldings: number = 500): Promise<FundHoldingsData | null> {
  const normalizedCik = cik.replace(/^0+/, '')

  try {
    // Get holdings using DuckDB-powered query
    const holdings = await queryFilerHoldings(normalizedCik)

    if (holdings.length === 0) {
      return null
    }

    // Get filer name from holdings result (from database)
    const filerName = holdings[0]?.filingmanager_name || `CIK ${normalizedCik}`

    // Calculate totals from all holdings before limiting
    // Note: h.value is in thousands (as SEC reports), display layer converts to dollars
    const totalPositions = holdings.length
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)

    // Sort by value descending and limit
    const sortedHoldings = [...holdings].sort((a, b) => b.value - a.value)
    const limitedHoldings = sortedHoldings.slice(0, maxHoldings)

    // Convert to Holding type
    const holdingRecords: Holding[] = limitedHoldings.map((h, idx) => {
      // Derive quarter from filing date
      const filingDate = parseDate(h.filing_date)
      const filingMonth = filingDate.getMonth() + 1
      const filingYear = filingDate.getFullYear()
      const quarterNum = Math.ceil(filingMonth / 3)
      const quarter = `${filingYear}-Q${quarterNum}`

      return {
        id: idx + 1,
        cik: normalizedCik,
        institutionName: filerName || 'Unknown',
        cusip: h.cusip,
        ticker: h.ticker || '',
        securityName: h.name_of_issuer,
        shares: h.shares,
        value: h.value, // Keep in thousands (as SEC reports), display layer converts
        quarter,
        filingDate: filingDate.getTime(),
        reportDate: parseDateToTimestamp(h.period_of_report) ?? 0,
        putCall: h.put_call as 'PUT' | 'CALL' | null || null,
        changeType: 'UNCHANGED',
        changePercent: null,
      }
    })

    return {
      cik: normalizedCik,
      institutionName: filerName || 'Unknown',
      holdings: holdingRecords,
      totalValue,
      positionCount: totalPositions, // Total positions, not limited count
      topHoldings: holdingRecords.slice(0, 10),
      lastUpdated: Date.now(),
    }
  } catch (error) {
    console.error(`Error fetching fund holdings for CIK ${cik}:`, error instanceof Error ? error.message : error)
    return null
  }
}

/**
 * Get ownership history for a ticker across multiple quarters
 * Uses DuckDB tables for efficient querying
 * Calculates position changes by comparing holder lists between quarters
 */
export async function getOwnershipHistoryData(
  ticker: string,
  quarterCount: number = 8
): Promise<OwnershipHistoryEntry[]> {
  const upperTicker = ticker.toUpperCase()

  try {
    // Get company CUSIPs
    const companyInfo = await lookupCompanyByTicker(upperTicker)
    if (!companyInfo || companyInfo.cusips.length === 0) {
      return []
    }

    const cusips = companyInfo.cusips
    const availableQuarters = await getAvailableQuarters()
    const quartersToQuery = availableQuarters.slice(0, quarterCount)

    if (quartersToQuery.length === 0) {
      return []
    }

    const cusipList = cusips.map(c => `'${c}'`).join(',')

    // Build quarter filter helper
    const getQuarterMonthFilter = (quarter: string): string | null => {
      const quarterMatch = quarter.match(/^(\d{4})-Q([1-4])$/)
      if (!quarterMatch) return null
      const quarterYear = quarterMatch[1]
      const quarterNum = parseInt(quarterMatch[2], 10)
      const quarterMonths: Record<number, string[]> = {
        1: ['JAN', 'FEB', 'MAR'],
        2: ['APR', 'MAY', 'JUN'],
        3: ['JUL', 'AUG', 'SEP'],
        4: ['OCT', 'NOV', 'DEC'],
      }
      return quarterMonths[quarterNum].map(m => `s.PERIODOFREPORT LIKE '%-${m}-${quarterYear}'`).join(' OR ')
    }

    // First pass: gather CIKs and totals for each quarter
    const quarterData: Map<string, { ciks: Set<string>; totalValue: number; totalHolders: number }> = new Map()

    for (const quarter of quartersToQuery) {
      try {
        const monthsFilter = getQuarterMonthFilter(quarter)
        if (!monthsFilter) continue

        // Get all CIKs holding this security in this quarter with their values
        const result = await query<{
          CIK: string
          total_value: number
        }>(`
          SELECT
            s.CIK,
            SUM(h.VALUE) as total_value
          FROM holdings_13f h
          JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
          WHERE (${monthsFilter})
            AND h.CUSIP IN (${cusipList})
          GROUP BY s.CIK
        `)

        if (result.length > 0) {
          const ciks = new Set(result.map(r => r.CIK))
          const totalValue = result.reduce((sum, r) => sum + Number(r.total_value), 0)
          quarterData.set(quarter, {
            ciks,
            totalValue,
            totalHolders: ciks.size,
          })
        }
      } catch (error) {
        console.debug(`Error reading quarter ${quarter}:`, error instanceof Error ? error.message : error)
      }
    }

    // Sort quarters chronologically
    const sortedQuarters = Array.from(quarterData.keys()).sort()

    // Second pass: calculate position changes between consecutive quarters
    const history: OwnershipHistoryEntry[] = []

    for (let i = 0; i < sortedQuarters.length; i++) {
      const quarter = sortedQuarters[i]
      const current = quarterData.get(quarter)!
      const previous = i > 0 ? quarterData.get(sortedQuarters[i - 1]) : null

      let newPositions = 0
      let closedPositions = 0

      if (previous) {
        // New positions: CIKs in current but not in previous
        for (const cik of current.ciks) {
          if (!previous.ciks.has(cik)) {
            newPositions++
          }
        }
        // Closed positions: CIKs in previous but not in current
        for (const cik of previous.ciks) {
          if (!current.ciks.has(cik)) {
            closedPositions++
          }
        }
      } else {
        // First quarter: all positions are "new"
        newPositions = current.totalHolders
      }

      history.push({
        quarter,
        newPositions,
        addedPositions: 0, // Would need share comparison to calculate
        reducedPositions: 0, // Would need share comparison to calculate
        closedPositions,
        totalHolders: current.totalHolders,
        totalValue: current.totalValue,
      })
    }

    return history
  } catch (error) {
    console.error(`Error fetching ownership history for ${ticker}:`, error instanceof Error ? error.message : error)
    return []
  }
}

/**
 * Get fund portfolio history (AUM across quarters)
 * Used for OG image chart generation
 */
export async function getFundPortfolioHistory(
  cik: string,
  quarterCount: number = 6
): Promise<{ quarter: string; totalValue: number; positionCount: number }[]> {
  const normalizedCik = cik.replace(/^0+/, '')

  try {
    const availableQuarters = await getAvailableQuarters()
    const quartersToQuery = availableQuarters.slice(0, quarterCount)

    if (quartersToQuery.length === 0) {
      return []
    }

    // Build quarter filter helper
    const getQuarterMonthFilter = (quarter: string): string | null => {
      const quarterMatch = quarter.match(/^(\d{4})-Q([1-4])$/)
      if (!quarterMatch) return null
      const quarterYear = quarterMatch[1]
      const quarterNum = parseInt(quarterMatch[2], 10)
      const quarterMonths: Record<number, string[]> = {
        1: ['JAN', 'FEB', 'MAR'],
        2: ['APR', 'MAY', 'JUN'],
        3: ['JUL', 'AUG', 'SEP'],
        4: ['OCT', 'NOV', 'DEC'],
      }
      return quarterMonths[quarterNum].map(m => `s.PERIODOFREPORT LIKE '%-${m}-${quarterYear}'`).join(' OR ')
    }

    const history: { quarter: string; totalValue: number; positionCount: number }[] = []

    for (const quarter of quartersToQuery) {
      try {
        const monthsFilter = getQuarterMonthFilter(quarter)
        if (!monthsFilter) continue

        // Get total AUM and position count for this fund in this quarter
        const result = await query<{
          total_value: number
          position_count: number
        }>(`
          SELECT
            SUM(h.VALUE) as total_value,
            COUNT(*) as position_count
          FROM holdings_13f h
          JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
          WHERE (${monthsFilter})
            AND (LTRIM(s.CIK, '0') = '${normalizedCik}' OR s.CIK = '${normalizedCik}')
        `)

        if (result.length > 0 && result[0].total_value) {
          history.push({
            quarter,
            totalValue: Number(result[0].total_value),
            positionCount: Number(result[0].position_count),
          })
        }
      } catch (error) {
        console.debug(`Error reading quarter ${quarter} for CIK ${cik}:`, error instanceof Error ? error.message : error)
      }
    }

    // Sort chronologically (oldest first for chart display)
    return history.sort((a, b) => a.quarter.localeCompare(b.quarter))
  } catch (error) {
    console.error(`Error fetching fund portfolio history for CIK ${cik}:`, error instanceof Error ? error.message : error)
    return []
  }
}

// Helper functions

async function lookupCompanyByTicker(ticker: string): Promise<{ name: string; cusips: string[] } | null> {
  try {
    const searchTerm = ticker.toUpperCase()

    // First try to find CUSIPs from cusip_mappings table (ticker -> CUSIP)
    // Use exact match since OpenFIGI returns uppercase tickers (matches our index)
    const mappedCusips = await query<{
      cusip: string
      name: string | null
    }>(`
      SELECT cusip, name
      FROM rensider.cusip_mappings
      WHERE ticker = '${searchTerm}'
    `)

    if (mappedCusips.length > 0) {
      const cusips = mappedCusips.map(m => m.cusip)
      const companyName = mappedCusips[0].name || ticker
      return { name: companyName, cusips }
    }

    // Fallback: search in holdings_13f by issuer name starting with the ticker
    // Using prefix match instead of LIKE '%...%' for better performance
    const matches = await query<{
      CUSIP: string
      NAMEOFISSUER: string
    }>(`
      SELECT DISTINCT CUSIP, NAMEOFISSUER
      FROM holdings_13f
      WHERE UPPER(NAMEOFISSUER) LIKE '${searchTerm}%'
        AND LENGTH(CUSIP) = 9
        AND (PUTCALL IS NULL OR PUTCALL = '')
      LIMIT 10
    `)

    if (matches.length === 0) {
      return { name: ticker, cusips: [] }
    }

    const cusips = matches.map(m => m.CUSIP)
    const companyName = matches[0].NAMEOFISSUER

    return {
      name: companyName,
      cusips,
    }
  } catch (error) {
    console.error(`Error looking up company for ticker ${ticker}:`, error instanceof Error ? error.message : error)
    return { name: ticker, cusips: [] }
  }
}

function calculateMetrics(holdings: Holding[], closedCount: number = 0): OwnershipMetrics {
  const byInstitution = new Map<string, Holding[]>()

  for (const h of holdings) {
    const key = h.cik
    if (!byInstitution.has(key)) {
      byInstitution.set(key, [])
    }
    byInstitution.get(key)!.push(h)
  }

  // Count unique institutions by change type
  const ciksByChangeType = new Map<string, Set<string>>()
  for (const h of holdings) {
    if (h.changeType) {
      if (!ciksByChangeType.has(h.changeType)) {
        ciksByChangeType.set(h.changeType, new Set())
      }
      ciksByChangeType.get(h.changeType)!.add(h.cik)
    }
  }

  return {
    totalHolders: byInstitution.size,
    totalShares: holdings.reduce((sum, h) => sum + h.shares, 0),
    totalValue: holdings.reduce((sum, h) => sum + h.value, 0),
    newPositions: ciksByChangeType.get('NEW')?.size || 0,
    closedPositions: closedCount, // Closed positions are not in current holdings
    increasedPositions: ciksByChangeType.get('ADDED')?.size || 0,
    decreasedPositions: ciksByChangeType.get('REDUCED')?.size || 0,
    percentOfFloat: null,
  }
}

function calculateSentiment(holdings: Holding[], latestQuarter: string, closedCount: number = 0): SentimentScore {
  const latestHoldings = holdings.filter(h => h.quarter === latestQuarter)

  if (latestHoldings.length === 0) {
    return {
      score: 50,
      signal: 'NEUTRAL',
      components: {
        valueChange: 0,
        ownerCountChange: 0,
        concentrationHHI: 0,
        newVsClosed: 0,
      },
    }
  }

  // Count unique institutions by change type
  const ciksByChangeType = new Map<string, Set<string>>()
  for (const h of latestHoldings) {
    if (h.changeType) {
      if (!ciksByChangeType.has(h.changeType)) {
        ciksByChangeType.set(h.changeType, new Set())
      }
      ciksByChangeType.get(h.changeType)!.add(h.cik)
    }
  }

  const newPositions = ciksByChangeType.get('NEW')?.size || 0
  const closedPositions = closedCount // From previous quarter comparison
  const increasedPositions = ciksByChangeType.get('ADDED')?.size || 0
  const decreasedPositions = ciksByChangeType.get('REDUCED')?.size || 0

  const totalChanges = newPositions + closedPositions + increasedPositions + decreasedPositions
  const netChange = totalChanges > 0
    ? ((newPositions + increasedPositions) - (closedPositions + decreasedPositions)) / totalChanges
    : 0

  const totalValue = latestHoldings.reduce((sum, h) => sum + h.value, 0)
  const weightedChangePercent = totalValue > 0
    ? latestHoldings.reduce((sum, h) => sum + (h.value * (h.changePercent || 0)), 0) / totalValue
    : 0

  const byInstitution = new Map<string, number>()
  for (const h of latestHoldings) {
    const current = byInstitution.get(h.cik) || 0
    byInstitution.set(h.cik, current + h.value)
  }
  const shares = Array.from(byInstitution.values())
  const totalHolderValue = shares.reduce((a, b) => a + b, 0)
  const hhi = totalHolderValue > 0
    ? shares.reduce((sum, v) => sum + Math.pow((v / totalHolderValue) * 100, 2), 0)
    : 0

  const normalizedHHI = 1 - (hhi / 10000)

  const newVsClosed = (newPositions + closedPositions) > 0
    ? (newPositions - closedPositions) / (newPositions + closedPositions)
    : 0

  const components = {
    valueChange: Math.max(-50, Math.min(50, weightedChangePercent)),
    ownerCountChange: netChange * 25,
    concentrationHHI: normalizedHHI * 15,
    newVsClosed: newVsClosed * 10,
  }

  const rawScore = 50 + components.valueChange * 0.5 + components.ownerCountChange + components.concentrationHHI + components.newVsClosed
  const score = Math.max(0, Math.min(100, rawScore))

  let signal: SentimentScore['signal']
  if (score >= 60) {
    signal = 'BULLISH'
  } else if (score <= 40) {
    signal = 'BEARISH'
  } else {
    signal = 'NEUTRAL'
  }

  return {
    score: Math.round(score),
    signal,
    components,
  }
}

function calculateConcentration(holdings: Holding[]): ConcentrationMetrics {
  const byInstitution = new Map<string, { value: number; name: string | null }>()
  let totalValue = 0

  for (const h of holdings) {
    const existing = byInstitution.get(h.cik)
    if (existing) {
      existing.value += h.value
    } else {
      byInstitution.set(h.cik, { value: h.value, name: h.institutionName || null })
    }
    totalValue += h.value
  }

  const values = Array.from(byInstitution.entries())
    .sort((a, b) => b[1].value - a[1].value)

  const top10Value = values.slice(0, 10).reduce((sum, [, data]) => sum + data.value, 0)
  const top10Concentration = totalValue > 0 ? (top10Value / totalValue) * 100 : 0

  const hhi = values.reduce((sum, [, data]) => {
    const share = totalValue > 0 ? data.value / totalValue : 0
    return sum + share * share
  }, 0)

  const largestHolder = values[0]

  return {
    top10Concentration,
    herfindahlIndex: hhi * 10000,
    largestHolderPercent: largestHolder && totalValue > 0
      ? (largestHolder[1].value / totalValue) * 100
      : 0,
    largestHolderName: largestHolder?.[1].name || null,
  }
}

function getRecentFilers(holdings: Holding[]): RecentFiler[] {
  const byInstitution = new Map<string, Holding>()

  for (const h of holdings) {
    const existing = byInstitution.get(h.cik)
    if (!existing || h.filingDate > existing.filingDate) {
      byInstitution.set(h.cik, h)
    }
  }

  return Array.from(byInstitution.values())
    .sort((a, b) => b.filingDate - a.filingDate)
    .slice(0, 10)
    .map(h => ({
      cik: h.cik,
      institutionName: h.institutionName || 'Unknown',
      filingDate: h.filingDate,
      shares: h.shares,
      value: h.value,
      changeType: h.changeType,
      changePercent: h.changePercent,
    }))
}

function calculatePutCallRatio(holdings: Holding[]): number | null {
  const puts = holdings.filter(h => h.putCall === 'PUT')
  const calls = holdings.filter(h => h.putCall === 'CALL')

  if (calls.length === 0) return null

  const putValue = puts.reduce((sum, h) => sum + h.value, 0)
  const callValue = calls.reduce((sum, h) => sum + h.value, 0)

  return callValue > 0 ? putValue / callValue : null
}
