#!/usr/bin/env npx tsx

/**
 * Enrich Securities Script (MotherDuck)
 *
 * Populates CUSIP to ticker mappings using the OpenFIGI API
 * and stores them in the MotherDuck cusip_mappings table.
 *
 * Usage:
 *   npx tsx scripts/enrich-securities-motherduck.ts [options]
 *
 * Options:
 *   --limit=N       Limit number of CUSIPs to process
 *   --stats         Show mapping statistics only
 *   --init          Initialize the cusip_mappings table
 */

import { query, execute, upsertRows, isCloudMode } from '../lib/sec/duckdb';
import { normalizeCUSIP } from '../lib/sec/openfigi';
import pLimit from 'p-limit';

const OPENFIGI_API_URL = 'https://api.openfigi.com/v3/mapping';
const OPENFIGI_API_KEY = process.env.OPENFIGI_API_KEY;

// Rate limiter configuration
const requestsPerMinute = OPENFIGI_API_KEY ? 250 : 25;
const BATCH_SIZE = 10; // Keep small to avoid 413 errors

// Sliding window rate limiter
class SlidingWindowRateLimiter {
  private timestamps: number[] = [];
  private readonly maxRequests: number;
  private readonly windowMs: number;

  constructor(maxRequests: number, windowMs: number = 60000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
  }

  async acquire(): Promise<void> {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestTimestamp) + 50;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.acquire();
    }

    this.timestamps.push(now);
  }
}

const rateLimiter = new SlidingWindowRateLimiter(requestsPerMinute);
const concurrencyLimit = pLimit(2);

interface OpenFIGIResult {
  figi: string;
  name: string;
  ticker: string;
  exchCode: string;
  securityType: string;
  marketSector: string;
}

type OpenFIGIResponse = Array<{
  data?: OpenFIGIResult[];
  error?: string;
}>;

interface CUSIPMapping {
  cusip: string;
  ticker: string | null;
  figi: string | null;
  name: string | null;
  exch_code: string | null;
  security_type: string | null;
  market_sector: string | null;
  error: string | null;
  cached_at: string;
}

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

function selectBestMatch(results: OpenFIGIResult[]): OpenFIGIResult | null {
  if (!results || results.length === 0) return null;

  // Prefer US exchange listings
  const usListing = results.find(r => r.exchCode === 'US');
  if (usListing) return usListing;

  // Prefer equity over other types
  const equity = results.find(r => r.marketSector === 'Equity');
  if (equity) return equity;

  // Prefer Common Stock
  const common = results.find(r => r.securityType === 'Common Stock');
  if (common) return common;

  return results[0];
}

