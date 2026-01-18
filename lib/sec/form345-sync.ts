/**
 * Form 3/4/5 Sync Logic
 *
 * Shared sync logic for both script and API route.
 */

import { mkdir, rm, writeFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import unzipper from 'unzipper';
import {
  getForm345Stats,
  TABLE_TSV_MAPPING,
  initForm345Schema,
} from './form345-db';
import { withConnection } from './duckdb';
import { fetchFromSEC } from './client';

const SEC_BASE_URL = 'https://www.sec.gov/files/structureddata/data/form-345-data-sets';

export interface Form345SyncOptions {
  quarter?: string;  // Specific quarter like "2024-Q1"
  current?: boolean; // Sync current quarter
  dryRun?: boolean;  // Preview only
}

export interface Form345SyncResult {
  success: boolean;
  quarters: {
    quarterStr: string;
    success: boolean;
    newRows: number;
    error?: string;
  }[];
  totalNewRows: number;
  stats?: {
    submissions: number;
    reportingOwners: number;
    nonderivTrans: number;
    derivTrans: number;
  };
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

function getQuartersToSync(options: Form345SyncOptions): QuarterInfo[] {
  const quarters: QuarterInfo[] = [];
  const { year: currentYear, quarter: currentQuarter } = getCurrentQuarter();

  if (options.quarter) {
    // Specific quarter
    const match = options.quarter.match(/^(\d{4})-Q(\d)$/i);
    if (match) {
      quarters.push(generateQuarterUrl(parseInt(match[1]), parseInt(match[2])));
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
    const response = await fetchFromSEC(url);

    if (!response.ok) {
      console.error(`Failed to download: HTTP ${response.status}`);
      return false;
    }

    const buffer = await response.arrayBuffer();
    await writeFile(destPath, Buffer.from(buffer));
    return true;
  } catch (error) {
    console.error(`Download error: ${error}`);
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
  error?: string;
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
      return { success: false, newRows: 0, error: 'Download failed' };
    }

    // Extract ZIP
    await extractZip(zipPath, extractDir);

    // Import each TSV
    for (const [tableName, tsvFile] of Object.entries(TABLE_TSV_MAPPING)) {
      const tsvPath = join(extractDir, tsvFile);

      try {
        const newRows = await importTsvFile(tableName, tsvPath);
        totalNewRows += newRows;
      } catch (error) {
        console.error(`Error importing ${tsvFile}: ${error}`);
      }
    }

    return { success: true, newRows: totalNewRows };
  } catch (error) {
    return {
      success: false,
      newRows: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Cleanup
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * Run Form 3/4/5 sync
 */
export async function runForm345Sync(options: Form345SyncOptions = {}): Promise<Form345SyncResult> {
  console.log('[form345-sync] Starting sync...');

  // Initialize database schema
  await initForm345Schema();

  // Get quarters to sync
  const quarters = getQuartersToSync(options);
  console.log(`[form345-sync] Quarters to sync: ${quarters.map(q => q.quarterStr).join(', ')}`);

  if (options.dryRun) {
    return {
      success: true,
      quarters: quarters.map(q => ({
        quarterStr: q.quarterStr,
        success: true,
        newRows: 0,
      })),
      totalNewRows: 0,
    };
  }

  const results: Form345SyncResult['quarters'] = [];
  let totalNewRows = 0;

  for (const quarter of quarters) {
    console.log(`[form345-sync] Syncing ${quarter.quarterStr}...`);
    const result = await syncQuarter(quarter);
    results.push({
      quarterStr: quarter.quarterStr,
      ...result,
    });
    totalNewRows += result.newRows;
    console.log(`[form345-sync] ${quarter.quarterStr}: ${result.success ? 'success' : 'failed'} (+${result.newRows} rows)`);
  }

  // Get final stats
  const stats = await getForm345Stats();

  return {
    success: results.every(r => r.success),
    quarters: results,
    totalNewRows,
    stats: {
      submissions: stats.submissions,
      reportingOwners: stats.reportingOwners,
      nonderivTrans: stats.nonderivTrans,
      derivTrans: stats.derivTrans,
    },
  };
}
