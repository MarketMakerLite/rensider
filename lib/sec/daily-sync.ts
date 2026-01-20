/**
 * Daily Sync Library
 *
 * Core sync logic for fetching SEC filings and storing directly in database.
 * Works with both local DuckDB and MotherDuck (cloud).
 */

import {
  fetchFormIndex,
  fetchText,
  type FormIndexEntry,
} from './client';
import {
  readSyncState,
  markSyncStarted,
  markSyncComplete,
  markSyncFailed,
} from './sync-state';
import {
  parseSchedule13Header,
  headerToFilingRecord,
} from './schedule13-header-parser';
import {
  upsertRows,
  initializeSchema,
  isCloudMode,
  pruneOldData,
} from './duckdb';

export interface SyncOptions {
  forms: ('13F' | '13DG')[];
  force: boolean;
  dryRun: boolean;
}

export interface SyncResult {
  processed: number;
  failed: number;
  skipped?: boolean;
  message?: string;
}

export interface FullSyncResult {
  '13F'?: SyncResult;
  '13DG'?: SyncResult;
  pruned?: {
    totalDeleted: number;
    deletedByTable: Record<string, number>;
  };
  startedAt: string;
  completedAt: string;
}

// 13F form types
const FORM_13F_TYPES = ['13F-HR', '13F-HR/A', '13F-NT', '13F-NT/A'];

// Schedule 13D/13G form types (SEC index uses full "SCHEDULE" prefix)
const SCHEDULE_13_TYPES = [
  'SC 13D', 'SC 13D/A', 'SC 13G', 'SC 13G/A',
  'SCHEDULE 13D', 'SCHEDULE 13D/A', 'SCHEDULE 13G', 'SCHEDULE 13G/A',
];

interface FilingToProcess {
  indexEntry: FormIndexEntry;
  accessionNumber: string;
}

// Check if we should run sync today
function shouldRunSync(lastRunDate: string | undefined, force: boolean): boolean {
  if (force) return true;
  if (!lastRunDate) return true;

  const last = new Date(lastRunDate);
  const now = new Date();

  // Run if last sync was before today
  return last.toDateString() !== now.toDateString();
}

function getAccessionNumber(entry: FormIndexEntry): string {
  const parts = entry.fileName.split('/');
  return parts[parts.length - 1].replace('.txt', '');
}

/**
 * Get list of quarters between two dates
 */
function getQuartersBetween(startDate: Date, endDate: Date): { year: number; quarter: number }[] {
  const quarters: { year: number; quarter: number }[] = [];

  let year = startDate.getFullYear();
  let quarter = Math.ceil((startDate.getMonth() + 1) / 3);

  const endYear = endDate.getFullYear();
  const endQuarter = Math.ceil((endDate.getMonth() + 1) / 3);

  while (year < endYear || (year === endYear && quarter <= endQuarter)) {
    quarters.push({ year, quarter });
    quarter++;
    if (quarter > 4) {
      quarter = 1;
      year++;
    }
  }

  return quarters;
}

async function getNewFilingsSinceDate(
  formTypes: string[],
  lastProcessedDate: string | undefined
): Promise<FilingToProcess[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  // Determine which quarters to fetch
  let quartersToFetch: { year: number; quarter: number }[];
  let filterDate: Date;

  if (lastProcessedDate) {
    const lastDate = new Date(lastProcessedDate);
    filterDate = lastDate;

    // Get all quarters from lastProcessedDate to now
    quartersToFetch = getQuartersBetween(lastDate, now);

    // Log if we're fetching multiple quarters (backfilling)
    if (quartersToFetch.length > 1) {
      console.log(`Backfilling ${quartersToFetch.length} quarters since last processed date: ${lastProcessedDate}`);
    }
  } else {
    // If no last processed date, get last 7 days of filings from current quarter only
    filterDate = new Date();
    filterDate.setDate(filterDate.getDate() - 7);
    quartersToFetch = [{ year: currentYear, quarter: currentQuarter }];
  }

  // Fetch form indices for all relevant quarters
  const allFilings: FormIndexEntry[] = [];

  for (const { year, quarter } of quartersToFetch) {
    try {
      console.log(`Fetching ${year}-Q${quarter} form index...`);
      const index = await fetchFormIndex(year, quarter);

      // Filter for relevant form types
      const relevantFilings = index.filter(entry =>
        formTypes.some(ft => entry.formType.startsWith(ft))
      );

      allFilings.push(...relevantFilings);
    } catch (error) {
      console.error(`Error fetching ${year}-Q${quarter}: ${error}`);
    }
  }

  // Filter for filings after the filter date
  const newFilings = allFilings.filter(entry => {
    const filingDate = new Date(entry.dateFiled);
    return filingDate > filterDate;
  });

  return newFilings.map(entry => ({
    indexEntry: entry,
    accessionNumber: getAccessionNumber(entry),
  }));
}

// Fetch submission text file for Schedule 13D/13G (contains SEC-HEADER)
async function fetchSubmissionText(entry: FormIndexEntry): Promise<string | null> {
  try {
    const accessionWithDashes = getAccessionNumber(entry);
    const accessionNoDashes = accessionWithDashes.replace(/-/g, '');
    const url = `https://www.sec.gov/Archives/edgar/data/${entry.cik}/${accessionNoDashes}/${accessionWithDashes}.txt`;
    return await fetchText(url);
  } catch {
    return null;
  }
}

