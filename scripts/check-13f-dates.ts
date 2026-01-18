#!/usr/bin/env npx tsx
/**
 * Check most recent 13F filing dates in MotherDuck
 */

import { DuckDBInstance } from '@duckdb/node-api';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';

if (!MOTHERDUCK_TOKEN) {
  console.error('Error: MOTHERDUCK_TOKEN required');
  process.exit(1);
}

async function check() {
  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();

  try {
    await conn.run("INSTALL 'motherduck'");
    await conn.run("LOAD 'motherduck'");
    await conn.run(`SET motherduck_token='${MOTHERDUCK_TOKEN}'`);
    await conn.run(`ATTACH 'md:${MOTHERDUCK_DATABASE}'`);
    await conn.run(`USE ${MOTHERDUCK_DATABASE}`);

    console.log('📊 13F Submissions Summary:\n');

    // Check most recent filing dates
    const summary = await conn.runAndReadAll(`
      SELECT
        MAX(FILING_DATE) as latest_filing,
        MAX(PERIODOFREPORT) as latest_period,
        COUNT(*) as total_submissions
      FROM submissions_13f
    `);
    console.log(summary.getRowObjects()[0]);

    // Most recent 10 filings
    console.log('\n📅 Most recent 10 filings:\n');
    const recent = await conn.runAndReadAll(`
      SELECT FILING_DATE, PERIODOFREPORT, CIK, SUBMISSIONTYPE
      FROM submissions_13f
      ORDER BY FILING_DATE DESC
      LIMIT 10
    `);
    console.table(recent.getRowObjects());

    // Count by filing date for recent dates
    console.log('\n📈 Filings per day (last 10 days with filings):\n');
    const byDate = await conn.runAndReadAll(`
      SELECT FILING_DATE, COUNT(*) as filings
      FROM submissions_13f
      GROUP BY FILING_DATE
      ORDER BY FILING_DATE DESC
      LIMIT 10
    `);
    console.table(byDate.getRowObjects());

  } finally {
    conn.closeSync();
  }
}

check().catch(console.error);
