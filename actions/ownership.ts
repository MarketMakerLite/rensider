'use server'

import type {
  StockOwnershipData,
  FundHoldingsData,
  OwnershipHistoryEntry,
} from '@/types/ownership'
import {
  getStockOwnershipData,
  getFundHoldingsData,
  getOwnershipHistoryData,
} from '@/lib/data/holdings'
import { getFilerName } from '@/lib/sec/filer-names'

/**
 * Get stock ownership data by ticker symbol
 * Note: Not using unstable_cache to avoid cache size limit issues
 */
export async function getStockOwnership({
  ticker,
}: {
  ticker: string
}): Promise<StockOwnershipData | null> {
  const normalizedTicker = ticker.toUpperCase()
  return getStockOwnershipData(normalizedTicker)
}

/**
 * Get fund holdings data by CIK
 * Note: Not using unstable_cache to avoid cache size limit issues
 */
export async function getFundHoldings({
  cik,
  maxHoldings = 500,
}: {
  cik: string
  maxHoldings?: number
}): Promise<FundHoldingsData | null> {
  const normalizedCik = cik.replace(/^0+/, '') || cik
  return getFundHoldingsData(normalizedCik, maxHoldings)
}

/**
 * Get ownership history for a stock
 */
export async function getOwnershipHistory({
  ticker,
  quarters = 8,
}: {
  ticker: string
  quarters?: number
}): Promise<OwnershipHistoryEntry[]> {
  const normalizedTicker = ticker.toUpperCase()
  return getOwnershipHistoryData(normalizedTicker, quarters)
}

/**
 * Get filer name by CIK (lightweight, for metadata generation)
 */
export async function getFilerNameByCik({
  cik,
}: {
  cik: string
}): Promise<string | null> {
  const normalizedCik = cik.replace(/^0+/, '')
  return getFilerName(normalizedCik)
}
