#!/usr/bin/env npx tsx
/**
 * Import NEW 13F Data (2025+) to MotherDuck
 *
 * Only imports files that contain data newer than what's already in the database.
 */

import { DuckDBInstance } from '@duckdb/node-api';
import { readdir, mkdir, rm } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import unzipper from 'unzipper';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';
const BACKFILL_DIR = '.claude/backfill-data';

// Only import files from Dec 2024 onwards (to get new data)
const FILES_TO_IMPORT = [
  '01dec2024-28feb2025_form13f.zip',
  '01mar2025-31may2025_form13f.zip',
  '01jun2025-31aug2025_form13f.zip',
  '01sep2025-30nov2025_form13f.zip',
];

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
  const entries = await readdir(extractDir, { withFileTypes: true });
  if (entries.some(e => e.name === 'SUBMISSION.tsv')) {
    return extractDir;
  }
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

    const tsvDir = await findTsvDir(tempDir);

    // Import SUBMISSION.tsv
    const submissionPath = join(tsvDir, 'SUBMISSION.tsv');
    console.log(`   Importing submissions...`);

    const subBefore = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM submissions_13f`);
    const subCountBefore = Number((subBefore.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    await conn.run(`
      CREATE TEMP TABLE IF NOT EXISTS temp_submissions AS
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

    await conn.run(`DROP TABLE IF EXISTS temp_submissions`);

    const subAfter = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM submissions_13f`);
    const subCountAfter = Number((subAfter.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);
    const newSubmissions = subCountAfter - subCountBefore;

    // Import INFOTABLE.tsv (holdings)
    const infotablePath = join(tsvDir, 'INFOTABLE.tsv');
    console.log(`   Importing holdings...`);

    const holdBefore = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM holdings_13f`);
    const holdCountBefore = Number((holdBefore.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    await conn.run(`
      CREATE TEMP TABLE IF NOT EXISTS temp_holdings AS
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

    await conn.run(`DROP TABLE IF EXISTS temp_holdings`);

    const holdAfter = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM holdings_13f`);
    const holdCountAfter = Number((holdAfter.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);
    const newHoldings = holdCountAfter - holdCountBefore;

    return { submissions: newSubmissions, holdings: newHoldings };

  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  console.log('📊 Import NEW 13F Data (2025+) to MotherDuck');
  console.log('='.repeat(50));
  console.log(`Files to import: ${FILES_TO_IMPORT.length}\n`);

  for (const f of FILES_TO_IMPORT) {
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

    for (const zipFile of FILES_TO_IMPORT) {
      console.log(`\n📁 [${processed + 1}/${FILES_TO_IMPORT.length}] ${zipFile}`);

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
    console.log(`Processed: ${processed}/${FILES_TO_IMPORT.length} files`);
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