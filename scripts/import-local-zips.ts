#!/usr/bin/env npx tsx

/**
 * Import Local 13F ZIP Files
 *
 * Processes locally downloaded SEC Form 13F ZIP files and converts them to Parquet.
 *
 * Usage:
 *   npx tsx scripts/import-local-zips.ts [options]
 *
 * Options:
 *   --source=PATH    Source directory containing ZIP files (default: .claude/backfill-data)
 *   --dry-run        List files without processing
 */

import { readdir, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { createReadStream } from 'fs';
import unzipper from 'unzipper';
import { convertTsvToParquet, INFOTABLE_SCHEMA, SUBMISSION_SCHEMA } from '../lib/sec/db';

const DATA_DIR = process.env.SEC_DATA_DIR || 'data';

interface ImportOptions {
  sourceDir: string;
  dryRun: boolean;
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);

  const options: ImportOptions = {
    sourceDir: '.claude/backfill-data',
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--source=')) {
      options.sourceDir = arg.split('=')[1];
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

// Parse filename like "2020q4_form13f.zip" to quarter string "2020-Q4"
function parseZipFilename(filename: string): { year: number; quarter: number; quarterStr: string } | null {
  const match = filename.match(/^(\d{4})q(\d)_form13f\.zip$/i);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const quarter = parseInt(match[2], 10);

  return {
    year,
    quarter,
    quarterStr: `${year}-Q${quarter}`,
  };
}

async function extractZip(zipPath: string, extractDir: string): Promise<string[]> {
  const files: string[] = [];

  await mkdir(extractDir, { recursive: true });

  await new Promise<void>((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(unzipper.Parse())
      .on('entry', async (entry: unzipper.Entry) => {
        const fileName = entry.path;
        const filePath = join(extractDir, fileName);

        if (entry.type === 'File') {
          files.push(fileName);
          entry.pipe(createReadStream(filePath).on('error', () => {}));
          await new Promise<void>((res) => {
            const writeStream = require('fs').createWriteStream(filePath);
            entry.pipe(writeStream);
            writeStream.on('finish', res);
            writeStream.on('error', reject);
          });
        } else {
          entry.autodrain();
        }
      })
      .on('close', resolve)
      .on('error', reject);
  });

  return files;
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

async function processZipFile(zipPath: string, quarterStr: string): Promise<void> {
  // Use absolute paths to avoid DATA_DIR doubling in convertTsvToParquet
  const cwd = process.cwd();
  const extractDir = join(cwd, DATA_DIR, '13f', 'raw', quarterStr);

  console.log(`  Extracting ZIP...`);

  await mkdir(extractDir, { recursive: true });

  // Extract ZIP
  await new Promise<void>((resolve, reject) => {
    createReadStream(zipPath)
      .pipe(unzipper.Extract({ path: extractDir }))
      .on('close', resolve)
      .on('error', reject);
  });

  // Convert TSV files to Parquet
  // Use absolute paths so convertTsvToParquet doesn't add DATA_DIR prefix
  for (const { name: tsvName, outName, schema } of TSV_FILES) {
    const tsvPath = join(cwd, DATA_DIR, '13f', 'raw', quarterStr, tsvName);
    const parquetDir = join(cwd, DATA_DIR, '13f', outName);
    const parquetPath = join(cwd, DATA_DIR, '13f', outName, `${quarterStr}.parquet`);

    await mkdir(parquetDir, { recursive: true });

    console.log(`  Converting ${tsvName} -> ${outName}/${quarterStr}.parquet`);

    try {
      const rowCount = await convertTsvToParquet(tsvPath, parquetPath, schema);
      console.log(`    ${rowCount.toLocaleString()} rows written`);
    } catch (error) {
      console.error(`    Error: ${error}`);
    }
  }

  // Clean up extracted files
  console.log(`  Cleaning up...`);
  await rm(extractDir, { recursive: true, force: true });
}

async function main() {
  const options = parseArgs();

  console.log('Import Local 13F ZIP Files');
  console.log('='.repeat(60));
  console.log(`Source: ${options.sourceDir}`);
  console.log(`Dry Run: ${options.dryRun}`);
  console.log('='.repeat(60));

  // List ZIP files
  const files = await readdir(options.sourceDir);
  const zipFiles = files
    .filter(f => f.endsWith('.zip'))
    .map(f => ({
      filename: f,
      path: join(options.sourceDir, f),
      ...parseZipFilename(f),
    }))
    .filter(f => f.quarterStr)
    .sort((a, b) => a.quarterStr!.localeCompare(b.quarterStr!));

  console.log(`\nFound ${zipFiles.length} ZIP files:\n`);

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

  for (const zip of zipFiles) {
    console.log(`\n[${processed + failed + 1}/${zipFiles.length}] Processing ${zip.quarterStr}...`);

    try {
      await processZipFile(zip.path, zip.quarterStr!);
      processed++;
      console.log(`  ✓ Complete`);
    } catch (error) {
      failed++;
      console.error(`  ✗ Failed: ${error}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('Import Summary');
  console.log('='.repeat(60));
  console.log(`Processed: ${processed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${zipFiles.length}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
