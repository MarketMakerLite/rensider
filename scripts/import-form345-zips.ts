#!/usr/bin/env npx tsx

/**
 * Import Form 3/4/5 ZIP Files into DuckDB
 *
 * Processes locally downloaded SEC Form 3/4/5 ZIP files and imports them
 * directly into the DuckDB database.
 *
 * Usage:
 *   npx tsx scripts/import-form345-zips.ts [options]
 *
 * Options:
 *   --source=PATH    Source directory containing ZIP files (default: .claude/backfill-data)
 *   --dry-run        List files without processing
 *   --stats          Show database stats after import
 */

import { readdir, mkdir, rm } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import unzipper from 'unzipper';
import {
  getForm345Stats,
  TABLE_TSV_MAPPING,
  initForm345Schema,
} from '../lib/sec/form345-db';
import { withConnection } from '../lib/sec/duckdb';

interface ImportOptions {
  sourceDir: string;
  dryRun: boolean;
  showStats: boolean;
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);

  const options: ImportOptions = {
    sourceDir: '.claude/backfill-data',
    dryRun: false,
    showStats: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--source=')) {
      options.sourceDir = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--stats') {
      options.showStats = true;
    }
  }

  return options;
}

// Parse filename like "2024q1_form345.zip" to quarter string "2024-Q1"
function parseZipFilename(filename: string): { year: number; quarter: number; quarterStr: string } | null {
  const match = filename.match(/^(\d{4})q(\d)_form345\.zip$/i);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const quarter = parseInt(match[2], 10);

  return {
    year,
    quarter,
    quarterStr: `${year}-Q${quarter}`,
  };
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

interface TableImportResult {
  table: string;
  file: string;
  rowsBefore: number;
  rowsAfter: number;
  newRows: number;
}

async function importTsvFile(
  tableName: string,
  tsvPath: string
): Promise<TableImportResult> {
  return withConnection(async (connection) => {
    // Get count before
    const beforeResult = await connection.runAndReadAll(
      `SELECT COUNT(*) as cnt FROM ${tableName}`
    );
    const rowsBefore = Number((beforeResult.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    // Import TSV directly using DuckDB's read_csv_auto
    // Use INSERT OR IGNORE to skip duplicates (based on primary key)
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

    return {
      table: tableName,
      file: tsvPath.split('/').pop() || tsvPath,
      rowsBefore,
      rowsAfter,
      newRows: rowsAfter - rowsBefore,
    };
  });
}

async function processZipFile(
  zipPath: string,
  quarterStr: string
): Promise<{ success: boolean; results: TableImportResult[] }> {
  const extractDir = join('/tmp/claude', `form345-${quarterStr}-${Date.now()}`);
  const results: TableImportResult[] = [];

  try {
    console.log(`  Extracting ZIP...`);
    await extractZip(zipPath, extractDir);

    // Import each TSV file
    for (const [tableName, tsvFile] of Object.entries(TABLE_TSV_MAPPING)) {
      const tsvPath = join(extractDir, tsvFile);

      try {
        console.log(`  Importing ${tsvFile} -> ${tableName}...`);
        const result = await importTsvFile(tableName, tsvPath);
        results.push(result);
        console.log(`    +${result.newRows.toLocaleString()} rows (total: ${result.rowsAfter.toLocaleString()})`);
      } catch (error) {
        console.error(`    Error importing ${tsvFile}: ${error}`);
      }
    }

    return { success: true, results };
  } finally {
    // Clean up extracted files
    console.log(`  Cleaning up...`);
    await rm(extractDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  const options = parseArgs();

  console.log('Import Form 3/4/5 ZIP Files');
  console.log('='.repeat(60));
  console.log(`Source: ${options.sourceDir}`);
  console.log(`Dry Run: ${options.dryRun}`);
  console.log('='.repeat(60));

  // Initialize database schema
  console.log('\nInitializing DuckDB...');
  await initForm345Schema();
  console.log('Database ready.');

  // Show initial stats
  const initialStats = await getForm345Stats();
  console.log('\nInitial database stats:');
  console.log(`  Submissions: ${initialStats.submissions.toLocaleString()}`);
  console.log(`  Reporting Owners: ${initialStats.reportingOwners.toLocaleString()}`);
  console.log(`  Non-Deriv Transactions: ${initialStats.nonderivTrans.toLocaleString()}`);
  console.log(`  Non-Deriv Holdings: ${initialStats.nonderivHolding.toLocaleString()}`);
  console.log(`  Deriv Transactions: ${initialStats.derivTrans.toLocaleString()}`);
  console.log(`  Deriv Holdings: ${initialStats.derivHolding.toLocaleString()}`);

  // List ZIP files
  const files = await readdir(options.sourceDir);
  const zipFiles = files
    .filter(f => f.toLowerCase().includes('form345') && f.endsWith('.zip'))
    .map(f => ({
      filename: f,
      path: join(options.sourceDir, f),
      ...parseZipFilename(f),
    }))
    .filter(f => f.quarterStr)
    .sort((a, b) => a.quarterStr!.localeCompare(b.quarterStr!));

  console.log(`\nFound ${zipFiles.length} Form 3/4/5 ZIP files:\n`);

  for (const zip of zipFiles) {
    console.log(`  ${zip.filename} -> ${zip.quarterStr}`);
  }

  if (options.dryRun) {
    console.log('\nDry run - no files processed.');
    return;
  }

  console.log('\nProcessing ZIP files...\n');

  let processed = 0;
  let failed = 0;
  const allResults: TableImportResult[] = [];

  for (const zip of zipFiles) {
    console.log(`\n[${processed + failed + 1}/${zipFiles.length}] Processing ${zip.quarterStr}...`);

    try {
      const { success, results } = await processZipFile(zip.path, zip.quarterStr!);
      if (success) {
        processed++;
        allResults.push(...results);
        console.log(`  ✓ Complete`);
      } else {
        failed++;
      }
    } catch (error) {
      failed++;
      console.error(`  ✗ Failed: ${error}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('Import Summary');
  console.log('='.repeat(60));
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${zipFiles.length}`);

  // Final stats
  if (options.showStats || processed > 0) {
    const finalStats = await getForm345Stats();
    console.log('\nFinal database stats:');
    console.log(`  Submissions: ${finalStats.submissions.toLocaleString()}`);
    console.log(`  Reporting Owners: ${finalStats.reportingOwners.toLocaleString()}`);
    console.log(`  Non-Deriv Transactions: ${finalStats.nonderivTrans.toLocaleString()}`);
    console.log(`  Non-Deriv Holdings: ${finalStats.nonderivHolding.toLocaleString()}`);
    console.log(`  Deriv Transactions: ${finalStats.derivTrans.toLocaleString()}`);
    console.log(`  Deriv Holdings: ${finalStats.derivHolding.toLocaleString()}`);
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
