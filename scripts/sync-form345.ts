#!/usr/bin/env npx tsx

/**
 * Sync Form 3/4/5 Data from SEC EDGAR
 *
 * Downloads and imports new Form 3/4/5 quarterly data from SEC EDGAR.
 * Can be run manually or via cron job.
 *
 * Usage:
 *   npx tsx scripts/sync-form345.ts [options]
 *
 * Options:
 *   --quarter=YYYY-QN   Sync specific quarter (e.g., 2024-Q1)
 *   --current           Sync only the current quarter
 *   --all               Sync all available quarters (2022-Q1 onwards)
 *   --dry-run           Show what would be downloaded without downloading
 */

import 'dotenv/config';
import { mkdir, rm, writeFile } from 'fs/promises';
import { createReadStream, createWriteStream } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import unzipper from 'unzipper';
import {
  getForm345Stats,
  TABLE_TSV_MAPPING,
  initForm345Schema,
} from '../lib/sec/form345-db';
import { withConnection } from '../lib/sec/duckdb';
import { fetchFromSEC } from '../lib/sec/client';

const SEC_BASE_URL = 'https://www.sec.gov/files/structureddata/data/form-345-data-sets';

interface SyncOptions {
  quarter?: string;
  current: boolean;
  all: boolean;
  dryRun: boolean;
}

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);

  const options: SyncOptions = {
    current: false,
    all: false,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--quarter=')) {
      options.quarter = arg.split('=')[1];
    } else if (arg === '--current') {
      options.current = true;
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

interface QuarterInfo {
  year: number;
  quarter: number;
  quarterStr: string;
  zipUrl: string;
  zipFilename: string;
}

function getCurrentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return { year, quarter };
}

function generateQuarterUrl(year: number, quarter: number): QuarterInfo {
  const quarterStr = `${year}-Q${quarter}`;
  const zipFilename = `${year}q${quarter}_form345.zip`;
  const zipUrl = `${SEC_BASE_URL}/${zipFilename}`;

  return {
    year,
    quarter,
    quarterStr,
    zipUrl,
    zipFilename,
  };
}

function getQuartersToSync(options: SyncOptions): QuarterInfo[] {
  const quarters: QuarterInfo[] = [];
  const { year: currentYear, quarter: currentQuarter } = getCurrentQuarter();

  if (options.quarter) {
    // Specific quarter
    const match = options.quarter.match(/^(\d{4})-Q(\d)$/i);
    if (match) {
      quarters.push(generateQuarterUrl(parseInt(match[1]), parseInt(match[2])));
    }
  } else if (options.current) {
    // Current quarter only
    quarters.push(generateQuarterUrl(currentYear, currentQuarter));
  } else if (options.all) {
    // All quarters from 2022-Q1 to current
    for (let year = 2022; year <= currentYear; year++) {
      for (let q = 1; q <= 4; q++) {
        if (year === currentYear && q > currentQuarter) break;
        quarters.push(generateQuarterUrl(year, q));
      }
    }
  } else {
    // Default: current and previous quarter
    quarters.push(generateQuarterUrl(currentYear, currentQuarter));

    let prevYear = currentYear;
    let prevQuarter = currentQuarter - 1;
    if (prevQuarter === 0) {
      prevYear--;
      prevQuarter = 4;
    }
    quarters.push(generateQuarterUrl(prevYear, prevQuarter));
  }

  return quarters;
}

