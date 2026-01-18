#!/usr/bin/env npx tsx
/**
 * Sync 13D/G Filings from SEC Form Index
 *
 * Uses the form.idx files to get filing metadata directly,
 * which is much faster than fetching and parsing individual filings.
 * The form index contains: form type, company name, CIK, date filed, file name
 */

import 'dotenv/config';
import { DuckDBInstance } from '@duckdb/node-api';
import { fetchFormIndex, type FormIndexEntry } from '../lib/sec/client';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';

if (!MOTHERDUCK_TOKEN) {
  console.error('Error: MOTHERDUCK_TOKEN environment variable is required');
  process.exit(1);
}

// Form types to sync (both abbreviated and full names)
const SCHEDULE_13_TYPES = [
  'SC 13D', 'SC 13D/A', 'SC 13G', 'SC 13G/A',
  'SCHEDULE 13D', 'SCHEDULE 13D/A', 'SCHEDULE 13G', 'SCHEDULE 13G/A',
];

function getAccessionNumber(entry: FormIndexEntry): string {
  const parts = entry.fileName.split('/');
  return parts[parts.length - 1].replace('.txt', '');
}

function entryToRecord(entry: FormIndexEntry) {
  const accessionNumber = getAccessionNumber(entry);

  return {
    ACCESSION_NUMBER: accessionNumber,
    FORM_TYPE: entry.formType,
    FILING_DATE: entry.dateFiled,
    ISSUER_CIK: entry.cik,
    ISSUER_NAME: entry.companyName,
    ISSUER_SIC: null,
    ISSUER_CUSIP: null,
    FILED_BY_CIK: entry.cik, // Same as issuer from index
    FILED_BY_NAME: entry.companyName,
  };
}

interface QuarterInfo {
  year: number;
  quarter: number;
}

function getQuartersBetween(startYear: number, startQuarter: number): QuarterInfo[] {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3);

  const quarters: QuarterInfo[] = [];
  let year = startYear;
  let quarter = startQuarter;

  while (year < currentYear || (year === currentYear && quarter <= currentQuarter)) {
    quarters.push({ year, quarter });
    quarter++;
    if (quarter > 4) {
      quarter = 1;
      year++;
    }
  }

  return quarters;
}

