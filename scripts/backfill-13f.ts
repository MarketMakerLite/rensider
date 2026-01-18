#!/usr/bin/env npx tsx

/**
 * 13F Backfill Script
 *
 * Downloads and processes historical Form 13F data from SEC EDGAR.
 * Data is available from May 2013 onwards.
 *
 * Usage:
 *   npx tsx scripts/backfill-13f.ts [options]
 *
 * Options:
 *   --start-year=YYYY   Start year (default: 2013)
 *   --end-year=YYYY     End year (default: current year)
 *   --quarter=Q         Process single quarter (1-4)
 *   --resume            Resume from last progress
 *   --dry-run           List files without downloading
 */

import { mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { fetchFromSEC } from '../lib/sec/client';
import { downloadAndExtractZip, getDataPath } from '../lib/sec/download';
import {
  initBackfillProgress,
  updateQuarterProgress,
  getNextPendingQuarter,
  isBackfillComplete,
} from '../lib/sec/sync-state';
import { convertTsvToParquet, INFOTABLE_SCHEMA, SUBMISSION_SCHEMA } from '../lib/sec/db';

interface BackfillOptions {
  startYear: number;
  endYear: number;
  quarter?: number;
  resume: boolean;
  dryRun: boolean;
}

function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const currentYear = new Date().getFullYear();

  const options: BackfillOptions = {
    startYear: 2013,
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
    }
  }

  return options;
}

interface QuarterInfo {
  year: number;
  quarter: number;
  name: string;
  zipUrl: string;
}

function generateQuarters(startYear: number, endYear: number, singleQuarter?: number): QuarterInfo[] {
  const quarters: QuarterInfo[] = [];
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  // Quarter naming follows SEC convention:
  // Q1 = Dec-Feb, Q2 = Mar-May, Q3 = Jun-Aug, Q4 = Sep-Nov
  const monthRanges = [
    { start: 'dec', end: 'feb', startDay: 1, endDay: 28 },
    { start: 'mar', end: 'may', startDay: 1, endDay: 31 },
    { start: 'jun', end: 'aug', startDay: 1, endDay: 31 },
    { start: 'sep', end: 'nov', startDay: 1, endDay: 30 },
  ];

  for (let year = startYear; year <= endYear; year++) {
    for (let q = 1; q <= 4; q++) {
      if (singleQuarter && q !== singleQuarter) continue;

      // Skip future quarters
      if (year === currentYear && q >= currentQuarter) break;
      // Skip Q1 2013 (data starts May 2013)
      if (year === 2013 && q < 2) continue;

      const range = monthRanges[q - 1];
      let startYear2 = year;
      let endYear2 = year;

      // Q1 spans Dec of previous year to Feb of current year
      if (q === 1) {
        startYear2 = year - 1;
      }

      // Adjust Feb for leap years
      let endDay = range.endDay;
      if (q === 1 && isLeapYear(endYear2)) {
        endDay = 29;
      }

      const name = `${String(range.startDay).padStart(2, '0')}${range.start}${startYear2}-${String(endDay).padStart(2, '0')}${range.end}${endYear2}_form13f`;

      quarters.push({
        year,
        quarter: q,
        name,
        zipUrl: `https://www.sec.gov/files/structureddata/data/form-13f-data-sets/${name}.zip`,
      });
    }
  }

  return quarters;
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

interface TsvFile {
  name: string;
  outName: string;
  schema?: Record<string, { type: 'UTF8' | 'INT64' | 'DOUBLE' | 'BOOLEAN'; optional?: boolean }>;
}

const TSV_FILES: TsvFile[] = [
  { name: 'SUBMISSION.tsv', outName: 'submissions', schema: SUBMISSION_SCHEMA },
  { name: 'INFOTABLE.tsv', outName: 'holdings', schema: INFOTABLE_SCHEMA },
];

async function processQuarter(quarter: QuarterInfo): Promise<void> {
  const { name, zipUrl, year, quarter: q } = quarter;
  const quarterStr = `${year}-Q${q}`;

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing ${quarterStr} (${name})`);
  console.log(`${'='.repeat(60)}`);

  try {
    // Update progress: downloading
    await updateQuarterProgress('13F', quarterStr, {
      status: 'downloading',
      startedAt: new Date().toISOString(),
    });

    // Download and extract ZIP
    console.log(`Downloading: ${zipUrl}`);
    const extractDir = join('13f', 'raw', quarterStr);
    const extractedFiles = await downloadAndExtractZip(zipUrl, `${name}.zip`, extractDir);

    console.log(`Extracted ${Object.keys(extractedFiles).length} files`);

    // Update progress: extracting -> processing
    await updateQuarterProgress('13F', quarterStr, {
      status: 'processing',
      totalFiles: TSV_FILES.length,
      filesProcessed: 0,
    });

    // Convert each TSV to Parquet
    let filesProcessed = 0;
    for (const { name: tsvName, outName, schema } of TSV_FILES) {
      const tsvPath = join(extractDir, tsvName);
      const parquetDir = join('13f', outName);
      const parquetPath = join(parquetDir, `${quarterStr}.parquet`);

      // Ensure output directory exists
      await mkdir(getDataPath(parquetDir), { recursive: true });

      console.log(`Converting ${tsvName} -> ${parquetPath}`);

      try {
        const rowCount = await convertTsvToParquet(tsvPath, parquetPath, schema);
        console.log(`  ${rowCount.toLocaleString()} rows written`);
        filesProcessed++;

        await updateQuarterProgress('13F', quarterStr, { filesProcessed });
      } catch (error) {
        console.error(`  Error converting ${tsvName}: ${error}`);
        // Continue with other files
      }
    }

    // Clean up raw files
    console.log('Cleaning up raw files...');
    await rm(getDataPath(extractDir), { recursive: true, force: true });

    // Also clean up the ZIP file
    await rm(getDataPath('raw', `${name}.zip`), { force: true });

    // Mark complete
    await updateQuarterProgress('13F', quarterStr, {
      status: 'complete',
      completedAt: new Date().toISOString(),
    });

    console.log(`Completed ${quarterStr}`);

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing ${quarterStr}: ${errorMessage}`);

    await updateQuarterProgress('13F', quarterStr, {
      status: 'failed',
      error: errorMessage,
    });

    throw error;
  }
}

