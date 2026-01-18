'use server'

import type { Alert, AlertStats } from '@/types/ownership'
import {
  DEFAULT_MIN_CHANGE,
  DEFAULT_MAX_CHANGE,
  DEFAULT_MIN_START_VALUE,
  DEFAULT_LOOKBACK_MONTHS,
} from '@/lib/alert-constants'
import { getAlerts, getAlertStats as getStats } from '@/lib/data/alerts'

/**
 * Get ownership alerts matching criteria
 * Note: Not using unstable_cache to avoid cache size limit issues
 */
export async function getOwnershipAlerts({
  limit = 50,
  includeAcknowledged = false,
  minChange = DEFAULT_MIN_CHANGE,
  maxChange = DEFAULT_MAX_CHANGE,
  minStartValue = DEFAULT_MIN_START_VALUE,
  lookbackMonths = DEFAULT_LOOKBACK_MONTHS,
  onlyMappedAssets = true,
}: {
  limit?: number
  includeAcknowledged?: boolean
  minChange?: number
  maxChange?: number
  minStartValue?: number
  lookbackMonths?: number
  onlyMappedAssets?: boolean
}): Promise<Alert[]> {
  return getAlerts({ limit, includeAcknowledged, minChange, maxChange, minStartValue, lookbackMonths, onlyMappedAssets })
}

/**
 * Get alert statistics
 */
export async function getAlertStats({
  minChange = DEFAULT_MIN_CHANGE,
  maxChange = DEFAULT_MAX_CHANGE,
  minStartValue = DEFAULT_MIN_START_VALUE,
  lookbackMonths = DEFAULT_LOOKBACK_MONTHS,
  onlyMappedAssets = true,
}: {
  minChange?: number
  maxChange?: number
  minStartValue?: number
  lookbackMonths?: number
  onlyMappedAssets?: boolean
}): Promise<AlertStats> {
  return getStats({ minChange, maxChange, minStartValue, lookbackMonths, onlyMappedAssets })
}

/**
 * Get alerts and stats in a single request
 */
export async function getAlertsWithStats({
  limit = 100,
  minChange = DEFAULT_MIN_CHANGE,
  maxChange = DEFAULT_MAX_CHANGE,
  minStartValue = DEFAULT_MIN_START_VALUE,
  lookbackMonths = DEFAULT_LOOKBACK_MONTHS,
  onlyMappedAssets = true,
}: {
  limit?: number
  minChange?: number
  maxChange?: number
  minStartValue?: number
  lookbackMonths?: number
  onlyMappedAssets?: boolean
}): Promise<{ alerts: Alert[]; stats: AlertStats }> {
  const [alerts, stats] = await Promise.all([
    getAlerts({ limit, includeAcknowledged: false, minChange, maxChange, minStartValue, lookbackMonths, onlyMappedAssets }),
    getStats({ minChange, maxChange, minStartValue, lookbackMonths, onlyMappedAssets }),
  ])
  return { alerts, stats }
}
