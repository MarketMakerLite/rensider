#!/usr/bin/env npx tsx

/**
 * 13D/13G Backfill Script
 *
 * Downloads and processes historical Schedule 13D/13G data from SEC EDGAR.
 * Parses the SEC-HEADER section from submission text files which contains
 * structured metadata about the filing.
 *
 * Usage:
 *   npx tsx scripts/backfill-13dg.ts [options]
 *
 * Options:
 *   --start-year=YYYY   Start year (default: 2020)
 *   --end-year=YYYY     End year (default: current year)
 *   --quarter=Q         Process single quarter (1-4)
 *   --resume            Resume from last progress
 *   --dry-run           List filings without downloading
 *   --limit=N           Limit number of filings to process
 */

import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fetchFormIndex, fetchText, type FormIndexEntry } from '../lib/sec/client';
import { getDataPath } from '../lib/sec/download';
import {
  initBackfillProgress,
  updateQuarterProgress,
  readBackfillProgress,
} from '../lib/sec/sync-state';
import {
  parseSchedule13Header,
  headerToFilingRecord,
  SCHEDULE13_HEADER_SCHEMA,
} from '../lib/sec/schedule13-header-parser';

interface BackfillOptions {
  startYear: number;
  endYear: number;
  quarter?: number;
  resume: boolean;
  dryRun: boolean;
  limit?: number;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const currentYear = new Date().getFullYear();

  const options: BackfillOptions = {
    startYear: 2020, // Start from 2020 for reasonable data volume
    endYear: currentYear,
    resume: false,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--start-year=')) {
      options.startYear = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--end-year=')) {
      options.endYear = parseInt(arg.split('=')[1]);
    } else if (arg.startsWith('--quarter=')) {
      options.quarter = parseInt(arg.split('=')[1]);
    } else if (arg === '--resume') {
      options.resume = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    }
  }

  return options;
}

// Form types to track
const SCHEDULE_13_FORM_TYPES = [
  'SC 13D',
  'SC 13D/A',
  'SC 13G',
  'SC 13G/A',
];

interface QuarterInfo {
  year: number;
  quarter: number;
}

