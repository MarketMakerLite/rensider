/**
 * OpenFIGI API Client
 *
 * Provides CUSIP to ticker symbol mapping using the OpenFIGI API.
 * Free tier: 25 requests/minute (no key), 250 requests/minute (with key)
 * Batch size: Up to 100 identifiers per request (using 25 to avoid 413 errors)
 *
 * API Documentation: https://www.openfigi.com/api
 */

import pLimit from 'p-limit';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';

const OPENFIGI_API_URL = 'https://api.openfigi.com/v3/mapping';
const OPENFIGI_API_KEY = process.env.OPENFIGI_API_KEY;

// Rate limiter configuration
// Free tier: 25 req/min, with key: 250 req/min
const requestsPerMinute = OPENFIGI_API_KEY ? 250 : 25;
const concurrencyLimit = pLimit(2); // Max concurrent requests

// Simple sliding window rate limiter
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
    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs);

    if (this.timestamps.length >= this.maxRequests) {
      // Calculate wait time until oldest request expires
      const oldestTimestamp = this.timestamps[0];
      const waitTime = this.windowMs - (now - oldestTimestamp) + 50; // Add 50ms buffer
      await new Promise(resolve => setTimeout(resolve, waitTime));
      return this.acquire(); // Retry after waiting
    }

    this.timestamps.push(now);
  }
}

const rateLimiter = new SlidingWindowRateLimiter(requestsPerMinute);

// Batch size reduced from 100 to 10 to avoid HTTP 413 errors
const BATCH_SIZE = 10;

// Error TTL configuration (in milliseconds)
const ERROR_TTL_TRANSIENT = 1 * 60 * 60 * 1000; // 1 hour for 4xx/5xx errors
const ERROR_TTL_PERMANENT = 30 * 24 * 60 * 60 * 1000; // 30 days for "No mapping found"

const DATA_DIR = process.env.SEC_DATA_DIR || 'data';
const CACHE_FILE = join(DATA_DIR, 'reference', 'cusip-mappings.json');

// In-memory cache for hot lookups
const memoryCache = new Map<string, CUSIPMapping | null>();

export interface CUSIPMapping {
  cusip: string;
  figi?: string;
  ticker?: string;
  name?: string;
  exchCode?: string;
  securityType?: string;
  marketSector?: string;
  error?: string;
  errorType?: 'transient' | 'permanent'; // Track error type for TTL
  cachedAt?: string;
  expiresAt?: string; // TTL for errors
}

interface OpenFIGIRequest {
  idType: 'ID_CUSIP' | 'ID_ISIN' | 'TICKER' | 'ID_BB_GLOBAL';
  idValue: string;
  exchCode?: string;
  currency?: string;
  marketSecDes?: string;
}

interface OpenFIGIResult {
  figi: string;
  name: string;
  ticker: string;
  exchCode: string;
  compositeFIGI: string;
  securityType: string;
  marketSector: string;
  shareClassFIGI?: string;
  securityType2?: string;
  securityDescription?: string;
}

type OpenFIGIResponse = Array<{
  data?: OpenFIGIResult[];
  error?: string;
}>;

// Persistent cache
interface CacheStore {
  mappings: Record<string, CUSIPMapping>;
  lastUpdated: string;
}

async function loadPersistentCache(): Promise<Record<string, CUSIPMapping>> {
  try {
    const data = await readFile(CACHE_FILE, 'utf-8');
    const cache = JSON.parse(data) as CacheStore;
    return cache.mappings;
  } catch {
    return {};
  }
}

