#!/usr/bin/env npx tsx
/**
 * Fix 13F Submissions Column Swap Issue
 *
 * Some 2024 Q4+ data was imported with CIK and FILING_DATE columns swapped:
 * - CIK contains dates like '31-DEC-2024'
 * - FILING_DATE contains CIKs like '0001759641'
 *
 * This script identifies and fixes those rows.
 */

import 'dotenv/config';
import { DuckDBInstance } from '@duckdb/node-api';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';

if (!MOTHERDUCK_TOKEN) {
  console.error('Error: MOTHERDUCK_TOKEN required');
  process.exit(1);
}

async function main() {
  console.log('Fix 13F Submissions Column Swap');
  console.log('='.repeat(50));

  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();

  try {
    await conn.run("INSTALL 'motherduck'");
    await conn.run("LOAD 'motherduck'");
    await conn.run(`SET motherduck_token='${MOTHERDUCK_TOKEN}'`);
    await conn.run(`ATTACH 'md:${MOTHERDUCK_DATABASE}'`);
    await conn.run(`USE ${MOTHERDUCK_DATABASE}`);
    console.log('Connected to MotherDuck\n');

    // First, let's identify corrupted rows
    // Corrupted: CIK looks like a date (contains '-'), FILING_DATE looks like a CIK (all digits)
    console.log('Analyzing data...');

    const corruptedCount = await conn.runAndReadAll(`
      SELECT COUNT(*) as cnt
      FROM submissions_13f
      WHERE CIK LIKE '%-%'
        AND FILING_DATE ~ '^[0-9]+$'
    `);
    const numCorrupted = Number((corruptedCount.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);
    console.log(`Found ${numCorrupted.toLocaleString()} rows with swapped columns\n`);

    if (numCorrupted === 0) {
      console.log('No corrupted data found. Exiting.');
      return;
    }

    // Show sample of corrupted data
    console.log('Sample corrupted rows (before fix):');
    const sample = await conn.runAndReadAll(`
      SELECT ACCESSION_NUMBER, CIK, FILING_DATE, PERIODOFREPORT
      FROM submissions_13f
      WHERE CIK LIKE '%-%'
        AND FILING_DATE ~ '^[0-9]+$'
      LIMIT 5
    `);
    console.table(sample.getRowObjects());

    // Fix the data by swapping CIK and FILING_DATE for corrupted rows
    console.log('\nFixing corrupted rows...');

    // DuckDB doesn't support UPDATE with column swap directly, so we need to:
    // 1. Create a temp table with corrected values
    // 2. Delete corrupted rows
    // 3. Insert corrected rows

    // Create temp table with corrected data
    await conn.run(`
      CREATE TEMP TABLE temp_fixed AS
      SELECT
        ACCESSION_NUMBER,
        FILING_DATE as CIK,  -- Swap: FILING_DATE (which has CIK value) -> CIK
        SUBMISSIONTYPE,
        PERIODOFREPORT,
        CIK as FILING_DATE   -- Swap: CIK (which has date value) -> FILING_DATE
      FROM submissions_13f
      WHERE CIK LIKE '%-%'
        AND FILING_DATE ~ '^[0-9]+$'
    `);

    // Delete corrupted rows
    console.log('Deleting corrupted rows...');
    await conn.run(`
      DELETE FROM submissions_13f
      WHERE CIK LIKE '%-%'
        AND FILING_DATE ~ '^[0-9]+$'
    `);

    // Insert corrected rows
    console.log('Inserting corrected rows...');
    await conn.run(`
      INSERT INTO submissions_13f (ACCESSION_NUMBER, CIK, SUBMISSIONTYPE, PERIODOFREPORT, FILING_DATE)
      SELECT * FROM temp_fixed
    `);

    await conn.run(`DROP TABLE temp_fixed`);

    // Verify fix
    console.log('\nVerifying fix...');
    const stillCorrupted = await conn.runAndReadAll(`
      SELECT COUNT(*) as cnt
      FROM submissions_13f
      WHERE CIK LIKE '%-%'
        AND FILING_DATE ~ '^[0-9]+$'
    `);
    const numStillCorrupted = Number((stillCorrupted.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    if (numStillCorrupted > 0) {
      console.log(`WARNING: ${numStillCorrupted} rows still corrupted!`);
    } else {
      console.log('All corrupted rows have been fixed.');
    }

    // Show sample of fixed data
    console.log('\nSample rows after fix:');
    const sampleFixed = await conn.runAndReadAll(`
      SELECT ACCESSION_NUMBER, CIK, FILING_DATE, PERIODOFREPORT
      FROM submissions_13f
      WHERE PERIODOFREPORT LIKE '%DEC-2024%' OR PERIODOFREPORT LIKE '%2025%'
      LIMIT 5
    `);
    console.table(sampleFixed.getRowObjects());

    // Final statistics
    console.log('\n' + '='.repeat(50));
    console.log('Summary');
    console.log('='.repeat(50));
    console.log(`Fixed rows: ${numCorrupted.toLocaleString()}`);

    const totalCount = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM submissions_13f`);
    console.log(`Total submissions: ${Number((totalCount.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0).toLocaleString()}`);

    // Verify all CIKs are now numeric
    const validCiks = await conn.runAndReadAll(`
      SELECT COUNT(*) as cnt
      FROM submissions_13f
      WHERE CIK ~ '^[0-9]+$'
    `);
    console.log(`Rows with valid CIK format: ${Number((validCiks.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0).toLocaleString()}`);

  } finally {
    conn.closeSync();
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