export async function sync13F(options: SyncOptions): Promise<SyncResult> {
  const source = 'daily-sync-13f';
  const result: SyncResult = { processed: 0, failed: 0 };

  // Check last sync state
  const syncState = await readSyncState();
  const state = syncState[source];

  if (!shouldRunSync(state?.lastRunAt, options.force)) {
    return { ...result, skipped: true, message: 'Already synced today' };
  }

  if (options.dryRun) {
    const newFilings = await getNewFilingsSinceDate(FORM_13F_TYPES, state?.lastProcessedDate);
    return {
      ...result,
      processed: newFilings.length,
      message: `Dry run: would process ${newFilings.length} filings`,
    };
  }

  try {
    await markSyncStarted(source);

    // Ensure schema exists (for MotherDuck)
    if (isCloudMode()) {
      await initializeSchema();
    }

    // Get new filings
    const newFilings = await getNewFilingsSinceDate(FORM_13F_TYPES, state?.lastProcessedDate);

    if (newFilings.length === 0) {
      await markSyncComplete(source, new Date().toISOString().split('T')[0]);
      return { ...result, message: 'No new filings to process' };
    }

    // Track latest filing date
    let latestDate = state?.lastProcessedDate || '';

    for (const filing of newFilings) {
      if (filing.indexEntry.dateFiled > latestDate) {
        latestDate = filing.indexEntry.dateFiled;
      }
      result.processed++;
    }

    await markSyncComplete(source, latestDate);
    result.message = `Processed ${result.processed} filings, latest date: ${latestDate}`;

  } catch (error) {
    await markSyncFailed(source, error as Error);
    throw error;
  }

  return result;
}

export async function sync13DG(options: SyncOptions): Promise<SyncResult> {
  const source = 'daily-sync-13dg';
  const result: SyncResult = { processed: 0, failed: 0 };

  // Check last sync state
  const syncState = await readSyncState();
  const state = syncState[source];

  if (!shouldRunSync(state?.lastRunAt, options.force)) {
    return { ...result, skipped: true, message: 'Already synced today' };
  }

  if (options.dryRun) {
    const newFilings = await getNewFilingsSinceDate(SCHEDULE_13_TYPES, state?.lastProcessedDate);
    return {
      ...result,
      processed: newFilings.length,
      message: `Dry run: would process ${newFilings.length} filings`,
    };
  }

  try {
    await markSyncStarted(source);

    // Ensure schema exists (for MotherDuck)
    if (isCloudMode()) {
      await initializeSchema();
    }

    // Get new filings
    const newFilings = await getNewFilingsSinceDate(SCHEDULE_13_TYPES, state?.lastProcessedDate);

    if (newFilings.length === 0) {
      await markSyncComplete(source, new Date().toISOString().split('T')[0]);
      return { ...result, message: 'No new filings to process' };
    }

    // Process each filing
    const filingRecords: Record<string, unknown>[] = [];
    let latestDate = state?.lastProcessedDate || '';

    for (const filing of newFilings) {
      try {
        // Fetch submission text file (contains SEC-HEADER)
        const submissionText = await fetchSubmissionText(filing.indexEntry);

        if (!submissionText) {
          result.failed++;
          continue;
        }

        // Parse SEC header
        const parsed = parseSchedule13Header(submissionText, filing.accessionNumber);

        if (!parsed) {
          result.failed++;
          continue;
        }

        // Convert to record
        const record = headerToFilingRecord(parsed);
        filingRecords.push(record);

        if (filing.indexEntry.dateFiled > latestDate) {
          latestDate = filing.indexEntry.dateFiled;
        }

        result.processed++;

      } catch (error) {
        console.error(`Error processing ${filing.accessionNumber}: ${error}`);
        result.failed++;
      }
    }

    // Insert records into database
    if (filingRecords.length > 0) {
      await upsertRows('filings_13dg', filingRecords, 'ACCESSION_NUMBER');
      console.log(`Inserted ${filingRecords.length} 13D/G filings into database`);
    }

    await markSyncComplete(source, latestDate);
    result.message = `Processed ${result.processed}, failed ${result.failed}, latest date: ${latestDate}`;

  } catch (error) {
    await markSyncFailed(source, error as Error);
    throw error;
  }

  return result;
}

export async function runSync(options: SyncOptions): Promise<FullSyncResult> {
  const startedAt = new Date().toISOString();
  const result: FullSyncResult = {
    startedAt,
    completedAt: '',
  };

  // Sync 13F if requested
  if (options.forms.includes('13F')) {
    result['13F'] = await sync13F(options);
  }

  // Sync 13D/13G if requested
  if (options.forms.includes('13DG')) {
    result['13DG'] = await sync13DG(options);
  }

  // Prune old data (>3 years) after syncing
  if (!options.dryRun) {
    try {
      result.pruned = await pruneOldData(3);
    } catch (error) {
      console.error('Warning: Failed to prune old data:', error);
    }
  }

  result.completedAt = new Date().toISOString();
  return result;
}
