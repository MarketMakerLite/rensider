#!/usr/bin/env npx tsx
/**
 * Import 13F Backfill Data to MotherDuck
 *
 * Imports all 13F ZIP files from backfill-data folder into MotherDuck.
 * Handles both quarterly format (2024q1_form13f.zip) and date range format
 * (01jan2024-29feb2024_form13f.zip).
 *
 * Usage:
 *   MOTHERDUCK_TOKEN=your_token npx tsx scripts/import-13f-backfill.ts
 */

import { DuckDBInstance } from '@duckdb/node-api';
import { readdir, mkdir, rm } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import unzipper from 'unzipper';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';
const BACKFILL_DIR = '.claude/backfill-data';

if (!MOTHERDUCK_TOKEN) {
  console.error('Error: MOTHERDUCK_TOKEN required');
  process.exit(1);
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

async function findTsvDir(extractDir: string): Promise<string> {
  // Check if TSV files are directly in extractDir or in a subdirectory
  const entries = await readdir(extractDir, { withFileTypes: true });

  // Check if SUBMISSION.tsv exists directly
  if (entries.some(e => e.name === 'SUBMISSION.tsv')) {
    return extractDir;
  }

  // Look for subdirectory containing TSV files
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const subEntries = await readdir(join(extractDir, entry.name));
      if (subEntries.includes('SUBMISSION.tsv')) {
        return join(extractDir, entry.name);
      }
    }
  }

  throw new Error('Could not find SUBMISSION.tsv in extracted files');
}

