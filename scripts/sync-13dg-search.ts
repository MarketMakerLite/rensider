#!/usr/bin/env npx tsx
/**
 * Efficient 13D/G Sync using SEC EFTS Search API
 *
 * Uses the search API to get filing metadata in bulk, which is much faster
 * than fetching and parsing individual filing documents.
 */

import 'dotenv/config';
import { DuckDBInstance } from '@duckdb/node-api';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';
const SEC_USER_AGENT = process.env.SEC_USER_AGENT || 'Company admin@example.com';

if (!MOTHERDUCK_TOKEN) {
  console.error('Error: MOTHERDUCK_TOKEN environment variable is required');
  process.exit(1);
}

interface SearchHit {
  _id: string;
  _source: {
    ciks: string[];
    display_names: string[];
    file_date: string;
    file_type: string;
    adsh: string;
    sics?: string[];
  };
}

interface Filing13DG {
  ACCESSION_NUMBER: string;
  FORM_TYPE: string;
  FILING_DATE: string;
  ISSUER_CIK: string;
  ISSUER_NAME: string;
  ISSUER_SIC: string | null;
  FILED_BY_CIK: string;
  FILED_BY_NAME: string;
}

async function searchFilings(
  formType: string,
  startDate: string,
  endDate: string,
  from: number = 0,
  size: number = 100
): Promise<{ hits: SearchHit[]; total: number }> {
  const params = new URLSearchParams({
    forms: formType,
    startdt: startDate,
    enddt: endDate,
    from: String(from),
    size: String(size),
  });

  const url = `https://efts.sec.gov/LATEST/search-index?${params}`;

  const response = await fetch(url, {
    headers: { 'User-Agent': SEC_USER_AGENT },
  });

  if (!response.ok) {
    throw new Error(`Search API error: ${response.status}`);
  }

  const data = await response.json();
  return {
    hits: data.hits?.hits || [],
    total: data.hits?.total?.value || 0,
  };
}

function parseHit(hit: SearchHit): Filing13DG | null {
  try {
    const source = hit._source;

    // The search API returns arrays for CIKs and names
    // For 13D/G, typically first CIK is the filer and there may be subject company info
    const ciks = source.ciks || [];
    const names = source.display_names || [];

    // Skip if no data
    if (ciks.length === 0 || names.length === 0) return null;

    // Format accession number with dashes
    const adsh = source.adsh || '';
    const accessionNumber = adsh.includes('-')
      ? adsh
      : adsh.replace(/(\d{10})(\d{2})(\d{6})/, '$1-$2-$3');

    return {
      ACCESSION_NUMBER: accessionNumber,
      FORM_TYPE: source.file_type || '',
      FILING_DATE: source.file_date || '',
      ISSUER_CIK: ciks[0] || '',
      ISSUER_NAME: names[0] || '',
      ISSUER_SIC: source.sics?.[0] || null,
      FILED_BY_CIK: ciks.length > 1 ? ciks[1] : ciks[0] || '',
      FILED_BY_NAME: names.length > 1 ? names[1] : names[0] || '',
    };
  } catch {
    return null;
  }
}

async function syncFormType(
  conn: Awaited<ReturnType<DuckDBInstance['connect']>>,
  formType: string,
  startDate: string,
  endDate: string
): Promise<number> {
  console.log(`\nSyncing ${formType} from ${startDate} to ${endDate}...`);

  let from = 0;
  const size = 100;
  let totalInserted = 0;
  let hasMore = true;

  while (hasMore) {
    try {
      const { hits, total } = await searchFilings(formType, startDate, endDate, from, size);

      if (from === 0) {
        console.log(`  Total filings: ${total}`);
      }

      if (hits.length === 0) {
        hasMore = false;
        break;
      }

      // Parse hits and filter nulls
      const filings = hits.map(parseHit).filter((f): f is Filing13DG => f !== null);

      if (filings.length > 0) {
        // Insert into MotherDuck
        await conn.run('BEGIN TRANSACTION');

        for (const filing of filings) {
          // Escape single quotes in strings
          const escape = (s: string) => s.replace(/'/g, "''");

          await conn.run(`
            INSERT OR REPLACE INTO filings_13dg (
              ACCESSION_NUMBER, FORM_TYPE, FILING_DATE,
              ISSUER_CIK, ISSUER_NAME, ISSUER_SIC,
              FILED_BY_CIK, FILED_BY_NAME
            ) VALUES (
              '${escape(filing.ACCESSION_NUMBER)}',
              '${escape(filing.FORM_TYPE)}',
              '${escape(filing.FILING_DATE)}',
              '${escape(filing.ISSUER_CIK)}',
              '${escape(filing.ISSUER_NAME)}',
              ${filing.ISSUER_SIC ? `'${escape(filing.ISSUER_SIC)}'` : 'NULL'},
              '${escape(filing.FILED_BY_CIK)}',
              '${escape(filing.FILED_BY_NAME)}'
            )
          `);
        }

        await conn.run('COMMIT');
        totalInserted += filings.length;
      }

      from += hits.length;
      process.stdout.write(`\r  Processed: ${from}/${total}`);

      // Respect rate limits - small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));

      if (from >= total) {
        hasMore = false;
      }
    } catch (error) {
      console.error(`\n  Error at offset ${from}: ${error}`);
      // Try to continue from next batch
      from += size;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log(`\n  Inserted: ${totalInserted}`);
  return totalInserted;
}

async function main() {
  const args = process.argv.slice(2);
  const startDateArg = args.find(a => a.startsWith('--from='))?.split('=')[1];
  const endDateArg = args.find(a => a.startsWith('--to='))?.split('=')[1];

  // Default: sync from 2025-01-01 to today
  const startDate = startDateArg || '2025-01-01';
  const endDate = endDateArg || new Date().toISOString().split('T')[0];

  console.log('Sync 13D/G Filings via Search API');
  console.log('='.repeat(50));
  console.log(`Date range: ${startDate} to ${endDate}`);

  console.log('\nConnecting to MotherDuck...');
  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();

  try {
    await conn.run("INSTALL 'motherduck'");
    await conn.run("LOAD 'motherduck'");
    await conn.run(`SET motherduck_token='${MOTHERDUCK_TOKEN}'`);
    await conn.run(`ATTACH 'md:${MOTHERDUCK_DATABASE}'`);
    await conn.run(`USE ${MOTHERDUCK_DATABASE}`);
    console.log('Connected!\n');

    // Get count before
    const beforeResult = await conn.runAndReadAll('SELECT COUNT(*) as cnt FROM filings_13dg');
    const countBefore = Number((beforeResult.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);
    console.log(`Current filings in database: ${countBefore.toLocaleString()}`);

    // Sync each form type
    const formTypes = ['SC 13D', 'SC 13D/A', 'SC 13G', 'SC 13G/A'];
    let totalInserted = 0;

    for (const formType of formTypes) {
      totalInserted += await syncFormType(conn, formType, startDate, endDate);
    }

    // Get count after
    const afterResult = await conn.runAndReadAll('SELECT COUNT(*) as cnt FROM filings_13dg');
    const countAfter = Number((afterResult.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    // Get latest date
    const latestResult = await conn.runAndReadAll('SELECT MAX(FILING_DATE) as dt FROM filings_13dg');
    const latestDate = (latestResult.getRowObjects() as { dt: string }[])[0]?.dt;

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