function generateQuarters(startYear: number, endYear: number, singleQuarter?: number): QuarterInfo[] {
  const quarters: QuarterInfo[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  for (let year = startYear; year <= endYear; year++) {
    for (let q = 1; q <= 4; q++) {
      if (singleQuarter && q !== singleQuarter) continue;
      if (year === currentYear && q > currentQuarter) break;

      quarters.push({ year, quarter: q });
    }
  }

  return quarters;
}

function getAccessionNumber(indexEntry: FormIndexEntry): string {
  // Extract accession number from file path
  const parts = indexEntry.fileName.split('/');
  return parts[parts.length - 1].replace('.txt', '');
}

function getSubmissionTextUrl(indexEntry: FormIndexEntry): string {
  // Get the URL to the submission text file (contains SEC-HEADER)
  const accessionWithDashes = getAccessionNumber(indexEntry);
  const accessionNoDashes = accessionWithDashes.replace(/-/g, '');
  return `https://www.sec.gov/Archives/edgar/data/${indexEntry.cik}/${accessionNoDashes}/${accessionWithDashes}.txt`;
}

async function fetchSubmissionText(indexEntry: FormIndexEntry): Promise<string | null> {
  try {
    const url = getSubmissionTextUrl(indexEntry);
    return await fetchText(url);
  } catch (error) {
    // Silently skip - some filings may not be accessible
    return null;
  }
}

async function writeParquetFile(
  records: Record<string, unknown>[],
  filePath: string,
  schema: Record<string, { type: string; optional?: boolean }>
): Promise<void> {
  if (records.length === 0) return;

  const parquetModule = await import('parquetjs-lite');
  const parquet = parquetModule.default || parquetModule;
  const fullPath = getDataPath(filePath);

  await mkdir(dirname(fullPath), { recursive: true });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parquetSchema = new parquet.ParquetSchema(schema as any);
  const writer = await parquet.ParquetWriter.openFile(parquetSchema, fullPath);

  for (const record of records) {
    await writer.appendRow(record);
  }

  await writer.close();
}

interface ProcessResult {
  processed: number;
  failed: number;
  skipped: number;
}

async function processQuarter(quarter: QuarterInfo, options: BackfillOptions): Promise<ProcessResult> {
  const quarterStr = `${quarter.year}-Q${quarter.quarter}`;
  const result: ProcessResult = { processed: 0, failed: 0, skipped: 0 };

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing ${quarterStr}`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Update progress: downloading index
    await updateQuarterProgress('13D', quarterStr, {
      status: 'downloading',
      startedAt: new Date().toISOString(),
    });

    // Fetch form index for this quarter
    console.log(`Fetching index for ${quarter.year} Q${quarter.quarter}...`);
    const index = await fetchFormIndex(quarter.year, quarter.quarter);

    // Filter for 13D/13G forms
    const schedule13Filings = index.filter(entry =>
      SCHEDULE_13_FORM_TYPES.some(ft => entry.formType.startsWith(ft))
    );

    console.log(`Found ${schedule13Filings.length} Schedule 13D/13G filings`);

    if (options.dryRun) {
      console.log('\nSample filings:');
      for (const filing of schedule13Filings.slice(0, 10)) {
        console.log(`  ${filing.formType}: ${filing.companyName} (${filing.dateFiled})`);
      }
      return result;
    }

    // Update progress: processing
    await updateQuarterProgress('13D', quarterStr, {
      status: 'processing',
      totalFiles: schedule13Filings.length,
      filesProcessed: 0,
    });

    // Process filings
    const filingRecords: Record<string, unknown>[] = [];

    const filingsToProcess = options.limit
      ? schedule13Filings.slice(0, options.limit)
      : schedule13Filings;

    for (let i = 0; i < filingsToProcess.length; i++) {
      const entry = filingsToProcess[i];
      const accessionNumber = getAccessionNumber(entry);

      if ((i + 1) % 100 === 0) {
        console.log(`Progress: ${i + 1}/${filingsToProcess.length} (${result.processed} processed)`);
        await updateQuarterProgress('13D', quarterStr, {
          filesProcessed: i + 1,
        });
      }

      try {
        // Fetch submission text file
        const submissionText = await fetchSubmissionText(entry);

        if (!submissionText) {
          result.skipped++;
          continue;
        }

        // Parse SEC header
        const parsed = parseSchedule13Header(submissionText, accessionNumber);

        if (!parsed) {
          result.failed++;
          continue;
        }

        // Convert to record
        const record = headerToFilingRecord(parsed);
        filingRecords.push(record);

        result.processed++;

      } catch (error) {
        result.failed++;
      }
    }

    // Write Parquet file for this quarter
    if (filingRecords.length > 0) {
      console.log(`\nWriting ${filingRecords.length} filings to Parquet...`);

      await writeParquetFile(
        filingRecords,
        join('13dg', 'filings', `${quarterStr}.parquet`),
        SCHEDULE13_HEADER_SCHEMA
      );

      console.log(`Wrote ${filingRecords.length} filings to data/13dg/filings/${quarterStr}.parquet`);
    }

    // Mark complete
    await updateQuarterProgress('13D', quarterStr, {
      status: 'complete',
      completedAt: new Date().toISOString(),
      filesProcessed: filingsToProcess.length,
    });

    console.log(`Completed ${quarterStr}: ${result.processed} processed, ${result.failed} failed, ${result.skipped} skipped`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing ${quarterStr}: ${errorMessage}`);

    await updateQuarterProgress('13D', quarterStr, {
      status: 'failed',
      error: errorMessage,
    });
  }

  return result;
}

async function main() {
  const options = parseArgs();

  console.log('SEC 13D/13G Backfill Script');
  console.log('='.repeat(60));
  console.log(`Start Year: ${options.startYear}`);
  console.log(`End Year: ${options.endYear}`);
  if (options.quarter) {
    console.log(`Quarter: Q${options.quarter}`);
  }
  if (options.limit) {
    console.log(`Limit: ${options.limit} filings per quarter`);
  }
  console.log(`Resume: ${options.resume}`);
  console.log(`Dry Run: ${options.dryRun}`);
  console.log('='.repeat(60));

  // Generate list of quarters to process
  const quarters = generateQuarters(options.startYear, options.endYear, options.quarter);
  console.log(`\nTotal quarters to process: ${quarters.length}`);

  // Initialize progress tracking
  const quarterNames = quarters.map(q => `${q.year}-Q${q.quarter}`);
  await initBackfillProgress('13D', quarterNames);

  // Process quarters
  let totalProcessed = 0;
  let totalFailed = 0;
  let totalSkipped = 0;

  for (const quarter of quarters) {
    const quarterStr = `${quarter.year}-Q${quarter.quarter}`;

    // If resuming, check if already complete
    if (options.resume) {
      const progress = await readBackfillProgress('13D');
      const quarterProgress = progress?.quarters.find(q => q.quarter === quarterStr);
      if (quarterProgress?.status === 'complete') {
        console.log(`Skipping ${quarterStr} (already complete)`);
        continue;
      }
    }

    const result = await processQuarter(quarter, options);
    totalProcessed += result.processed;
    totalFailed += result.failed;
    totalSkipped += result.skipped;
  }

  console.log('\n' + '='.repeat(60));
  console.log('Backfill Summary');
  console.log('='.repeat(60));
  console.log(`Total Processed: ${totalProcessed}`);
  console.log(`Total Failed: ${totalFailed}`);
  console.log(`Total Skipped: ${totalSkipped}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