async function main() {
  const options = parseArgs();

  console.log('SEC 13F Backfill Script');
  console.log('='.repeat(60));
  console.log(`Start Year: ${options.startYear}`);
  console.log(`End Year: ${options.endYear}`);
  if (options.quarter) {
    console.log(`Quarter: Q${options.quarter}`);
  }
  console.log(`Resume: ${options.resume}`);
  console.log(`Dry Run: ${options.dryRun}`);
  console.log('='.repeat(60));

  // Generate list of quarters to process
  const quarters = generateQuarters(options.startYear, options.endYear, options.quarter);
  console.log(`\nTotal quarters to process: ${quarters.length}`);

  if (options.dryRun) {
    console.log('\nQuarters:');
    for (const q of quarters) {
      console.log(`  ${q.year}-Q${q.quarter}: ${q.name}`);
    }
    return;
  }

  // Initialize or resume progress tracking
  const quarterNames = quarters.map(q => `${q.year}-Q${q.quarter}`);
  await initBackfillProgress('13F', quarterNames);

  // Check if already complete
  if (await isBackfillComplete('13F')) {
    console.log('\nBackfill already complete!');
    return;
  }

  // Process quarters
  let processed = 0;
  let failed = 0;

  for (const quarter of quarters) {
    const quarterStr = `${quarter.year}-Q${quarter.quarter}`;

    // If resuming, skip completed quarters
    if (options.resume) {
      const nextPending = await getNextPendingQuarter('13F');
      if (nextPending && nextPending !== quarterStr) {
        console.log(`Skipping ${quarterStr} (already processed)`);
        continue;
      }
    }

    try {
      await processQuarter(quarter);
      processed++;
    } catch (error) {
      failed++;
      console.error(`Failed to process ${quarterStr}`);

      // Continue with next quarter
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Backfill Summary');
  console.log('='.repeat(60));
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${quarters.length}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
