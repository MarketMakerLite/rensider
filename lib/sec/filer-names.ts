/**
 * Filer Name Resolution with Caching
 *
 * Resolves CIKs to institution names using SEC's submissions API.
 * Implements dual-layer caching (memory + persistent file) for performance.
 * Includes reverse lookup (name → CIK) for search functionality.
 */

import { join } from 'path';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { fetchFromSEC } from './client';
import { padCik, normalizeCik, validateCik } from '@/lib/validators';

// Use /tmp for serverless environments (Vercel), otherwise use configured data dir
const DATA_DIR = process.env.VERCEL ? '/tmp' : (process.env.SEC_DATA_DIR || 'data');
const CACHE_FILE = join(DATA_DIR, 'reference', 'filer-names.json');

// Memory cache for fast lookups (CIK → name)
const memoryCache = new Map<string, string>();

// Reverse index for name → CIK lookups
const nameIndex = new Map<string, string[]>();
let nameIndexBuilt = false;

// Persistent cache structure
interface FilerNameCache {
  [cik: string]: {
    name: string;
    cachedAt: string;
  };
}

let persistentCache: FilerNameCache | null = null;
let cacheLoaded = false;

/**
 * Internal: Pad CIK to 10-digit format for SEC API
 */
function padCikInternal(cik: string): string {
  return padCik(cik);
}

/**
 * Build the reverse name index for searching
 */
function buildNameIndex(): void {
  if (nameIndexBuilt || !persistentCache) return;

  nameIndex.clear();

  for (const [cik, entry] of Object.entries(persistentCache)) {
    const nameLower = entry.name.toLowerCase();
    // Index by full name
    const existing = nameIndex.get(nameLower) || [];
    existing.push(cik);
    nameIndex.set(nameLower, existing);

    // Also index individual words for partial matching
    const words = nameLower.split(/\s+/);
    for (const word of words) {
      if (word.length >= 3) { // Only index words with 3+ chars
        const wordEntries = nameIndex.get(word) || [];
        if (!wordEntries.includes(cik)) {
          wordEntries.push(cik);
          nameIndex.set(word, wordEntries);
        }
      }
    }
  }

  nameIndexBuilt = true;
}

/**
 * Load persistent cache from disk
 */
async function loadPersistentCache(): Promise<FilerNameCache> {
  if (persistentCache !== null) {
    return persistentCache;
  }

  try {
    const data = await readFile(CACHE_FILE, 'utf-8');
    persistentCache = JSON.parse(data);

    // Populate memory cache
    for (const [cik, entry] of Object.entries(persistentCache!)) {
      memoryCache.set(cik, entry.name);
    }

    cacheLoaded = true;
    // Build name index for reverse lookups
    buildNameIndex();
    return persistentCache!;
  } catch {
    persistentCache = {};
    return persistentCache;
  }
}

/**
 * Save persistent cache to disk
 */
async function savePersistentCache(): Promise<void> {
  if (!persistentCache) return;

  try {
    await mkdir(join(DATA_DIR, 'reference'), { recursive: true });
    await writeFile(CACHE_FILE, JSON.stringify(persistentCache, null, 2));
  } catch (error) {
    console.error('Failed to save filer names cache:', error instanceof Error ? error.message : error);
  }
}

/**
 * Fetch filer name from SEC API
 */
