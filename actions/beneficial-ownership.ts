'use server'

import type {
  ActivistActivity,
  TickerBeneficialOwnership,
  MajorHolder,
} from '@/types/beneficial-ownership'
import { getRecentFilings13DG, getFilingsForIssuer } from '@/lib/data/beneficial-ownership'

/**
 * Get beneficial ownership data for a ticker
 * Note: Not using unstable_cache to avoid cache size limit issues
 */
export async function getBeneficialOwnership({
  ticker,
}: {
  ticker: string
}): Promise<TickerBeneficialOwnership | null> {
  const upperTicker = ticker.toUpperCase()
  const filings = await getFilingsForIssuer({ ticker: upperTicker, limit: 50 })

  if (filings.length === 0) {
    return null
  }

  // Group by filer to get unique major holders
  const holderMap = new Map<string, MajorHolder>()
  let issuerName: string | null = null

  for (const filing of filings) {
    if (!issuerName) issuerName = filing.issuerName

    const existing = holderMap.get(filing.ownerName)
    if (!existing || filing.filingDate > existing.latestFilingDate) {
      holderMap.set(filing.ownerName, {
        ownerId: 0,
        ownerName: filing.ownerName,
        entityType: 'other',
        shares: filing.shares,
        percentOfClass: filing.percentOfClass,
        latestFilingType: filing.intentCategory === 'activist' ? '13D' : '13G',
        latestFilingDate: filing.filingDate,
        latestAccession: filing.accessionNumber,
        intentCategory: filing.intentCategory,
        purposeSummary: filing.purposeSummary,
        positionHistory: [{
          date: filing.filingDate,
          percent: filing.percentOfClass,
          filingType: filing.intentCategory === 'activist' ? '13D' : '13G',
        }],
      })
    }
  }

  const majorHolders = Array.from(holderMap.values())
    .sort((a, b) => b.percentOfClass - a.percentOfClass)

  const activistCount = majorHolders.filter(h =>
    h.latestFilingType === '13D' && h.intentCategory !== 'passive'
  ).length

  return {
    ticker: upperTicker,
    issuerName,
    majorHolders,
    recentEvents: [],
    stats: {
      totalMajorHolders: majorHolders.length,
      activistCount,
      totalBeneficialOwnership: majorHolders.reduce((sum, h) => sum + h.percentOfClass, 0),
      latestFilingDate: majorHolders.length > 0
        ? Math.max(...majorHolders.map(h => h.latestFilingDate))
        : null,
    },
  }
}

/**
 * Get recent activist activity
 * Note: Not using unstable_cache to avoid cache size limit issues
 */
export async function getActivistActivity({
  days = 90,
  limit = 100,
}: {
  days?: number
  limit?: number
}): Promise<ActivistActivity[]> {
  return getRecentFilings13DG({ days, limit })
}
