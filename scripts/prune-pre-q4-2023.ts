#!/usr/bin/env npx tsx
/**
 * Prune Pre-Q4 2023 Data from MotherDuck
 *
 * Removes all data where date < 2023-10-01 (keeps Q4 2023 onwards).
 * This includes 13F submissions/holdings, 13D/G filings, and Form 3/4/5 data.
 *
 * Usage:
 *   npx tsx scripts/prune-pre-q4-2023.ts --dry-run
 *   npx tsx scripts/prune-pre-q4-2023.ts
 *   npx tsx scripts/prune-pre-q4-2023.ts --include-caches
 */

import 'dotenv/config';
import { DuckDBInstance } from '@duckdb/node-api';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';
const DRY_RUN = process.argv.includes('--dry-run');
const INCLUDE_CACHES = process.argv.includes('--include-caches');

if (!MOTHERDUCK_TOKEN) {
  console.error('Error: MOTHERDUCK_TOKEN required');
  process.exit(1);
}

interface TableCount {
  table: string;
  before: number;
  after: number;
  deleted: number;
}

async function main() {
  console.log('🗑️  Prune Pre-Q4 2023 Data from MotherDuck');
  console.log('='.repeat(60));
  console.log('Cutoff: Delete all data where date < 2023-10-01');
  console.log('');
  if (DRY_RUN) {
    console.log('⚠️  DRY RUN MODE - No data will be deleted\n');
  }
  if (INCLUDE_CACHES) {
    console.log('📦 Including cache tables (cusip_mappings, filer_names)\n');
  }

  console.log('🔗 Connecting to MotherDuck...');
  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();

  const counts: TableCount[] = [];

  try {
    await conn.run("INSTALL 'motherduck'");
    await conn.run("LOAD 'motherduck'");
    await conn.run(`SET motherduck_token='${MOTHERDUCK_TOKEN}'`);
    await conn.run(`ATTACH 'md:${MOTHERDUCK_DATABASE}'`);
    await conn.run(`USE ${MOTHERDUCK_DATABASE}`);
    console.log('✅ Connected\n');

    // Helper to get count
    async function getCount(table: string): Promise<number> {
      try {
        const result = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM ${table}`);
        return Number((result.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);
      } catch {
        return 0;
      }
    }

    // Helper to get count with condition
    async function getCountWhere(sql: string): Promise<number> {
      try {
        const result = await conn.runAndReadAll(sql);
        return Number((result.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);
      } catch {
        return 0;
      }
    }

    // ========================================
    // BEFORE COUNTS
    // ========================================
    console.log('📊 Gathering current data counts...\n');

    const tables = [
      'submissions_13f',
      'holdings_13f',
      'filings_13dg',
      'reporting_persons_13dg',
      'form345_submissions',
      'form345_reporting_owners',
      'form345_nonderiv_trans',
      'form345_nonderiv_holding',
      'form345_deriv_trans',
      'form345_deriv_holding',
    ];

    if (INCLUDE_CACHES) {
      tables.push('cusip_mappings', 'filer_names');
    }

    const beforeCounts: Record<string, number> = {};
    for (const table of tables) {
      beforeCounts[table] = await getCount(table);
    }

    console.log('Current row counts:');
    for (const table of tables) {
      console.log(`  ${table}: ${beforeCounts[table].toLocaleString()}`);
    }

    // ========================================
    // COUNT RECORDS TO DELETE
    // ========================================
    console.log('\n📋 Counting records to delete (pre-Q4 2023)...\n');

    // submissions_13f: PERIODOFREPORT format is DD-MMM-YYYY (e.g., "30-SEP-2023")
    const sub13fToDelete = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM submissions_13f
      WHERE PERIODOFREPORT LIKE '%-2020'
         OR PERIODOFREPORT LIKE '%-2021'
         OR PERIODOFREPORT LIKE '%-2022'
         OR (PERIODOFREPORT LIKE '%-2023' AND (
              PERIODOFREPORT LIKE '__-JAN-%' OR PERIODOFREPORT LIKE '__-FEB-%' OR
              PERIODOFREPORT LIKE '__-MAR-%' OR PERIODOFREPORT LIKE '__-APR-%' OR
              PERIODOFREPORT LIKE '__-MAY-%' OR PERIODOFREPORT LIKE '__-JUN-%' OR
              PERIODOFREPORT LIKE '__-JUL-%' OR PERIODOFREPORT LIKE '__-AUG-%' OR
              PERIODOFREPORT LIKE '__-SEP-%'))
    `);

    // holdings_13f linked via ACCESSION_NUMBER
    const hold13fToDelete = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM holdings_13f h
      WHERE EXISTS (
        SELECT 1 FROM submissions_13f s
        WHERE s.ACCESSION_NUMBER = h.ACCESSION_NUMBER
        AND (
          s.PERIODOFREPORT LIKE '%-2020'
          OR s.PERIODOFREPORT LIKE '%-2021'
          OR s.PERIODOFREPORT LIKE '%-2022'
          OR (s.PERIODOFREPORT LIKE '%-2023' AND (
              s.PERIODOFREPORT LIKE '__-JAN-%' OR s.PERIODOFREPORT LIKE '__-FEB-%' OR
              s.PERIODOFREPORT LIKE '__-MAR-%' OR s.PERIODOFREPORT LIKE '__-APR-%' OR
              s.PERIODOFREPORT LIKE '__-MAY-%' OR s.PERIODOFREPORT LIKE '__-JUN-%' OR
              s.PERIODOFREPORT LIKE '__-JUL-%' OR s.PERIODOFREPORT LIKE '__-AUG-%' OR
              s.PERIODOFREPORT LIKE '__-SEP-%'))
        )
      )
    `);

    // filings_13dg: FILING_DATE format is YYYY-MM-DD
    const filings13dgToDelete = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM filings_13dg WHERE FILING_DATE < '2023-10-01'
    `);

    // reporting_persons_13dg linked via ACCESSION_NUMBER
    const rp13dgToDelete = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM reporting_persons_13dg rp
      WHERE EXISTS (
        SELECT 1 FROM filings_13dg f
        WHERE f.ACCESSION_NUMBER = rp.ACCESSION_NUMBER
        AND f.FILING_DATE < '2023-10-01'
      )
    `);

    // form345_submissions: FILING_DATE format is YYYY-MM-DD
    const form345SubToDelete = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM form345_submissions WHERE FILING_DATE < '2023-10-01'
    `);

    // form345 child tables linked via ACCESSION_NUMBER
    const form345OwnersToDelete = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM form345_reporting_owners o
      WHERE EXISTS (
        SELECT 1 FROM form345_submissions s
        WHERE s.ACCESSION_NUMBER = o.ACCESSION_NUMBER
        AND s.FILING_DATE < '2023-10-01'
      )
    `);

    const form345NdTransToDelete = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM form345_nonderiv_trans t
      WHERE EXISTS (
        SELECT 1 FROM form345_submissions s
        WHERE s.ACCESSION_NUMBER = t.ACCESSION_NUMBER
        AND s.FILING_DATE < '2023-10-01'
      )
    `);

    const form345NdHoldToDelete = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM form345_nonderiv_holding h
      WHERE EXISTS (
        SELECT 1 FROM form345_submissions s
        WHERE s.ACCESSION_NUMBER = h.ACCESSION_NUMBER
        AND s.FILING_DATE < '2023-10-01'
      )
    `);

    const form345DTransToDelete = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM form345_deriv_trans t
      WHERE EXISTS (
        SELECT 1 FROM form345_submissions s
        WHERE s.ACCESSION_NUMBER = t.ACCESSION_NUMBER
        AND s.FILING_DATE < '2023-10-01'
      )
    `);

    const form345DHoldToDelete = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM form345_deriv_holding h
      WHERE EXISTS (
        SELECT 1 FROM form345_submissions s
        WHERE s.ACCESSION_NUMBER = h.ACCESSION_NUMBER
        AND s.FILING_DATE < '2023-10-01'
      )
    `);

    // Cache tables
    let cusipToDelete = 0;
    let filerToDelete = 0;
    if (INCLUDE_CACHES) {
      cusipToDelete = await getCountWhere(`
        SELECT COUNT(*) as cnt FROM cusip_mappings WHERE cached_at < '2023-10-01'
      `);
      filerToDelete = await getCountWhere(`
        SELECT COUNT(*) as cnt FROM filer_names WHERE cached_at < '2023-10-01'
      `);
    }

    console.log('Records to delete:');
    console.log(`  submissions_13f: ${sub13fToDelete.toLocaleString()}`);
    console.log(`  holdings_13f: ${hold13fToDelete.toLocaleString()}`);
    console.log(`  filings_13dg: ${filings13dgToDelete.toLocaleString()}`);
    console.log(`  reporting_persons_13dg: ${rp13dgToDelete.toLocaleString()}`);
    console.log(`  form345_submissions: ${form345SubToDelete.toLocaleString()}`);
    console.log(`  form345_reporting_owners: ${form345OwnersToDelete.toLocaleString()}`);
    console.log(`  form345_nonderiv_trans: ${form345NdTransToDelete.toLocaleString()}`);
    console.log(`  form345_nonderiv_holding: ${form345NdHoldToDelete.toLocaleString()}`);
    console.log(`  form345_deriv_trans: ${form345DTransToDelete.toLocaleString()}`);
    console.log(`  form345_deriv_holding: ${form345DHoldToDelete.toLocaleString()}`);
    if (INCLUDE_CACHES) {
      console.log(`  cusip_mappings: ${cusipToDelete.toLocaleString()}`);
      console.log(`  filer_names: ${filerToDelete.toLocaleString()}`);
    }

    const totalToDelete =
      sub13fToDelete + hold13fToDelete + filings13dgToDelete + rp13dgToDelete +
      form345SubToDelete + form345OwnersToDelete + form345NdTransToDelete +
      form345NdHoldToDelete + form345DTransToDelete + form345DHoldToDelete +
      cusipToDelete + filerToDelete;

    console.log(`\n  TOTAL: ${totalToDelete.toLocaleString()} rows`);

    if (totalToDelete === 0) {
      console.log('\n✅ No pre-Q4 2023 data found. Nothing to delete.');
      return;
    }

    // ========================================
    // DRY RUN: Show sample data
    // ========================================
    if (DRY_RUN) {
      console.log('\n🔍 Dry run - showing sample of data that would be deleted:\n');

      if (sub13fToDelete > 0) {
        console.log('Sample submissions_13f to delete:');
        const sample = await conn.runAndReadAll(`
          SELECT ACCESSION_NUMBER, CIK, PERIODOFREPORT, FILING_DATE
          FROM submissions_13f
          WHERE PERIODOFREPORT LIKE '%-2020'
             OR PERIODOFREPORT LIKE '%-2021'
             OR PERIODOFREPORT LIKE '%-2022'
             OR (PERIODOFREPORT LIKE '%-2023' AND (
                  PERIODOFREPORT LIKE '__-JAN-%' OR PERIODOFREPORT LIKE '__-FEB-%' OR
                  PERIODOFREPORT LIKE '__-MAR-%' OR PERIODOFREPORT LIKE '__-APR-%' OR
                  PERIODOFREPORT LIKE '__-MAY-%' OR PERIODOFREPORT LIKE '__-JUN-%' OR
                  PERIODOFREPORT LIKE '__-JUL-%' OR PERIODOFREPORT LIKE '__-AUG-%' OR
                  PERIODOFREPORT LIKE '__-SEP-%'))
          LIMIT 5
        `);
        console.log(sample.getRowObjects());
      }

      if (filings13dgToDelete > 0) {
        console.log('\nSample filings_13dg to delete:');
        const sample = await conn.runAndReadAll(`
          SELECT ACCESSION_NUMBER, FORM_TYPE, FILING_DATE, FILED_BY_NAME
          FROM filings_13dg
          WHERE FILING_DATE < '2023-10-01'
          LIMIT 5
        `);
        console.log(sample.getRowObjects());
      }

      if (form345SubToDelete > 0) {
        console.log('\nSample form345_submissions to delete:');
        const sample = await conn.runAndReadAll(`
          SELECT ACCESSION_NUMBER, DOCUMENT_TYPE, FILING_DATE, ISSUERNAME
          FROM form345_submissions
          WHERE FILING_DATE < '2023-10-01'
          LIMIT 5
        `);
        console.log(sample.getRowObjects());
      }

      console.log('\n⚠️  Run without --dry-run to actually delete data.');
      return;
    }

    // ========================================
    // EXECUTE DELETIONS (children before parents)
    // ========================================
    console.log('\n🗑️  Deleting pre-Q4 2023 data...\n');

    // 1. holdings_13f (child of submissions_13f)
    console.log('   [1/10] Deleting holdings_13f...');
    await conn.run(`
      DELETE FROM holdings_13f
      WHERE ACCESSION_NUMBER IN (
        SELECT ACCESSION_NUMBER FROM submissions_13f
        WHERE PERIODOFREPORT LIKE '%-2020'
           OR PERIODOFREPORT LIKE '%-2021'
           OR PERIODOFREPORT LIKE '%-2022'
           OR (PERIODOFREPORT LIKE '%-2023' AND (
                PERIODOFREPORT LIKE '__-JAN-%' OR PERIODOFREPORT LIKE '__-FEB-%' OR
                PERIODOFREPORT LIKE '__-MAR-%' OR PERIODOFREPORT LIKE '__-APR-%' OR
                PERIODOFREPORT LIKE '__-MAY-%' OR PERIODOFREPORT LIKE '__-JUN-%' OR
                PERIODOFREPORT LIKE '__-JUL-%' OR PERIODOFREPORT LIKE '__-AUG-%' OR
                PERIODOFREPORT LIKE '__-SEP-%'))
      )
    `);

    // 2. submissions_13f (parent)
    console.log('   [2/10] Deleting submissions_13f...');
    await conn.run(`
      DELETE FROM submissions_13f
      WHERE PERIODOFREPORT LIKE '%-2020'
         OR PERIODOFREPORT LIKE '%-2021'
         OR PERIODOFREPORT LIKE '%-2022'
         OR (PERIODOFREPORT LIKE '%-2023' AND (
              PERIODOFREPORT LIKE '__-JAN-%' OR PERIODOFREPORT LIKE '__-FEB-%' OR
              PERIODOFREPORT LIKE '__-MAR-%' OR PERIODOFREPORT LIKE '__-APR-%' OR
              PERIODOFREPORT LIKE '__-MAY-%' OR PERIODOFREPORT LIKE '__-JUN-%' OR
              PERIODOFREPORT LIKE '__-JUL-%' OR PERIODOFREPORT LIKE '__-AUG-%' OR
              PERIODOFREPORT LIKE '__-SEP-%'))
    `);

    // 3. reporting_persons_13dg (child of filings_13dg)
    console.log('   [3/10] Deleting reporting_persons_13dg...');
    await conn.run(`
      DELETE FROM reporting_persons_13dg
      WHERE ACCESSION_NUMBER IN (
        SELECT ACCESSION_NUMBER FROM filings_13dg
        WHERE FILING_DATE < '2023-10-01'
      )
    `);

    // 4. filings_13dg (parent)
    console.log('   [4/10] Deleting filings_13dg...');
    await conn.run(`
      DELETE FROM filings_13dg WHERE FILING_DATE < '2023-10-01'
    `);

    // 5-9. form345 child tables
    console.log('   [5/10] Deleting form345_reporting_owners...');
    await conn.run(`
      DELETE FROM form345_reporting_owners
      WHERE ACCESSION_NUMBER IN (
        SELECT ACCESSION_NUMBER FROM form345_submissions
        WHERE FILING_DATE < '2023-10-01'
      )
    `);

    console.log('   [6/10] Deleting form345_nonderiv_trans...');
    await conn.run(`
      DELETE FROM form345_nonderiv_trans
      WHERE ACCESSION_NUMBER IN (
        SELECT ACCESSION_NUMBER FROM form345_submissions
        WHERE FILING_DATE < '2023-10-01'
      )
    `);

    console.log('   [7/10] Deleting form345_nonderiv_holding...');
    await conn.run(`
      DELETE FROM form345_nonderiv_holding
      WHERE ACCESSION_NUMBER IN (
        SELECT ACCESSION_NUMBER FROM form345_submissions
        WHERE FILING_DATE < '2023-10-01'
      )
    `);

    console.log('   [8/10] Deleting form345_deriv_trans...');
    await conn.run(`
      DELETE FROM form345_deriv_trans
      WHERE ACCESSION_NUMBER IN (
        SELECT ACCESSION_NUMBER FROM form345_submissions
        WHERE FILING_DATE < '2023-10-01'
      )
    `);

    console.log('   [9/10] Deleting form345_deriv_holding...');
    await conn.run(`
      DELETE FROM form345_deriv_holding
      WHERE ACCESSION_NUMBER IN (
        SELECT ACCESSION_NUMBER FROM form345_submissions
        WHERE FILING_DATE < '2023-10-01'
      )
    `);

    // 10. form345_submissions (parent)
    console.log('   [10/10] Deleting form345_submissions...');
    await conn.run(`
      DELETE FROM form345_submissions WHERE FILING_DATE < '2023-10-01'
    `);

    // Optional: Cache tables
    if (INCLUDE_CACHES) {
      console.log('   [+] Deleting old cusip_mappings...');
      await conn.run(`DELETE FROM cusip_mappings WHERE cached_at < '2023-10-01'`);

      console.log('   [+] Deleting old filer_names...');
      await conn.run(`DELETE FROM filer_names WHERE cached_at < '2023-10-01'`);
    }

    // ========================================
    // AFTER COUNTS & SUMMARY
    // ========================================
    console.log('\n📊 Gathering post-deletion counts...\n');

    for (const table of tables) {
      const after = await getCount(table);
      counts.push({
        table,
        before: beforeCounts[table],
        after,
        deleted: beforeCounts[table] - after,
      });
    }

    console.log('='.repeat(60));
    console.log('Deletion Summary');
    console.log('='.repeat(60));
    console.log('');
    console.log('Table                        | Before     | After      | Deleted');
    console.log('-'.repeat(60));

    let totalDeleted = 0;
    for (const c of counts) {
      const tablePad = c.table.padEnd(28);
      const beforePad = c.before.toLocaleString().padStart(10);
      const afterPad = c.after.toLocaleString().padStart(10);
      const deletedPad = c.deleted.toLocaleString().padStart(10);
      console.log(`${tablePad}| ${beforePad} | ${afterPad} | ${deletedPad}`);
      totalDeleted += c.deleted;
    }

    console.log('-'.repeat(60));
    console.log(`${'TOTAL'.padEnd(28)}| ${' '.repeat(10)} | ${' '.repeat(10)} | ${totalDeleted.toLocaleString().padStart(10)}`);

    // ========================================
    // VERIFICATION
    // ========================================
    console.log('\n🔍 Verifying no old data remains...\n');

    // Check submissions_13f
    const oldSub = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM submissions_13f
      WHERE PERIODOFREPORT LIKE '%-2020'
         OR PERIODOFREPORT LIKE '%-2021'
         OR PERIODOFREPORT LIKE '%-2022'
         OR (PERIODOFREPORT LIKE '%-2023' AND (
              PERIODOFREPORT LIKE '__-JAN-%' OR PERIODOFREPORT LIKE '__-FEB-%' OR
              PERIODOFREPORT LIKE '__-MAR-%' OR PERIODOFREPORT LIKE '__-APR-%' OR
              PERIODOFREPORT LIKE '__-MAY-%' OR PERIODOFREPORT LIKE '__-JUN-%' OR
              PERIODOFREPORT LIKE '__-JUL-%' OR PERIODOFREPORT LIKE '__-AUG-%' OR
              PERIODOFREPORT LIKE '__-SEP-%'))
    `);

    const oldFilings = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM filings_13dg WHERE FILING_DATE < '2023-10-01'
    `);

    const oldForm345 = await getCountWhere(`
      SELECT COUNT(*) as cnt FROM form345_submissions WHERE FILING_DATE < '2023-10-01'
    `);

    if (oldSub > 0 || oldFilings > 0 || oldForm345 > 0) {
      console.log('⚠️  Warning: Some old data may still remain:');
      if (oldSub > 0) console.log(`   submissions_13f: ${oldSub} old records`);
      if (oldFilings > 0) console.log(`   filings_13dg: ${oldFilings} old records`);
      if (oldForm345 > 0) console.log(`   form345_submissions: ${oldForm345} old records`);
    } else {
      console.log('✅ Verification passed: No pre-Q4 2023 data remains');
    }

    // Show earliest dates
    console.log('\nEarliest dates in each table:');

    try {
      const earliestSub = await conn.runAndReadAll(`
        SELECT MIN(PERIODOFREPORT) as earliest FROM submissions_13f
      `);
      const earliest = (earliestSub.getRowObjects() as { earliest: string }[])[0]?.earliest;
      console.log(`  submissions_13f (PERIODOFREPORT): ${earliest || 'N/A'}`);
    } catch {
      console.log('  submissions_13f: N/A');
    }

    try {
      const earliestFiling = await conn.runAndReadAll(`
        SELECT MIN(FILING_DATE) as earliest FROM filings_13dg
      `);
      const earliest = (earliestFiling.getRowObjects() as { earliest: string }[])[0]?.earliest;
      console.log(`  filings_13dg (FILING_DATE): ${earliest || 'N/A'}`);
    } catch {
      console.log('  filings_13dg: N/A');
    }

    try {
      const earliestForm345 = await conn.runAndReadAll(`
        SELECT MIN(FILING_DATE) as earliest FROM form345_submissions
      `);
      const earliest = (earliestForm345.getRowObjects() as { earliest: string }[])[0]?.earliest;
      console.log(`  form345_submissions (FILING_DATE): ${earliest || 'N/A'}`);
    } catch {
      console.log('  form345_submissions: N/A');
    }

    console.log('\n✅ Done! Pre-Q4 2023 data has been pruned.');

  } finally {
    conn.closeSync();
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
