import pLimit from 'p-limit';

// Form index entry from SEC EDGAR index files
export interface FormIndexEntry {
  formType: string;
  companyName: string;
  cik: string;
  dateFiled: string;
  fileName: string;
}

const SEC_BASE_URL = 'https://www.sec.gov';

// SEC rate limit: 10 requests per second
const rateLimiter = pLimit(10);

// User-Agent is required by SEC
const USER_AGENT = process.env.SEC_USER_AGENT || 'RensiderApp contact@example.com';

interface FetchOptions extends RequestInit {
  timeout?: number;
}

class SECRateLimitError extends Error {
  retryAfter?: number;

  constructor(message: string, retryAfter?: number) {
    super(message);
    this.name = 'SECRateLimitError';
    this.retryAfter = retryAfter;
  }
}

class SECFetchError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SECFetchError';
    this.status = status;
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, options: FetchOptions = {}): Promise<Response> {
  const { timeout = 30000, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json, text/plain, */*',
        ...fetchOptions.headers,
      },
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function fetchWithRetry(
  url: string,
  options: FetchOptions = {},
  maxRetries = 3,
  baseDelay = 1000
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options);

      if (response.ok) {
        return response;
      }

      if (response.status === 429 || response.status === 503) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '60', 10);
        throw new SECRateLimitError(
          `Rate limited (${response.status})`,
          retryAfter
        );
      }

      throw new SECFetchError(
        `HTTP ${response.status}: ${response.statusText}`,
        response.status
      );
    } catch (error) {
      lastError = error as Error;

      if (attempt === maxRetries) {
        throw lastError;
      }

      let delay = baseDelay * Math.pow(2, attempt);

      if (error instanceof SECRateLimitError && error.retryAfter) {
        delay = error.retryAfter * 1000;
      }

      console.warn(
        `Fetch attempt ${attempt + 1}/${maxRetries + 1} failed for ${url}: ${lastError.message}. Retrying in ${delay}ms...`
      );

      await sleep(delay);
    }
  }

  throw lastError;
}

export async function fetchFromSEC(url: string, options: FetchOptions = {}): Promise<Response> {
  return rateLimiter(() => fetchWithRetry(url, options));
}

export async function fetchText(url: string): Promise<string> {
  const response = await fetchFromSEC(url);
  return response.text();
}

// Index file fetching

export async function fetchFormIndex(year: number, quarter: number): Promise<FormIndexEntry[]> {
  const url = `${SEC_BASE_URL}/Archives/edgar/full-index/${year}/QTR${quarter}/form.idx`;
  const text = await fetchText(url);
  return parseFormIndex(text);
}

export async function fetchDailyIndex(date: Date): Promise<FormIndexEntry[]> {
  const year = date.getFullYear();
  const quarter = Math.ceil((date.getMonth() + 1) / 3);
  const url = `${SEC_BASE_URL}/Archives/edgar/daily-index/${year}/QTR${quarter}/form.idx`;
  const text = await fetchText(url);
  return parseFormIndex(text);
}

function parseFormIndex(indexText: string): FormIndexEntry[] {
  const lines = indexText.split('\n');
  const entries: FormIndexEntry[] = [];

  // Skip header lines (find the line with dashes)
  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('---')) {
      dataStart = i + 1;
      break;
    }
  }

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Fixed-width format: Form Type (12), Company Name (62), CIK (12), Date Filed (12), File Name
    // But fields can overflow, so we parse more carefully
    const parts = line.split(/\s{2,}/);
    if (parts.length >= 5) {
      entries.push({
        formType: parts[0].trim(),
        companyName: parts[1].trim(),
        cik: parts[2].trim(),
        dateFiled: parts[3].trim(),
        fileName: parts[4].trim(),
      });
    }
  }

  return entries;
}

// Filing URL construction

export function getFilingUrl(cik: string, accessionNumber: string, document: string): string {
  const accessionNoDashes = accessionNumber.replace(/-/g, '');
  return `${SEC_BASE_URL}/Archives/edgar/data/${cik}/${accessionNoDashes}/${document}`;
}

export { SECRateLimitError, SECFetchError };

// Search API

interface SearchFilingsOptions {
  query?: string;
  formTypes?: string[];
  startDate?: string;
  endDate?: string;
  limit?: number;
}

interface SearchFilingResult {
  accessionNumber: string;
  cik: string;
  formType: string;
  filingDate: string;
  companyName: string;
}

export async function searchFilings(options: SearchFilingsOptions): Promise<SearchFilingResult[]> {
  const { query, formTypes, startDate, endDate, limit = 100 } = options;

  // Build the EDGAR search URL
  const params = new URLSearchParams();

  if (query) {
    params.set('q', query);
  }

  if (formTypes && formTypes.length > 0) {
    params.set('forms', formTypes.join(','));
  }

  if (startDate) {
    params.set('startdt', startDate);
  }

  if (endDate) {
    params.set('enddt', endDate);
  }

  params.set('from', '0');
  params.set('size', String(limit));

  const url = `https://efts.sec.gov/LATEST/search-index?${params.toString()}`;

  try {
    const response = await fetchFromSEC(url);
    const data = await response.json();

    const results: SearchFilingResult[] = [];

    if (data.hits?.hits) {
      for (const hit of data.hits.hits) {
        const source = hit._source;
        results.push({
          accessionNumber: source.adsh || source.accession_number || '',
          cik: source.ciks?.[0] || '',
          formType: source.file_type || source.form || '',
          filingDate: source.file_date || '',
          companyName: source.display_names?.[0] || source.entity || '',
        });
      }
    }

    return results;
  } catch (error) {
    console.error('Error searching filings:', error);
    return [];
  }
}