async function fetchFilerName(cik: string): Promise<string | null> {
  const paddedCik = padCikInternal(cik);
  const url = `https://data.sec.gov/submissions/CIK${paddedCik}.json`;

  try {
    const response = await fetchFromSEC(url);
    const data = await response.json();
    return data.name || null;
  } catch (error) {
    console.debug(`Failed to fetch name for CIK ${cik}:`, error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Get filer name for a single CIK
 *
 * @param cik - The CIK to look up
 * @param options - Options for fetching behavior
 * @param options.fetchIfMissing - If true (default), fetch from SEC API if not cached.
 *                                  If false, return placeholder immediately.
 */
export async function getFilerName(
  cik: string,
  options: { fetchIfMissing?: boolean } = {}
): Promise<string> {
  const { fetchIfMissing = true } = options;

  // Validate CIK format before proceeding
  const validation = validateCik.validate(cik);
  if (!validation.valid) {
    // Return fallback for invalid CIKs without attempting API call
    return `CIK ${cik}`;
  }

  const normalized = padCikInternal(cik);

  // Check memory cache first
  if (memoryCache.has(normalized)) {
    return memoryCache.get(normalized)!;
  }

  // Load persistent cache if not loaded
  if (!cacheLoaded) {
    await loadPersistentCache();
    if (memoryCache.has(normalized)) {
      return memoryCache.get(normalized)!;
    }
  }

  // If not fetching, return placeholder and optionally trigger background fetch
  if (!fetchIfMissing) {
    // Fire-and-forget: fetch name in background for future requests
    setImmediate(() => {
      getFilerName(cik, { fetchIfMissing: true }).catch(() => {});
    });
    return `CIK ${normalizeCik(cik)}`;
  }

  // Fetch from API
  const name = await fetchFilerName(cik);

  if (name) {
    // Update both caches
    memoryCache.set(normalized, name);
    if (persistentCache) {
      persistentCache[normalized] = {
        name,
        cachedAt: new Date().toISOString(),
      };
      // Rebuild name index when new entries are added
      nameIndexBuilt = false;
      // Save asynchronously (don't await)
      savePersistentCache().catch(() => {});
    }
    return name;
  }

  // Fallback to CIK
  return `CIK ${normalizeCik(cik)}`;
}

/**
 * Batch resolve filer names for multiple CIKs
 * More efficient than individual lookups
 *
 * @param ciks - Array of CIKs to resolve
 * @param options - Options for fetching behavior
 * @param options.fetchMissing - If true, fetch names from SEC API for uncached CIKs.
 *                               If false (default for web requests), return placeholder for uncached names.
 */
export async function getFilerNames(
  ciks: string[],
  options: { fetchMissing?: boolean } = {}
): Promise<Map<string, string>> {
  const { fetchMissing = false } = options;
  const results = new Map<string, string>();
  const toFetch: string[] = [];

  // Load cache if needed
  if (!cacheLoaded) {
    await loadPersistentCache();
  }

  // Check cache for each CIK, filtering out invalid CIKs
  for (const cik of ciks) {
    // Validate CIK format before processing
    const validation = validateCik.validate(cik);
    if (!validation.valid) {
      // Skip invalid CIKs (e.g., date strings from corrupted MotherDuck data)
      results.set(cik, `CIK ${cik}`);
      continue;
    }

    const normalized = padCikInternal(cik);
    if (memoryCache.has(normalized)) {
      results.set(cik, memoryCache.get(normalized)!);
    } else {
      toFetch.push(cik);
    }
  }

  // Handle uncached CIKs
  if (toFetch.length > 0) {
    if (fetchMissing) {
      // Fetch missing names from SEC API (for background/script usage)
      const BATCH_SIZE = 5;

      for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        const batch = toFetch.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (cik) => {
          const name = await getFilerName(cik);
          results.set(cik, name);
        });
        await Promise.all(promises);

        // Small delay between batches to respect rate limits
        if (i + BATCH_SIZE < toFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    } else {
      // For web requests: return placeholder immediately, fetch in background
      for (const cik of toFetch) {
        const normalized = normalizeCik(cik);
        results.set(cik, `CIK ${normalized}`);
      }

      // Fire-and-forget: fetch names in background for future requests
      if (toFetch.length > 0) {
        setImmediate(() => {
          getFilerNames(toFetch, { fetchMissing: true }).catch(() => {
            // Ignore errors from background fetching
          });
        });
      }
    }
  }

  return results;
}

/**
 * Preload filer names for a list of CIKs
 * Call this during data sync to build up the cache
 */
export async function preloadFilerNames(ciks: string[]): Promise<number> {
  const uniqueCiks = [...new Set(ciks.map(padCikInternal))];

  // Filter out already cached
  if (!cacheLoaded) {
    await loadPersistentCache();
  }

  const uncached = uniqueCiks.filter(cik => !memoryCache.has(cik));

  if (uncached.length === 0) {
    return 0;
  }

  console.log(`Preloading ${uncached.length} filer names...`);

  await getFilerNames(uncached);

  // Force save cache
  await savePersistentCache();

  return uncached.length;
}

/**
 * Get cache statistics
 */
export async function getFilerNameCacheStats(): Promise<{
  memoryCacheSize: number;
  persistentCacheSize: number;
  nameIndexSize: number;
}> {
  if (!cacheLoaded) {
    await loadPersistentCache();
  }

  return {
    memoryCacheSize: memoryCache.size,
    persistentCacheSize: Object.keys(persistentCache || {}).length,
    nameIndexSize: nameIndex.size,
  };
}

// ============================================================================
// Name → CIK Search Functions (Reverse Lookup)
// ============================================================================

export interface FilerSearchResult {
  cik: string;
  name: string;
  score: number; // Match quality score (higher is better)
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Search for filers by name
 * Returns matches sorted by relevance score
 */
export async function searchFilersByName(
  query: string,
  limit: number = 10
): Promise<FilerSearchResult[]> {
  if (!cacheLoaded) {
    await loadPersistentCache();
  }

  if (!nameIndexBuilt) {
    buildNameIndex();
  }

  const queryLower = query.toLowerCase().trim();
  if (queryLower.length < 2) {
    return [];
  }

  const candidates = new Map<string, number>(); // CIK → score

  // Exact match on full name (highest priority)
  const exactMatches = nameIndex.get(queryLower);
  if (exactMatches) {
    for (const cik of exactMatches) {
      candidates.set(cik, 1000);
    }
  }

  // Word-based matching
  const queryWords = queryLower.split(/\s+/);
  for (const word of queryWords) {
    if (word.length < 3) continue;

    const wordMatches = nameIndex.get(word);
    if (wordMatches) {
      for (const cik of wordMatches) {
        const currentScore = candidates.get(cik) || 0;
        candidates.set(cik, currentScore + 100);
      }
    }
  }

  // Prefix matching (for partial word matching)
  for (const [indexedTerm, ciks] of nameIndex.entries()) {
    if (indexedTerm.startsWith(queryLower) || queryLower.startsWith(indexedTerm)) {
      for (const cik of ciks) {
        const currentScore = candidates.get(cik) || 0;
        // Higher score for longer prefix matches
        const matchLength = Math.min(queryLower.length, indexedTerm.length);
        candidates.set(cik, currentScore + matchLength * 10);
      }
    }
  }

  // If no candidates found, try fuzzy matching on all names
  if (candidates.size === 0 && persistentCache) {
    for (const [cik, entry] of Object.entries(persistentCache)) {
      const nameLower = entry.name.toLowerCase();
      const distance = levenshteinDistance(queryLower, nameLower);
      const maxLen = Math.max(queryLower.length, nameLower.length);
      const similarity = 1 - distance / maxLen;

      // Only include if similarity is above threshold
      if (similarity > 0.3) {
        candidates.set(cik, Math.round(similarity * 50));
      }
    }
  }

  // Convert to results array with names
  const results: FilerSearchResult[] = [];
  for (const [cik, score] of candidates.entries()) {
    const name = memoryCache.get(cik);
    if (name) {
      results.push({ cik, name, score });
    }
  }

  // Sort by score (descending) and return top results
  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Search for filers by exact CIK or name
 * Useful for autocomplete functionality
 */
export async function searchFilers(
  query: string,
  limit: number = 10
): Promise<FilerSearchResult[]> {
  if (!query || query.length < 2) {
    return [];
  }

  // Check if query looks like a CIK (all digits)
  if (/^\d+$/.test(query)) {
    const cik = padCikInternal(query);
    const name = await getFilerName(cik);
    if (name && !name.startsWith('CIK ')) {
      return [{ cik, name, score: 1000 }];
    }
    // If CIK not found, return empty (don't search names for numeric queries)
    return [];
  }

  // Search by name
  return searchFilersByName(query, limit);
}
