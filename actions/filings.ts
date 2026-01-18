'use server'

import type { Filing } from '@/types/ownership'
import { getRecentFilings } from '@/lib/data/filings'

/**
 * Get recent 13F filings
 * Note: Not using unstable_cache to avoid cache size limit issues
 * DuckDB queries are fast enough that caching isn't necessary
 */
export async function getNewFilings({
  days = 365,
  limit = 100,
}: {
  days?: number
  limit?: number
}): Promise<Filing[]> {
  return getRecentFilings({ days, limit })
}