async function syncQuarter(
  conn: Awaited<ReturnType<DuckDBInstance['connect']>>,
  year: number,
  quarter: number,
  lastProcessedDate?: string
): Promise<{ inserted: number; latestDate: string }> {
  console.log(`\nFetching ${year}-Q${quarter} form index...`);

  const index = await fetchFormIndex(year, quarter);
  console.log(`  Total filings in index: ${index.length}`);

  // Filter for Schedule 13D/G
  const schedule13 = index.filter(entry =>
    SCHEDULE_13_TYPES.includes(entry.formType)
  );
  console.log(`  Schedule 13D/G filings: ${schedule13.length}`);

  // Filter for filings after last processed date
  let toInsert = schedule13;
  if (lastProcessedDate) {
    toInsert = schedule13.filter(entry => entry.dateFiled > lastProcessedDate);
    console.log(`  New since ${lastProcessedDate}: ${toInsert.length}`);
  }

  if (toInsert.length === 0) {
    return { inserted: 0, latestDate: lastProcessedDate || '' };
  }

  // Insert in batches
  const batchSize = 100;
  let inserted = 0;
  let latestDate = lastProcessedDate || '';

  for (let i = 0; i < toInsert.length; i += batchSize) {
    const batch = toInsert.slice(i, i + batchSize);

    await conn.run('BEGIN TRANSACTION');

    for (const entry of batch) {
      const record = entryToRecord(entry);

      // Escape single quotes
      const escape = (s: string | null) => s ? s.replace(/'/g, "''") : '';

      try {
        // Check if exists first
        const existsResult = await conn.runAndReadAll(`
          SELECT 1 FROM filings_13dg WHERE ACCESSION_NUMBER = '${escape(record.ACCESSION_NUMBER)}' LIMIT 1
        `);
        const exists = (existsResult.getRowObjects() as unknown[]).length > 0;

        if (!exists) {
          await conn.run(`
            INSERT INTO filings_13dg (
              ACCESSION_NUMBER, FORM_TYPE, FILING_DATE,
              ISSUER_CIK, ISSUER_NAME, ISSUER_SIC, ISSUER_CUSIP,
              FILED_BY_CIK, FILED_BY_NAME
            ) VALUES (
              '${escape(record.ACCESSION_NUMBER)}',
              '${escape(record.FORM_TYPE)}',
              '${escape(record.FILING_DATE)}',
              '${escape(record.ISSUER_CIK)}',
              '${escape(record.ISSUER_NAME)}',
              NULL,
              NULL,
              '${escape(record.FILED_BY_CIK)}',
              '${escape(record.FILED_BY_NAME)}'
            )
          `);
          inserted++;

          if (record.FILING_DATE > latestDate) {
            latestDate = record.FILING_DATE;
          }
        }
      } catch (error) {
        // Ignore errors
      }
    }

    await conn.run('COMMIT');
    process.stdout.write(`\r  Inserted: ${inserted}/${toInsert.length}`);
  }

  console.log();
  return { inserted, latestDate };
}

async function main() {
  const args = process.argv.slice(2);
  const fromArg = args.find(a => a.startsWith('--from='))?.split('=')[1];

  // Parse --from=YYYY-QN format
  let startYear = 2025;
  let startQuarter = 1;
  if (fromArg) {
    const match = fromArg.match(/^(\d{4})-?Q(\d)$/i);
    if (match) {
      startYear = parseInt(match[1]);
      startQuarter = parseInt(match[2]);
    }
  }

  console.log('Sync 13D/G Filings from SEC Form Index');
  console.log('='.repeat(50));
  console.log(`Starting from: ${startYear}-Q${startQuarter}`);

  console.log('\nConnecting to MotherDuck...');
  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();

  try {
    await conn.run("INSTALL 'motherduck'");
    await conn.run("LOAD 'motherduck'");
    await conn.run(`SET motherduck_token='${MOTHERDUCK_TOKEN}'`);
    await conn.run(`ATTACH 'md:${MOTHERDUCK_DATABASE}'`);
    await conn.run(`USE ${MOTHERDUCK_DATABASE}`);
    console.log('Connected!');

    // Get current count and latest date
    const beforeResult = await conn.runAndReadAll('SELECT COUNT(*) as cnt FROM filings_13dg');
    const countBefore = Number((beforeResult.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    const latestResult = await conn.runAndReadAll('SELECT MAX(FILING_DATE) as dt FROM filings_13dg');
    const currentLatest = (latestResult.getRowObjects() as { dt: string }[])[0]?.dt || '';

    console.log(`\nCurrent filings: ${countBefore.toLocaleString()}`);
    console.log(`Latest date: ${currentLatest}`);

    // Get quarters to sync
    const quarters = getQuartersBetween(startYear, startQuarter);
    console.log(`\nQuarters to sync: ${quarters.length}`);

    let totalInserted = 0;
    let latestDate = currentLatest;

    for (const { year, quarter } of quarters) {
      const result = await syncQuarter(conn, year, quarter, currentLatest);
      totalInserted += result.inserted;
      if (result.latestDate > latestDate) {
        latestDate = result.latestDate;
      }
    }

    // Final stats
    const afterResult = await conn.runAndReadAll('SELECT COUNT(*) as cnt FROM filings_13dg');
    const countAfter = Number((afterResult.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    console.log('\n' + '='.repeat(50));
    console.log('Summary');
    console.log('='.repeat(50));
    console.log(`Filings before: ${countBefore.toLocaleString()}`);
    console.log(`Filings after: ${countAfter.toLocaleString()}`);
    console.log(`Net new: ${(countAfter - countBefore).toLocaleString()}`);
    console.log(`Latest filing date: ${latestDate}`);

  } finally {
    conn.closeSync();
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