async function savePersistentCache(mappings: Record<string, CUSIPMapping>): Promise<void> {
  try {
    await mkdir(dirname(CACHE_FILE), { recursive: true });
    const cache: CacheStore = {
      mappings,
      lastUpdated: new Date().toISOString(),
    };
    await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch (error) {
    console.error('Failed to save CUSIP cache:', error);
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}

/**
 * Select best match from multiple OpenFIGI results
 */
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

/**
 * Normalize CUSIP to standard format
 */
export function normalizeCUSIP(cusip: string): string {
  const cleaned = cusip.replace(/\s/g, '').toUpperCase();
  return cleaned.slice(0, 9);
}

/**
 * Check if a cached error has expired and should be retried
 */
function isErrorExpired(mapping: CUSIPMapping): boolean {
  if (!mapping.error || !mapping.cachedAt) return false;

  // Check explicit expiration
  if (mapping.expiresAt) {
    return new Date() > new Date(mapping.expiresAt);
  }

  // Legacy entries without expiresAt - use default TTL based on error type
  const cachedAt = new Date(mapping.cachedAt).getTime();
  const now = Date.now();

  // Permanent errors (No mapping found) - keep for 30 days
  if (mapping.error === 'No mapping found' || mapping.error === 'No matching result') {
    return now - cachedAt > ERROR_TTL_PERMANENT;
  }

  // Transient errors (API errors, rate limits) - retry after 1 hour
  return now - cachedAt > ERROR_TTL_TRANSIENT;
}

/**
 * Create error mapping with appropriate TTL
 */
function createErrorMapping(cusip: string, error: string): CUSIPMapping {
  const now = new Date();
  const isPermanent = error === 'No mapping found' || error === 'No matching result';
  const ttl = isPermanent ? ERROR_TTL_PERMANENT : ERROR_TTL_TRANSIENT;

  return {
    cusip,
    error,
    errorType: isPermanent ? 'permanent' : 'transient',
    cachedAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + ttl).toISOString(),
  };
}

/**
 * Map a batch of CUSIPs to tickers using OpenFIGI API with retry logic
 */
async function fetchMappingsFromAPI(cusips: string[]): Promise<CUSIPMapping[]> {
  const results: CUSIPMapping[] = [];
  const MAX_RETRIES = 3;
  const BASE_DELAY_MS = 1000;
  const MAX_DELAY_MS = 60000;

  // Process in smaller batches to avoid HTTP 413 errors
  for (const batch of chunk(cusips, BATCH_SIZE)) {
    let retries = 0;
    let success = false;

    while (!success && retries < MAX_RETRIES) {
      try {
        // Use sliding window rate limiter with concurrency control
        await rateLimiter.acquire();
        await concurrencyLimit(async () => {
          const requestBody: OpenFIGIRequest[] = batch.map(cusip => ({
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
            if (response.status === 429) {
              // Rate limited - will be handled by retry logic
              throw new Error(`Rate limited (429)`);
            }
            if (response.status === 413) {
              // Payload too large - this shouldn't happen with smaller batch size
              console.error(`OpenFIGI 413 error with batch size ${batch.length}. Consider reducing BATCH_SIZE.`);
              throw new Error(`Payload too large (413)`);
            }
            if (response.status >= 500) {
              throw new Error(`Server error (${response.status})`);
            }
            throw new Error(`OpenFIGI API error: ${response.status}`);
          }

          const data = await response.json() as OpenFIGIResponse;

          // Map responses back to CUSIPs
          batch.forEach((cusip, index) => {
            const result = data[index];
            const normalizedCusip = normalizeCUSIP(cusip);

            if (result?.error) {
              results.push(createErrorMapping(normalizedCusip, result.error));
            } else if (result?.data && result.data.length > 0) {
              const match = selectBestMatch(result.data);
              if (match) {
                results.push({
                  cusip: normalizedCusip,
                  figi: match.figi,
                  ticker: match.ticker,
                  name: match.name,
                  exchCode: match.exchCode,
                  securityType: match.securityType,
                  marketSector: match.marketSector,
                  cachedAt: new Date().toISOString(),
                });
              } else {
                results.push(createErrorMapping(normalizedCusip, 'No matching result'));
              }
            } else {
              results.push(createErrorMapping(normalizedCusip, 'No mapping found'));
            }
          });

          success = true;
        });
      } catch (error) {
        retries++;
        if (retries >= MAX_RETRIES) {
          // After all retries, mark batch as failed with transient error
          console.error(`OpenFIGI API failed after ${MAX_RETRIES} retries:`, error instanceof Error ? error.message : error);
          for (const cusip of batch) {
            results.push(createErrorMapping(
              normalizeCUSIP(cusip),
              error instanceof Error ? error.message : 'API error'
            ));
          }
          success = true; // Exit loop, we've handled the failure
        } else {
          const delay = Math.min(BASE_DELAY_MS * Math.pow(2, retries - 1), MAX_DELAY_MS);
          // Add jitter to avoid thundering herd
          const jitter = Math.random() * 200;
          console.warn(`OpenFIGI request failed, retry ${retries}/${MAX_RETRIES} in ${delay + jitter}ms`);
          await new Promise(resolve => setTimeout(resolve, delay + jitter));
        }
      }
    }
  }

  return results;
}

/**
 * Map CUSIPs to tickers, using cache when available
 * Automatically retries expired transient errors
 */
export async function mapCUSIPs(cusips: string[]): Promise<CUSIPMapping[]> {
  const results: CUSIPMapping[] = [];
  const toFetch: string[] = [];

  // Check memory cache first
  for (const cusip of cusips) {
    const normalized = normalizeCUSIP(cusip);

    if (memoryCache.has(normalized)) {
      const cached = memoryCache.get(normalized);
      if (cached && !isErrorExpired(cached)) {
        results.push(cached);
      } else {
        // Either not cached or error expired - need to fetch
        toFetch.push(normalized);
      }
    } else {
      toFetch.push(normalized);
    }
  }

  if (toFetch.length === 0) {
    return results;
  }

  // Check persistent cache
  const persistentCache = await loadPersistentCache();
  const stillNeedFetch: string[] = [];

  for (const cusip of toFetch) {
    const cached = persistentCache[cusip];
    if (cached && !isErrorExpired(cached)) {
      memoryCache.set(cusip, cached);
      results.push(cached);
    } else {
      stillNeedFetch.push(cusip);
    }
  }

  if (stillNeedFetch.length === 0) {
    return results;
  }

  // Fetch from API
  console.log(`Fetching ${stillNeedFetch.length} CUSIP mappings from OpenFIGI...`);
  const apiResults = await fetchMappingsFromAPI(stillNeedFetch);

  // Update caches
  for (const mapping of apiResults) {
    memoryCache.set(mapping.cusip, mapping);
    persistentCache[mapping.cusip] = mapping;
    results.push(mapping);
  }

  // Save to persistent cache
  await savePersistentCache(persistentCache);

  return results;
}

/**
 * Reverse lookup: Map tickers to CUSIPs using OpenFIGI API
 */
export async function mapTickersToCUSIPs(tickers: string[]): Promise<CUSIPMapping[]> {
  const results: CUSIPMapping[] = [];

  // Process in batches
  for (const batch of chunk(tickers, BATCH_SIZE)) {
    try {
      await rateLimiter.acquire();
      await concurrencyLimit(async () => {
        const requestBody: OpenFIGIRequest[] = batch.map(ticker => ({
          idType: 'TICKER' as const,
          idValue: ticker.toUpperCase(),
          exchCode: 'US', // Prefer US exchanges
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
          throw new Error(`OpenFIGI API error: ${response.status}`);
        }

        const data = await response.json() as OpenFIGIResponse;

        batch.forEach((ticker, index) => {
          const result = data[index];
          const normalizedTicker = ticker.toUpperCase();

          if (result?.error) {
            results.push({
              cusip: '',
              ticker: normalizedTicker,
              error: result.error,
              cachedAt: new Date().toISOString(),
            });
          } else if (result?.data && result.data.length > 0) {
            const match = selectBestMatch(result.data);
            if (match) {
              // Extract CUSIP from the result - OpenFIGI may include it
              // or we need to derive from FIGI
              results.push({
                cusip: '', // OpenFIGI doesn't return CUSIP directly for ticker lookups
                figi: match.figi,
                ticker: match.ticker,
                name: match.name,
                exchCode: match.exchCode,
                securityType: match.securityType,
                marketSector: match.marketSector,
                cachedAt: new Date().toISOString(),
              });
            }
          }
        });
      });
    } catch (error) {
      console.error('Error mapping tickers:', error instanceof Error ? error.message : error);
      // Mark batch as failed
      for (const ticker of batch) {
        results.push({
          cusip: '',
          ticker: ticker.toUpperCase(),
          error: error instanceof Error ? error.message : 'API error',
          cachedAt: new Date().toISOString(),
        });
      }
    }
  }

  return results;
}

/**
 * Clear expired errors from cache (for maintenance)
 */
export async function clearExpiredErrors(): Promise<number> {
  const persistentCache = await loadPersistentCache();
  let cleared = 0;

  for (const [cusip, mapping] of Object.entries(persistentCache)) {
    if (mapping.error && isErrorExpired(mapping)) {
      delete persistentCache[cusip];
      memoryCache.delete(cusip);
      cleared++;
    }
  }

  if (cleared > 0) {
    await savePersistentCache(persistentCache);
    console.log(`Cleared ${cleared} expired error entries from CUSIP cache`);
  }

  return cleared;
}

/**
 * Get all cached mappings
 */
export async function getAllCachedMappings(): Promise<CUSIPMapping[]> {
  const persistentCache = await loadPersistentCache();
  return Object.values(persistentCache);
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{
  totalMappings: number;
  successfulMappings: number;
  failedMappings: number;
  memoryCacheSize: number;
}> {
  const persistentCache = await loadPersistentCache();
  const mappings = Object.values(persistentCache);

  return {
    totalMappings: mappings.length,
    successfulMappings: mappings.filter(m => m.ticker).length,
    failedMappings: mappings.filter(m => m.error).length,
    memoryCacheSize: memoryCache.size,
  };
}
