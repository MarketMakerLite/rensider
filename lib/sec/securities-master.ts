/**
 * Securities Master Table
 *
 * Provides a unified view of securities across different identifier types.
 * Combines data from CUSIP mappings, 13F holdings, and external sources.
 *
 * This module manages the securities master data for efficient lookups
 * by CUSIP, ticker, ISIN, or FIGI.
 */

import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { getAllCachedMappings } from './openfigi';
import { cusipToIsin, isinToCusip } from '@/lib/validators/isin';

const DATA_DIR = process.env.SEC_DATA_DIR || 'data';
const MASTER_FILE = join(DATA_DIR, 'reference', 'securities-master.json');

// ============================================================================
// Types
// ============================================================================

export interface SecurityRecord {
  // Primary identifiers
  cusip: string;
  isin?: string;
  figi?: string;
  ticker?: string;

  // Company information
  companyName?: string;
  issuerName?: string; // From 13F filings

  // Classification
  exchange?: string;
  securityType?: 'EQUITY' | 'DEBT' | 'OPTION' | 'ETF' | 'ADR' | 'OTHER';
  marketSector?: string;

  // Metadata
  source: 'openfigi' | '13f' | 'manual' | 'merged';
  lastUpdated: string;
  checkDigitValid?: boolean;
}

interface SecuritiesMasterStore {
  securities: Record<string, SecurityRecord>; // Keyed by CUSIP
  indices: {
    byTicker: Record<string, string[]>;    // Ticker → CUSIPs
    byFigi: Record<string, string>;        // FIGI → CUSIP
    byIsin: Record<string, string>;        // ISIN → CUSIP
    byName: Record<string, string[]>;      // Lowercase name → CUSIPs
  };
  lastUpdated: string;
  stats: {
    totalSecurities: number;
    withTicker: number;
    withFigi: number;
    withIsin: number;
  };
}

// In-memory store
let masterStore: SecuritiesMasterStore | null = null;

// ============================================================================
// Storage Functions
// ============================================================================

async function loadMasterStore(): Promise<SecuritiesMasterStore> {
  if (masterStore !== null) {
    return masterStore;
  }

  try {
    const data = await readFile(MASTER_FILE, 'utf-8');
    masterStore = JSON.parse(data);
    return masterStore!;
  } catch {
    // Initialize empty store
    masterStore = {
      securities: {},
      indices: {
        byTicker: {},
        byFigi: {},
        byIsin: {},
        byName: {},
      },
      lastUpdated: new Date().toISOString(),
      stats: {
        totalSecurities: 0,
        withTicker: 0,
        withFigi: 0,
        withIsin: 0,
      },
    };
    return masterStore;
  }
}

