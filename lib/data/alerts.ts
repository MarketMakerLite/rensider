/**
 * Data access layer for ownership alerts
 * Tracks significant ownership accumulation patterns
 * Uses DuckDB tables for efficient querying
 */

import { query } from '../sec/duckdb'
import { getFilerNames } from '../sec/filer-names'
import type { Alert, AlertStats } from '@/types/ownership'
import {
  DEFAULT_MIN_CHANGE,
  DEFAULT_MAX_CHANGE,
  DEFAULT_MIN_START_VALUE,
  DEFAULT_LOOKBACK_MONTHS,
} from '@/lib/alert-constants'

// Cache key type for alert detection
interface AlertCacheKey {
  minChange: number
  maxChange: number
  minStartValue: number
  lookbackMonths: number
  onlyMappedAssets: boolean
}

// In-memory cache for detected alerts
let alertCache: { alerts: Alert[]; key: AlertCacheKey; loadedAt: number } | null = null
const CACHE_TTL_MS = 15 * 60 * 1000 // 15 minutes
let alertIdCounter = 1

/**
 * Clear the alerts cache (forces refresh on next request)
 */
export function clearAlertsCache(): void {
  alertCache = null
  alertIdCounter = 1
}

const MONTH_MAP: Record<string, number> = {
  'JAN': 0, 'FEB': 1, 'MAR': 2, 'APR': 3, 'MAY': 4, 'JUN': 5,
  'JUL': 6, 'AUG': 7, 'SEP': 8, 'OCT': 9, 'NOV': 10, 'DEC': 11,
}

/**
 * Parse DD-MMM-YYYY date format to Unix timestamp
 */
function parseSECDate(dateStr: string | null): number | undefined {
  if (!dateStr) return undefined

  const match = dateStr.match(/^(\d{2})-([A-Z]{3})-(\d{4})$/i)
  if (!match) return undefined

  const day = parseInt(match[1], 10)
  const month = MONTH_MAP[match[2].toUpperCase()]
  const year = parseInt(match[3], 10)

  if (month === undefined || isNaN(day) || isNaN(year)) return undefined

  return new Date(year, month, day).getTime()
}

/**
 * Convert PERIODOFREPORT (DD-MMM-YYYY format) to quarter string (YYYY-QN)
 */
function periodToQuarter(periodOfReport: string): string | null {
  const match = periodOfReport?.match(/^\d{2}-([A-Z]{3})-(\d{4})$/i)
  if (!match) return null

  const monthNum = MONTH_MAP[match[1].toUpperCase()]
  const year = match[2]

  if (monthNum === undefined || !year) return null

  const quarter = Math.ceil((monthNum + 1) / 3)
  return `${year}-Q${quarter}`
}

/**
 * Build SQL filter for a quarter based on PERIODOFREPORT
 */
function buildQuarterFilter(quarter: string, tableAlias: string = 's'): string {
  const match = quarter.match(/^(\d{4})-Q([1-4])$/)
  if (!match) return '1=0'

  const year = match[1]
  const quarterNum = parseInt(match[2], 10)
  const quarterMonths: Record<number, string[]> = {
    1: ['JAN', 'FEB', 'MAR'],
    2: ['APR', 'MAY', 'JUN'],
    3: ['JUL', 'AUG', 'SEP'],
    4: ['OCT', 'NOV', 'DEC'],
  }
  return quarterMonths[quarterNum].map(m => `${tableAlias}.PERIODOFREPORT LIKE '%-${m}-${year}'`).join(' OR ')
}

/**
 * Detect ownership alerts by comparing institutional ownership across quarters
 * Uses DuckDB tables to efficiently aggregate and compare holdings data
 */