async function fetchMappingsFromAPI(cusips: string[]): Promise<CUSIPMapping[]> {
  const results: CUSIPMapping[] = [];
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;

  for (const batch of chunk(cusips, BATCH_SIZE)) {
    let retries = 0;
    let success = false;

    while (!success && retries < MAX_RETRIES) {
      try {
        await rateLimiter.acquire();
        await concurrencyLimit(async () => {
          const requestBody = batch.map(cusip => ({
            idType: 'ID_CUSIP' as const,
            idValue: normalizeCUSIP(cusip),
          }));

          const response = await fetch(OPENFIGI_API_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(OPENFIGI_API_KEY && { 'X-OPENFIGI-APIKEY': OPENFIGI_API_KEY }),
            },
            body: JSON.stringify(requestBody),
          });

          if (!response.ok) {
            if (response.status === 429 || response.status === 413 || response.status >= 500) {
              throw new Error(`API error: ${response.status}`);
            }
            throw new Error(`OpenFIGI API error: ${response.status}`);
          }

          const data = await response.json() as OpenFIGIResponse;
          const now = new Date().toISOString();

          batch.forEach((cusip, index) => {
            const result = data[index];
            const normalizedCusip = normalizeCUSIP(cusip);

            if (result?.error) {
              results.push({
                cusip: normalizedCusip,
                ticker: null,
                figi: null,
                name: null,
                exch_code: null,
                security_type: null,
                market_sector: null,
                error: result.error,
                cached_at: now,
              });
            } else if (result?.data && result.data.length > 0) {
              const match = selectBestMatch(result.data);
              if (match) {
                results.push({
                  cusip: normalizedCusip,
                  ticker: match.ticker,
                  figi: match.figi,
                  name: match.name,
                  exch_code: match.exchCode,
                  security_type: match.securityType,
                  market_sector: match.marketSector,
                  error: null,
                  cached_at: now,
                });
              } else {
                results.push({
                  cusip: normalizedCusip,
                  ticker: null,
                  figi: null,
                  name: null,
                  exch_code: null,
                  security_type: null,
                  market_sector: null,
                  error: 'No matching result',
                  cached_at: now,
                });
              }
            } else {
              results.push({
                cusip: normalizedCusip,
                ticker: null,
                figi: null,
                name: null,
                exch_code: null,
                security_type: null,
                market_sector: null,
                error: 'No mapping found',
                cached_at: now,
              });
            }
          });

          success = true;
        });
      } catch (error) {
        retries++;
        if (retries >= MAX_RETRIES) {
          console.error(`OpenFIGI API failed after ${MAX_RETRIES} retries:`, error instanceof Error ? error.message : error);
          const now = new Date().toISOString();
          for (const cusip of batch) {
            results.push({
              cusip: normalizeCUSIP(cusip),
              ticker: null,
              figi: null,
              name: null,
              exch_code: null,
              security_type: null,
              market_sector: null,
              error: error instanceof Error ? error.message : 'API error',
              cached_at: now,
            });
          }
          success = true;
        } else {
          const delay = BASE_DELAY_MS * Math.pow(2, retries - 1) + Math.random() * 200;
          console.warn(`OpenFIGI request failed, retry ${retries}/${MAX_RETRIES} in ${Math.round(delay)}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
  }

  return results;
}

interface Options {
  limit?: number;
  statsOnly: boolean;
  init: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);
  const options: Options = {
    statsOnly: false,
    init: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg === '--stats') {
      options.statsOnly = true;
    } else if (arg === '--init') {
      options.init = true;
    }
  }

  return options;
}

async function getUniqueCUSIPsFromHoldings(): Promise<string[]> {
  const dbName = process.env.MOTHERDUCK_DATABASE || 'rensider';
  const results = await query<{ cusip: string }>(`
    SELECT DISTINCT CUSIP as cusip
    FROM ${dbName}.holdings_13f
    WHERE CUSIP IS NOT NULL
      AND LENGTH(CUSIP) = 9
  `);

  return results.map(r => r.cusip);
}

async function getCachedCUSIPs(): Promise<Set<string>> {
  const dbName = process.env.MOTHERDUCK_DATABASE || 'rensider';
  try {
    const results = await query<{ cusip: string }>(`
      SELECT cusip FROM ${dbName}.cusip_mappings
    `);
    return new Set(results.map(r => r.cusip));
  } catch {
    // Table might not exist yet
    return new Set();
  }
}

async function saveMappings(mappings: CUSIPMapping[]): Promise<void> {
  if (mappings.length === 0) return;

  const dbName = process.env.MOTHERDUCK_DATABASE || 'rensider';
  // Use upsertRows to insert/update mappings
  await upsertRows(`${dbName}.cusip_mappings`, mappings, 'cusip');
}

async function getStats(): Promise<{ total: number; successful: number; failed: number }> {
  const dbName = process.env.MOTHERDUCK_DATABASE || 'rensider';
  try {
    const result = await query<{
      total: number;
      successful: number;
      failed: number;
    }>(`
      SELECT
        COUNT(*) as total,
        COUNT(CASE WHEN ticker IS NOT NULL THEN 1 END) as successful,
        COUNT(CASE WHEN ticker IS NULL THEN 1 END) as failed
      FROM ${dbName}.cusip_mappings
    `);

    return result[0] || { total: 0, successful: 0, failed: 0 };
  } catch {
    return { total: 0, successful: 0, failed: 0 };
  }
}

async function main() {
  const options = parseArgs();

  console.log('Securities Enrichment Script (MotherDuck)');
  console.log('='.repeat(60));

  if (!isCloudMode()) {
    console.error('Error: MOTHERDUCK_TOKEN not set. This script requires MotherDuck.');
    process.exit(1);
  }

  if (!OPENFIGI_API_KEY) {
    console.warn('Warning: OPENFIGI_API_KEY not set. Rate limits will be lower (25 req/min).');
  } else {
    console.log('Using OpenFIGI API key (250 req/min limit)');
  }

  // Initialize schema if requested
  if (options.init) {
    console.log('\nInitializing cusip_mappings table...');
    const dbName = process.env.MOTHERDUCK_DATABASE || 'rensider';
    await execute(`
      CREATE TABLE IF NOT EXISTS ${dbName}.cusip_mappings (
        cusip VARCHAR PRIMARY KEY,
        ticker VARCHAR,
        figi VARCHAR,
        name VARCHAR,
        exch_code VARCHAR,
        security_type VARCHAR,
        market_sector VARCHAR,
        error VARCHAR,
        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await execute(`CREATE INDEX IF NOT EXISTS idx_cusip_mappings_ticker ON ${dbName}.cusip_mappings(ticker)`);
    console.log('Table created.');
  }

  // Show stats if requested
  if (options.statsOnly) {
    const stats = await getStats();
    console.log('\nMapping Statistics:');
    console.log(`  Total mappings: ${stats.total}`);
    console.log(`  Successful: ${stats.successful}`);
    console.log(`  Failed: ${stats.failed}`);

    if (stats.successful > 0) {
      const dbName = process.env.MOTHERDUCK_DATABASE || 'rensider';
      const samples = await query<{ cusip: string; ticker: string; name: string }>(`
        SELECT cusip, ticker, name
        FROM ${dbName}.cusip_mappings
        WHERE ticker IS NOT NULL
        LIMIT 10
      `);

      console.log('\nSample mappings:');
      for (const m of samples) {
        console.log(`  ${m.cusip} -> ${m.ticker} (${m.name})`);
      }
    }

    return;
  }

  // Get unique CUSIPs from holdings
  console.log('\nCollecting CUSIPs from holdings...');
  const allCusips = await getUniqueCUSIPsFromHoldings();
  console.log(`Found ${allCusips.length} unique CUSIPs`);

  if (allCusips.length === 0) {
    console.log('No CUSIPs found. Make sure data is loaded in MotherDuck.');
    return;
  }

  // Check what's already cached
  const cachedCusips = await getCachedCUSIPs();
  console.log(`Already cached: ${cachedCusips.size}`);

  let cusipsToProcess = allCusips.filter(c => !cachedCusips.has(normalizeCUSIP(c)));

  if (options.limit) {
    cusipsToProcess = cusipsToProcess.slice(0, options.limit);
  }

  console.log(`CUSIPs to process: ${cusipsToProcess.length}`);

  if (cusipsToProcess.length === 0) {
    console.log('All CUSIPs already cached.');
    return;
  }

  // Process in batches
  const batchSize = 500;
  let processed = 0;
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < cusipsToProcess.length; i += batchSize) {
    const batch = cusipsToProcess.slice(i, i + batchSize);
    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cusipsToProcess.length / batchSize)}...`);

    const mappings = await fetchMappingsFromAPI(batch);

    // Save to MotherDuck
    await saveMappings(mappings);

    for (const m of mappings) {
      processed++;
      if (m.ticker) {
        successful++;
      } else {
        failed++;
      }
    }

    console.log(`  Batch complete: ${successful} successful, ${failed} failed (${processed} total)`);
  }

  // Final stats
  console.log('\n' + '='.repeat(60));
  console.log('Enrichment Complete');
  console.log('='.repeat(60));
  console.log(`Processed: ${processed}`);
  console.log(`Successful mappings: ${successful}`);
  console.log(`Failed mappings: ${failed}`);

  const finalStats = await getStats();
  console.log(`\nTotal cached mappings: ${finalStats.total}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