async function saveMasterStore(): Promise<void> {
  if (!masterStore) return;

  try {
    await mkdir(dirname(MASTER_FILE), { recursive: true });
    masterStore.lastUpdated = new Date().toISOString();
    await writeFile(MASTER_FILE, JSON.stringify(masterStore, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save securities master:', error);
  }
}

function updateIndices(security: SecurityRecord): void {
  if (!masterStore) return;

  const cusip = security.cusip;

  // Update ticker index
  if (security.ticker) {
    const tickerLower = security.ticker.toLowerCase();
    if (!masterStore.indices.byTicker[tickerLower]) {
      masterStore.indices.byTicker[tickerLower] = [];
    }
    if (!masterStore.indices.byTicker[tickerLower].includes(cusip)) {
      masterStore.indices.byTicker[tickerLower].push(cusip);
    }
  }

  // Update FIGI index
  if (security.figi) {
    masterStore.indices.byFigi[security.figi] = cusip;
  }

  // Update ISIN index
  if (security.isin) {
    masterStore.indices.byIsin[security.isin] = cusip;
  }

  // Update name index
  const name = security.companyName || security.issuerName;
  if (name) {
    const nameLower = name.toLowerCase();
    if (!masterStore.indices.byName[nameLower]) {
      masterStore.indices.byName[nameLower] = [];
    }
    if (!masterStore.indices.byName[nameLower].includes(cusip)) {
      masterStore.indices.byName[nameLower].push(cusip);
    }
  }
}

function recalculateStats(): void {
  if (!masterStore) return;

  const securities = Object.values(masterStore.securities);
  masterStore.stats = {
    totalSecurities: securities.length,
    withTicker: securities.filter(s => s.ticker).length,
    withFigi: securities.filter(s => s.figi).length,
    withIsin: securities.filter(s => s.isin).length,
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Add or update a security in the master table
 */
export async function upsertSecurity(security: Partial<SecurityRecord> & { cusip: string }): Promise<SecurityRecord> {
  const store = await loadMasterStore();

  const existing = store.securities[security.cusip];
  const now = new Date().toISOString();

  const record: SecurityRecord = {
    ...existing,
    ...security,
    source: security.source || existing?.source || 'manual',
    lastUpdated: now,
  };

  // Generate ISIN for US securities if not provided
  if (!record.isin && record.cusip.length === 9) {
    record.isin = cusipToIsin(record.cusip);
  }

  store.securities[security.cusip] = record;
  updateIndices(record);
  recalculateStats();

  // Save asynchronously
  saveMasterStore().catch(() => {});

  return record;
}

/**
 * Get a security by CUSIP
 */
export async function getSecurityByCusip(cusip: string): Promise<SecurityRecord | null> {
  const store = await loadMasterStore();
  return store.securities[cusip.toUpperCase()] || null;
}

/**
 * Get securities by ticker
 */
export async function getSecuritiesByTicker(ticker: string): Promise<SecurityRecord[]> {
  const store = await loadMasterStore();
  const cusips = store.indices.byTicker[ticker.toLowerCase()] || [];
  return cusips.map(c => store.securities[c]).filter(Boolean);
}

/**
 * Get security by FIGI
 */
export async function getSecurityByFigi(figi: string): Promise<SecurityRecord | null> {
  const store = await loadMasterStore();
  const cusip = store.indices.byFigi[figi];
  return cusip ? store.securities[cusip] : null;
}

/**
 * Get security by ISIN
 */
export async function getSecurityByIsin(isin: string): Promise<SecurityRecord | null> {
  const store = await loadMasterStore();

  // First try the index
  const cusip = store.indices.byIsin[isin.toUpperCase()];
  if (cusip) {
    return store.securities[cusip];
  }

  // Try extracting CUSIP from ISIN for US securities
  const extractedCusip = isinToCusip(isin);
  if (extractedCusip) {
    return store.securities[extractedCusip] || null;
  }

  return null;
}

/**
 * Search securities by name
 */
export async function searchSecuritiesByName(query: string, limit: number = 10): Promise<SecurityRecord[]> {
  const store = await loadMasterStore();
  const queryLower = query.toLowerCase().trim();

  if (queryLower.length < 2) {
    return [];
  }

  const matches: { security: SecurityRecord; score: number }[] = [];

  for (const [name, cusips] of Object.entries(store.indices.byName)) {
    // Check for match
    if (name.includes(queryLower) || queryLower.includes(name)) {
      const score = name === queryLower ? 1000 : name.startsWith(queryLower) ? 100 : 10;

      for (const cusip of cusips) {
        const security = store.securities[cusip];
        if (security) {
          matches.push({ security, score });
        }
      }
    }
  }

  // Sort by score and return top results
  return matches
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(m => m.security);
}

// ============================================================================
// Sync Functions
// ============================================================================

/**
 * Sync securities master from CUSIP cache
 * Call this after enriching securities with OpenFIGI data
 */
export async function syncFromCusipCache(): Promise<number> {
  const store = await loadMasterStore();
  const cachedMappings = await getAllCachedMappings();

  let updated = 0;

  for (const mapping of cachedMappings) {
    if (mapping.error) continue; // Skip errored mappings

    const existing = store.securities[mapping.cusip];

    // Only update if we have new data
    if (!existing || mapping.ticker || mapping.figi) {
      const record: SecurityRecord = {
        cusip: mapping.cusip,
        ticker: mapping.ticker || existing?.ticker,
        figi: mapping.figi || existing?.figi,
        companyName: mapping.name || existing?.companyName,
        exchange: mapping.exchCode || existing?.exchange,
        securityType: mapSecurityType(mapping.securityType),
        marketSector: mapping.marketSector || existing?.marketSector,
        source: 'openfigi',
        lastUpdated: new Date().toISOString(),
      };

      // Generate ISIN for US securities
      if (record.cusip.length === 9) {
        record.isin = cusipToIsin(record.cusip);
      }

      store.securities[record.cusip] = record;
      updateIndices(record);
      updated++;
    }
  }

  if (updated > 0) {
    recalculateStats();
    await saveMasterStore();
    console.log(`Synced ${updated} securities from CUSIP cache`);
  }

  return updated;
}

/**
 * Map OpenFIGI security type to our enum
 */
function mapSecurityType(type?: string): SecurityRecord['securityType'] {
  if (!type) return undefined;

  const typeLower = type.toLowerCase();

  if (typeLower.includes('common') || typeLower.includes('equity')) {
    return 'EQUITY';
  }
  if (typeLower.includes('bond') || typeLower.includes('note') || typeLower.includes('debt')) {
    return 'DEBT';
  }
  if (typeLower.includes('option') || typeLower.includes('warrant')) {
    return 'OPTION';
  }
  if (typeLower.includes('etf') || typeLower.includes('fund')) {
    return 'ETF';
  }
  if (typeLower.includes('adr') || typeLower.includes('depositary')) {
    return 'ADR';
  }

  return 'OTHER';
}

/**
 * Add issuer names from 13F holdings data
 */
export async function addIssuerName(cusip: string, issuerName: string): Promise<void> {
  const store = await loadMasterStore();

  const existing = store.securities[cusip];

  if (existing) {
    // Don't overwrite company name from OpenFIGI with 13F issuer name
    if (!existing.issuerName) {
      existing.issuerName = issuerName;
      existing.lastUpdated = new Date().toISOString();
      updateIndices(existing);
    }
  } else {
    // Create new record with issuer name
    const record: SecurityRecord = {
      cusip,
      issuerName,
      source: '13f',
      lastUpdated: new Date().toISOString(),
    };

    if (cusip.length === 9) {
      record.isin = cusipToIsin(cusip);
    }

    store.securities[cusip] = record;
    updateIndices(record);
  }
}

// ============================================================================
// Statistics
// ============================================================================

/**
 * Get securities master statistics
 */
export async function getSecuritiesMasterStats(): Promise<SecuritiesMasterStore['stats'] & {
  lastUpdated: string;
  indexSizes: {
    ticker: number;
    figi: number;
    isin: number;
    name: number;
  };
}> {
  const store = await loadMasterStore();

  return {
    ...store.stats,
    lastUpdated: store.lastUpdated,
    indexSizes: {
      ticker: Object.keys(store.indices.byTicker).length,
      figi: Object.keys(store.indices.byFigi).length,
      isin: Object.keys(store.indices.byIsin).length,
      name: Object.keys(store.indices.byName).length,
    },
  };
}

/**
 * Lookup security by any identifier type
 * Tries CUSIP, ticker, FIGI, ISIN in order
 */
export async function lookupSecurity(identifier: string): Promise<SecurityRecord | null> {
  const upper = identifier.toUpperCase().trim();

  // Try CUSIP (9 chars, alphanumeric)
  if (/^[A-Z0-9]{6,9}$/.test(upper)) {
    const result = await getSecurityByCusip(upper);
    if (result) return result;
  }

  // Try ISIN (12 chars, starts with 2 letters)
  if (/^[A-Z]{2}[A-Z0-9]{10}$/.test(upper)) {
    const result = await getSecurityByIsin(upper);
    if (result) return result;
  }

  // Try FIGI (12 chars, starts with BBG)
  if (/^BBG[A-Z0-9]{9}$/.test(upper)) {
    const result = await getSecurityByFigi(upper);
    if (result) return result;
  }

  // Try ticker (1-5 chars)
  if (/^[A-Z]{1,5}(\.[A-Z]{1,2})?$/.test(upper)) {
    const results = await getSecuritiesByTicker(upper);
    if (results.length > 0) return results[0];
  }

  return null;
}