async function importZipFile(
  conn: Awaited<ReturnType<DuckDBInstance['connect']>>,
  zipPath: string,
  zipName: string
): Promise<{ submissions: number; holdings: number }> {
  const tempDir = join('/tmp/claude', `13f-import-${Date.now()}`);

  try {
    console.log(`   Extracting...`);
    await extractZip(zipPath, tempDir);

    // Find the directory containing TSV files (may be in a subdirectory)
    const tsvDir = await findTsvDir(tempDir);

    // Import SUBMISSION.tsv
    const submissionPath = join(tsvDir, 'SUBMISSION.tsv');
    console.log(`   Importing submissions...`);

    const subBefore = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM submissions_13f`);
    const subCountBefore = Number((subBefore.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    // Use a temp table and merge to handle duplicates
    await conn.run(`
      CREATE TEMP TABLE temp_submissions AS
      SELECT
        ACCESSION_NUMBER,
        CIK,
        SUBMISSIONTYPE,
        PERIODOFREPORT,
        FILING_DATE
      FROM read_csv_auto('${submissionPath}',
        delim='\\t',
        header=true,
        ignore_errors=true
      )
    `);

    await conn.run(`
      INSERT INTO submissions_13f (ACCESSION_NUMBER, CIK, SUBMISSIONTYPE, PERIODOFREPORT, FILING_DATE)
      SELECT t.ACCESSION_NUMBER, t.CIK, t.SUBMISSIONTYPE, t.PERIODOFREPORT, t.FILING_DATE
      FROM temp_submissions t
      WHERE NOT EXISTS (
        SELECT 1 FROM submissions_13f s
        WHERE s.ACCESSION_NUMBER = t.ACCESSION_NUMBER
      )
    `);

    await conn.run(`DROP TABLE temp_submissions`);

    const subAfter = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM submissions_13f`);
    const subCountAfter = Number((subAfter.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);
    const newSubmissions = subCountAfter - subCountBefore;

    // Import INFOTABLE.tsv (holdings)
    const infotablePath = join(tsvDir, 'INFOTABLE.tsv');
    console.log(`   Importing holdings...`);

    const holdBefore = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM holdings_13f`);
    const holdCountBefore = Number((holdBefore.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    // Use a temp table and merge to handle duplicates
    await conn.run(`
      CREATE TEMP TABLE temp_holdings AS
      SELECT
        INFOTABLE_SK,
        ACCESSION_NUMBER,
        CUSIP,
        NAMEOFISSUER,
        TITLEOFCLASS,
        VALUE,
        SSHPRNAMT,
        SSHPRNAMTTYPE,
        PUTCALL,
        INVESTMENTDISCRETION,
        OTHERMANAGER,
        VOTING_AUTH_SOLE,
        VOTING_AUTH_SHARED,
        VOTING_AUTH_NONE
      FROM read_csv_auto('${infotablePath}',
        delim='\\t',
        header=true,
        ignore_errors=true
      )
    `);

    await conn.run(`
      INSERT INTO holdings_13f (INFOTABLE_SK, ACCESSION_NUMBER, CUSIP, NAMEOFISSUER, TITLEOFCLASS, VALUE, SSHPRNAMT, SSHPRNAMTTYPE, PUTCALL, INVESTMENTDISCRETION, OTHERMANAGER, VOTING_AUTH_SOLE, VOTING_AUTH_SHARED, VOTING_AUTH_NONE)
      SELECT t.*
      FROM temp_holdings t
      WHERE NOT EXISTS (
        SELECT 1 FROM holdings_13f h
        WHERE h.INFOTABLE_SK = t.INFOTABLE_SK
      )
    `);

    await conn.run(`DROP TABLE temp_holdings`);

    const holdAfter = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM holdings_13f`);
    const holdCountAfter = Number((holdAfter.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);
    const newHoldings = holdCountAfter - holdCountBefore;

    return { submissions: newSubmissions, holdings: newHoldings };

  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  console.log('📊 Import 13F Backfill Data to MotherDuck');
  console.log('='.repeat(50));

  // Find all 13F ZIP files
  const files = await readdir(BACKFILL_DIR);
  const zipFiles = files
    .filter(f => f.includes('form13f') && f.endsWith('.zip'))
    .sort();

  console.log(`Found ${zipFiles.length} 13F ZIP files:\n`);
  for (const f of zipFiles) {
    console.log(`  ${f}`);
  }

  console.log('\n🔗 Connecting to MotherDuck...');
  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();

  try {
    await conn.run("INSTALL 'motherduck'");
    await conn.run("LOAD 'motherduck'");
    await conn.run(`SET motherduck_token='${MOTHERDUCK_TOKEN}'`);
    await conn.run(`ATTACH 'md:${MOTHERDUCK_DATABASE}'`);
    await conn.run(`USE ${MOTHERDUCK_DATABASE}`);
    console.log('✅ Connected\n');

    let totalSubmissions = 0;
    let totalHoldings = 0;
    let processed = 0;

    for (const zipFile of zipFiles) {
      console.log(`\n📁 [${processed + 1}/${zipFiles.length}] ${zipFile}`);

      try {
        const result = await importZipFile(
          conn,
          join(BACKFILL_DIR, zipFile),
          zipFile
        );

        totalSubmissions += result.submissions;
        totalHoldings += result.holdings;
        processed++;

        console.log(`   ✅ +${result.submissions.toLocaleString()} submissions, +${result.holdings.toLocaleString()} holdings`);
      } catch (error) {
        console.log(`   ⚠️ Error: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Final stats
    console.log('\n' + '='.repeat(50));
    console.log('Import Summary');
    console.log('='.repeat(50));
    console.log(`Processed: ${processed}/${zipFiles.length} files`);
    console.log(`New submissions: ${totalSubmissions.toLocaleString()}`);
    console.log(`New holdings: ${totalHoldings.toLocaleString()}`);

    // Show latest filing date
    const latest = await conn.runAndReadAll(`
      SELECT MAX(FILING_DATE) as latest FROM submissions_13f
    `);
    console.log(`\nLatest filing date: ${(latest.getRowObjects() as { latest: string }[])[0]?.latest}`);

    // Show total counts
    const totalSub = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM submissions_13f`);
    const totalHold = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM holdings_13f`);
    console.log(`Total submissions: ${Number((totalSub.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0).toLocaleString()}`);
    console.log(`Total holdings: ${Number((totalHold.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0).toLocaleString()}`);

  } finally {
    conn.closeSync();
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
