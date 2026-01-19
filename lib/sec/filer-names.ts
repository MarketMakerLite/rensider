/**
 * Filer Name Resolution with Caching
 *
 * Resolves CIKs to institution names using SEC's submissions API.
 * Implements dual-layer caching (memory + MotherDuck database) for performance.
 * Includes reverse lookup (name → CIK) for search functionality.
 */

import { fetchFromSEC } from './client';
import { query, execute } from './duckdb';
import { padCik, normalizeCik, validateCik } from '@/lib/validators';

// Memory cache for fast lookups (CIK → name)
const memoryCache = new Map<string, string>();

// Reverse index for name → CIK lookups
const nameIndex = new Map<string, string[]>();
let nameIndexBuilt = false;

// Track if we've loaded from DB
let dbCacheLoaded = false;

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
  if (nameIndexBuilt) return;

  nameIndex.clear();

  for (const [cik, name] of memoryCache.entries()) {
    const nameLower = name.toLowerCase();
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
 * Load filer names from database into memory cache
 */
async function loadFromDatabase(): Promise<void> {
  if (dbCacheLoaded) return;

  try {
    const rows = await query<{ cik: string; name: string }>('SELECT cik, name FROM filer_names');
    for (const row of rows) {
      memoryCache.set(row.cik, row.name);
    }
    dbCacheLoaded = true;
    // Build name index for reverse lookups
    buildNameIndex();
  } catch (error) {
    // Table might not exist yet, that's ok
    console.debug('Failed to load filer names from database:', error instanceof Error ? error.message : error);
    dbCacheLoaded = true; // Don't retry on every call
  }
}

/**
 * Save a filer name to the database
 */
async function saveToDatabase(cik: string, name: string): Promise<void> {
  try {
    await execute(`
      INSERT INTO filer_names (cik, name, cached_at)
      VALUES ('${cik.replace(/'/g, "''")}', '${name.replace(/'/g, "''")}', CURRENT_TIMESTAMP)
      ON CONFLICT (cik) DO UPDATE SET name = EXCLUDED.name, cached_at = CURRENT_TIMESTAMP
    `);
  } catch (error) {
    console.debug('Failed to save filer name to database:', error instanceof Error ? error.message : error);
  }
}

/**
 * Batch save filer names to the database
 */
async function batchSaveToDatabase(entries: Map<string, string>): Promise<void> {
  if (entries.size === 0) return;

  try {
    // Build VALUES clause
    const values: string[] = [];
    for (const [cik, name] of entries) {
      const safeCik = cik.replace(/'/g, "''");
      const safeName = name.replace(/'/g, "''");
      values.push(`('${safeCik}', '${safeName}', CURRENT_TIMESTAMP)`);
    }

    await execute(`
      INSERT INTO filer_names (cik, name, cached_at)
      VALUES ${values.join(', ')}
      ON CONFLICT (cik) DO UPDATE SET name = EXCLUDED.name, cached_at = CURRENT_TIMESTAMP
    `);
  } catch (error) {
    console.debug('Failed to batch save filer names to database:', error instanceof Error ? error.message : error);
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

  // Load from database if not loaded
  if (!dbCacheLoaded) {
    await loadFromDatabase();
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
    // Update memory cache
    memoryCache.set(normalized, name);
    // Rebuild name index when new entries are added
    nameIndexBuilt = false;
    // Save to database asynchronously (don't await)
    saveToDatabase(normalized, name).catch(() => {});
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

  // Load from database if needed
  if (!dbCacheLoaded) {
    await loadFromDatabase();
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
      const newEntries = new Map<string, string>();

      for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
        const batch = toFetch.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (cik) => {
          const name = await fetchFilerName(cik);
          const normalized = padCikInternal(cik);
          if (name) {
            memoryCache.set(normalized, name);
            newEntries.set(normalized, name);
            results.set(cik, name);
          } else {
            results.set(cik, `CIK ${normalizeCik(cik)}`);
          }
        });
        await Promise.all(promises);

        // Small delay between batches to respect rate limits
        if (i + BATCH_SIZE < toFetch.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      // Batch save new entries to database
      if (newEntries.size > 0) {
        nameIndexBuilt = false;
        batchSaveToDatabase(newEntries).catch(() => {});
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

  // Load from database if not loaded
  if (!dbCacheLoaded) {
    await loadFromDatabase();
  }

  const uncached = uniqueCiks.filter(cik => !memoryCache.has(cik));

  if (uncached.length === 0) {
    return 0;
  }

  console.log(`Preloading ${uncached.length} filer names...`);

  await getFilerNames(uncached, { fetchMissing: true });

  return uncached.length;
}

/**
 * Get cache statistics
 */
export async function getFilerNameCacheStats(): Promise<{
  memoryCacheSize: number;
  databaseCacheSize: number;
  nameIndexSize: number;
}> {
  if (!dbCacheLoaded) {
    await loadFromDatabase();
  }

  let databaseCacheSize = 0;
  try {
    const result = await query<{ count: number }>('SELECT COUNT(*) as count FROM filer_names');
    databaseCacheSize = result[0]?.count ?? 0;
  } catch {
    // Table might not exist
  }

  return {
    memoryCacheSize: memoryCache.size,
    databaseCacheSize,
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
  if (!dbCacheLoaded) {
    await loadFromDatabase();
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
  if (candidates.size === 0) {
    for (const [cik, name] of memoryCache.entries()) {
      const nameLower = name.toLowerCase();
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