async function downloadZip(url: string, destPath: string): Promise<boolean> {
  try {
    console.log(`  Downloading from ${url}...`);
    const response = await fetchFromSEC(url);

    if (!response.ok) {
      console.error(`  Failed to download: HTTP ${response.status}`);
      return false;
    }

    const buffer = await response.arrayBuffer();
    await writeFile(destPath, Buffer.from(buffer));
    console.log(`  Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
    return true;
  } catch (error) {
    console.error(`  Download error: ${error}`);
    return false;
  }
}

async function extractZip(zipPath: string, extractDir: string): Promise<void> {
  await mkdir(extractDir, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: extractDir }))
      .on('close', resolve)
      .on('error', reject);
  });
}

async function importTsvFile(
  tableName: string,
  tsvPath: string
): Promise<number> {
  return withConnection(async (connection) => {
    // Get count before
    const beforeResult = await connection.runAndReadAll(
      `SELECT COUNT(*) as cnt FROM ${tableName}`
    );
    const rowsBefore = Number((beforeResult.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    // Import TSV using DuckDB's read_csv_auto
    await connection.run(`
      INSERT OR IGNORE INTO ${tableName}
      SELECT * FROM read_csv_auto('${tsvPath}',
        delim='\\t',
        header=true,
        ignore_errors=true,
        all_varchar=false,
        auto_detect=true
      )
    `);

    // Get count after
    const afterResult = await connection.runAndReadAll(
      `SELECT COUNT(*) as cnt FROM ${tableName}`
    );
    const rowsAfter = Number((afterResult.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    return rowsAfter - rowsBefore;
  });
}

async function syncQuarter(quarter: QuarterInfo): Promise<{
  success: boolean;
  newRows: number;
}> {
  const tempDir = join('/tmp/claude', `form345-sync-${quarter.quarterStr}-${Date.now()}`);
  const zipPath = join(tempDir, quarter.zipFilename);
  const extractDir = join(tempDir, 'extracted');

  let totalNewRows = 0;

  try {
    await mkdir(tempDir, { recursive: true });

    // Download ZIP
    const downloaded = await downloadZip(quarter.zipUrl, zipPath);
    if (!downloaded) {
      return { success: false, newRows: 0 };
    }

    // Extract ZIP
    console.log(`  Extracting...`);
    await extractZip(zipPath, extractDir);

    // Import each TSV
    for (const [tableName, tsvFile] of Object.entries(TABLE_TSV_MAPPING)) {
      const tsvPath = join(extractDir, tsvFile);

      try {
        console.log(`  Importing ${tsvFile}...`);
        const newRows = await importTsvFile(tableName, tsvPath);
        totalNewRows += newRows;
        console.log(`    +${newRows.toLocaleString()} new rows`);
      } catch (error) {
        console.error(`    Error: ${error}`);
      }
    }

    return { success: true, newRows: totalNewRows };
  } finally {
    // Cleanup
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  const options = parseArgs();

  console.log('Sync Form 3/4/5 Data from SEC EDGAR');
  console.log('='.repeat(60));

  // Initialize database schema
  console.log('Initializing DuckDB...');
  await initForm345Schema();

  // Get quarters to sync
  const quarters = getQuartersToSync(options);

  console.log(`\nQuarters to sync: ${quarters.length}`);
  for (const q of quarters) {
    console.log(`  ${q.quarterStr}: ${q.zipUrl}`);
  }

  if (options.dryRun) {
    console.log('\nDry run - no data downloaded.');
    return;
  }

  console.log('\nStarting sync...\n');

  let synced = 0;
  let failed = 0;
  let totalNewRows = 0;

  for (const quarter of quarters) {
    console.log(`\n[${synced + failed + 1}/${quarters.length}] Syncing ${quarter.quarterStr}...`);

    try {
      const result = await syncQuarter(quarter);
      if (result.success) {
        synced++;
        totalNewRows += result.newRows;
        console.log(`  ✓ Complete (+${result.newRows.toLocaleString()} rows)`);
      } else {
        failed++;
        console.log(`  ✗ Failed`);
      }
    } catch (error) {
      failed++;
      console.error(`  ✗ Error: ${error}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Sync Summary');
  console.log('='.repeat(60));
  console.log(`Synced: ${synced}`);
  console.log(`Failed: ${failed}`);
  console.log(`New rows: ${totalNewRows.toLocaleString()}`);

  // Final stats
  const stats = await getForm345Stats();
  console.log('\nDatabase totals:');
  console.log(`  Submissions: ${stats.submissions.toLocaleString()}`);
  console.log(`  Reporting Owners: ${stats.reportingOwners.toLocaleString()}`);
  console.log(`  Non-Deriv Transactions: ${stats.nonderivTrans.toLocaleString()}`);
  console.log(`  Deriv Transactions: ${stats.derivTrans.toLocaleString()}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