async function detectAlerts(
  minChange: number,
  maxChange: number,
  minStartValue: number,
  lookbackMonths: number,
  onlyMappedAssets: boolean
): Promise<Alert[]> {
  const alerts: Alert[] = []

  try {
    // Get available quarters from submissions
    const quartersResult = await query<{ PERIODOFREPORT: string }>(`
      SELECT DISTINCT PERIODOFREPORT
      FROM submissions_13f
      WHERE PERIODOFREPORT IS NOT NULL
      ORDER BY PERIODOFREPORT DESC
    `)

    const quarterSet = new Set<string>()
    for (const r of quartersResult) {
      const q = periodToQuarter(r.PERIODOFREPORT)
      if (q) quarterSet.add(q)
    }
    const quarters = Array.from(quarterSet).sort().reverse()
    const quarterCount = Math.ceil(lookbackMonths / 3)

    if (quarters.length < 2) {
      console.debug('Not enough quarters for alert detection')
      return []
    }

    // Get quarters within lookback range
    const relevantQuarters = quarters.slice(0, Math.min(quarterCount, quarters.length))
    if (relevantQuarters.length < 2) return []

    const latestQuarter = relevantQuarters[0]
    const oldestQuarter = relevantQuarters[relevantQuarters.length - 1]

    console.debug(`Detecting alerts: comparing ${oldestQuarter} to ${latestQuarter} (min: ${minChange}x, max: ${maxChange}x, minStart: $${minStartValue}k, mapped only: ${onlyMappedAssets})`)

    const latestFilter = buildQuarterFilter(latestQuarter, 's')
    const oldestFilter = buildQuarterFilter(oldestQuarter, 's')

    // Use DuckDB to find securities with significant ownership increases
    // This compares total institutional ownership between two quarters
    // Note: largest_holders only returns CIK (FILINGMANAGER_NAME not available in MotherDuck schema)
    const mappedAssetsFilter = onlyMappedAssets
      ? `AND EXISTS (SELECT 1 FROM rensider.cusip_mappings cm WHERE cm.cusip = l.CUSIP)`
      : ''

    const sql = `
      WITH latest AS (
        SELECT
          h.CUSIP,
          ANY_VALUE(h.NAMEOFISSUER) as NAMEOFISSUER,
          SUM(h.VALUE) as total_value
        FROM holdings_13f h
        JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
        WHERE (${latestFilter})
        GROUP BY h.CUSIP
      ),
      oldest AS (
        SELECT
          h.CUSIP,
          SUM(h.VALUE) as total_value
        FROM holdings_13f h
        JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
        WHERE (${oldestFilter})
        GROUP BY h.CUSIP
      ),
      largest_holders AS (
        SELECT
          h.CUSIP,
          s.CIK as holder_cik,
          SUM(h.VALUE) as holder_value,
          ROW_NUMBER() OVER (PARTITION BY h.CUSIP ORDER BY SUM(h.VALUE) DESC) as rn
        FROM holdings_13f h
        JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
        WHERE (${latestFilter})
        GROUP BY h.CUSIP, s.CIK
      ),
      latest_filers AS (
        SELECT
          h.CUSIP,
          s.CIK as filer_cik,
          s.FILING_DATE,
          ROW_NUMBER() OVER (PARTITION BY h.CUSIP ORDER BY s.FILING_DATE DESC, s.ACCESSION_NUMBER DESC) as rn
        FROM holdings_13f h
        JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
        WHERE (${latestFilter})
      )
      SELECT
        l.CUSIP,
        l.NAMEOFISSUER,
        cm.ticker as mapped_ticker,
        o.total_value as previous_value,
        l.total_value as current_value,
        l.total_value / NULLIF(o.total_value, 0) as change_multiple,
        lh.holder_cik as largest_holder_cik,
        lh.holder_value as largest_holder_value,
        lf.filer_cik as latest_filer_cik,
        lf.FILING_DATE as latest_filing_date
      FROM latest l
      JOIN oldest o ON l.CUSIP = o.CUSIP
      LEFT JOIN largest_holders lh ON l.CUSIP = lh.CUSIP AND lh.rn = 1
      LEFT JOIN latest_filers lf ON l.CUSIP = lf.CUSIP AND lf.rn = 1
      LEFT JOIN rensider.cusip_mappings cm ON l.CUSIP = cm.cusip
      WHERE o.total_value >= ${minStartValue}
        AND l.total_value / o.total_value >= ${minChange}
        AND l.total_value / o.total_value <= ${maxChange}
        ${mappedAssetsFilter}
      ORDER BY change_multiple DESC
      LIMIT 500
    `

    const results = await query<{
      CUSIP: string
      NAMEOFISSUER: string
      mapped_ticker: string | null
      previous_value: number
      current_value: number
      change_multiple: number
      largest_holder_cik: string | null
      largest_holder_value: number | null
      latest_filer_cik: string | null
      latest_filing_date: string | null
    }>(sql)

    // Look up filer names for all holder and latest filer CIKs
    // Filter out invalid CIKs (some MotherDuck data has dates in CIK column due to import issues)
    const isValidCik = (cik: string | null): cik is string =>
      cik !== null && /^\d+$/.test(cik)

    const allCiks = new Set<string>()
    for (const r of results) {
      if (isValidCik(r.largest_holder_cik)) allCiks.add(r.largest_holder_cik)
      if (isValidCik(r.latest_filer_cik)) allCiks.add(r.latest_filer_cik)
    }
    // Use fetchMissing: false to avoid SEC API rate limits on alerts page
    // Filer names will show as CIK placeholders if not cached
    const filerNamesMap = allCiks.size > 0
      ? await getFilerNames(Array.from(allCiks), { fetchMissing: false })
      : new Map<string, string>()

    for (const r of results) {
      const validHolderCik = isValidCik(r.largest_holder_cik) ? r.largest_holder_cik : undefined
      const holderName = validHolderCik ? filerNamesMap.get(validHolderCik) : undefined
      const validLatestFilerCik = isValidCik(r.latest_filer_cik) ? r.latest_filer_cik : undefined
      const latestFilerName = validLatestFilerCik ? filerNamesMap.get(validLatestFilerCik) : undefined

      alerts.push({
        id: alertIdCounter++,
        ticker: r.mapped_ticker || r.CUSIP.substring(0, 6), // Use mapped ticker or fall back to CUSIP
        companyName: r.NAMEOFISSUER,
        alertType: 'ACCUMULATION',
        previousValue: r.previous_value,
        currentValue: r.current_value,
        changeMultiple: r.change_multiple,
        periodMonths: lookbackMonths,
        detectedAt: Date.now(),
        filingDate: parseSECDate(r.latest_filing_date),
        acknowledged: false,
        largestHolder: holderName,
        largestHolderCik: validHolderCik,
        largestHolderValue: r.largest_holder_value || undefined,
        latestFiler: latestFilerName,
        latestFilerCik: validLatestFilerCik,
      })
    }

    console.debug(`Detected ${alerts.length} alerts comparing ${oldestQuarter} to ${latestQuarter}`)

  } catch (error) {
    console.error('Error detecting alerts:', error)
  }

  return alerts
}

/**
 * Get ownership alerts matching criteria
 */
export async function getAlerts(options: {
  limit?: number
  includeAcknowledged?: boolean
  minChange?: number
  maxChange?: number
  minStartValue?: number
  lookbackMonths?: number
  onlyMappedAssets?: boolean
  /** @deprecated Use minChange instead */
  threshold?: number
}): Promise<Alert[]> {
  const {
    limit = 50,
    includeAcknowledged = false,
    minChange = options.threshold ?? DEFAULT_MIN_CHANGE,
    maxChange = DEFAULT_MAX_CHANGE,
    minStartValue = DEFAULT_MIN_START_VALUE,
    lookbackMonths = DEFAULT_LOOKBACK_MONTHS,
    onlyMappedAssets = true,
  } = options

  const now = Date.now()
  const cacheKey: AlertCacheKey = { minChange, maxChange, minStartValue, lookbackMonths, onlyMappedAssets }

  // Check cache validity
  const cacheValid = alertCache
    && alertCache.key.minChange === minChange
    && alertCache.key.maxChange === maxChange
    && alertCache.key.minStartValue === minStartValue
    && alertCache.key.lookbackMonths === lookbackMonths
    && alertCache.key.onlyMappedAssets === onlyMappedAssets
    && (now - alertCache.loadedAt) < CACHE_TTL_MS

  if (!cacheValid) {
    const alerts = await detectAlerts(minChange, maxChange, minStartValue, lookbackMonths, onlyMappedAssets)
    alertCache = {
      alerts,
      key: cacheKey,
      loadedAt: now,
    }
  }

  const filtered = (alertCache?.alerts || [])
    .filter(a => {
      if (!includeAcknowledged && a.acknowledged) return false
      return true
    })
    .sort((a, b) => b.changeMultiple - a.changeMultiple)

  return filtered.slice(0, limit)
}

/**
 * Get alert statistics
 */
export async function getAlertStats(options: {
  minChange?: number
  maxChange?: number
  minStartValue?: number
  lookbackMonths?: number
  onlyMappedAssets?: boolean
  /** @deprecated Use minChange instead */
  threshold?: number
}): Promise<AlertStats> {
  const {
    minChange = options.threshold ?? DEFAULT_MIN_CHANGE,
    maxChange = DEFAULT_MAX_CHANGE,
    minStartValue = DEFAULT_MIN_START_VALUE,
    lookbackMonths = DEFAULT_LOOKBACK_MONTHS,
    onlyMappedAssets = true,
  } = options

  const alerts = await getAlerts({
    includeAcknowledged: false,
    minChange,
    maxChange,
    minStartValue,
    lookbackMonths,
    onlyMappedAssets,
    limit: 1000,
  })

  return {
    total: alerts.length,
    topAlerts: alerts.slice(0, 5),
  }
}

/**
 * Acknowledge an alert
 */
export function acknowledgeAlert(id: number): boolean {
  if (!alertCache) return false

  const alert = alertCache.alerts.find(a => a.id === id)
  if (alert) {
    alert.acknowledged = true
    return true
  }
  return false
}
