#!/usr/bin/env npx tsx
/**
 * Check 13F data in MotherDuck
 */

import 'dotenv/config';
import { DuckDBInstance } from '@duckdb/node-api';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';

async function main() {
  console.log('Checking 13F Data in MotherDuck');
  console.log('='.repeat(50));

  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();

  await conn.run("INSTALL 'motherduck'");
  await conn.run("LOAD 'motherduck'");
  await conn.run(`SET motherduck_token='${MOTHERDUCK_TOKEN}'`);
  await conn.run(`ATTACH 'md:${MOTHERDUCK_DATABASE}'`);
  await conn.run(`USE ${MOTHERDUCK_DATABASE}`);

  // Check FILING_DATE format
  console.log('\nSample 13F submissions (recent):');
  const sampleResult = await conn.runAndReadAll(`
    SELECT ACCESSION_NUMBER, CIK, SUBMISSIONTYPE, PERIODOFREPORT, FILING_DATE
    FROM submissions_13f
    ORDER BY ACCESSION_NUMBER DESC
    LIMIT 5
  `);
  for (const row of sampleResult.getRowObjects()) {
    console.log(row);
  }

  // Check PERIODOFREPORT distribution
  console.log('\nFilings by PERIODOFREPORT (period of report):');
  const periodResult = await conn.runAndReadAll(`
    SELECT PERIODOFREPORT, COUNT(*) as cnt
    FROM submissions_13f
    GROUP BY PERIODOFREPORT
    ORDER BY PERIODOFREPORT DESC
    LIMIT 20
  `);
  for (const row of periodResult.getRowObjects() as { PERIODOFREPORT: string; cnt: bigint }[]) {
    console.log(`  ${row.PERIODOFREPORT}: ${Number(row.cnt).toLocaleString()}`);
  }

  // Check what 2025/2026 data we have
  console.log('\nFilings with PERIODOFREPORT containing 2025 or 2026:');
  const recentResult = await conn.runAndReadAll(`
    SELECT PERIODOFREPORT, COUNT(*) as cnt
    FROM submissions_13f
    WHERE PERIODOFREPORT LIKE '%2025%' OR PERIODOFREPORT LIKE '%2026%'
    GROUP BY PERIODOFREPORT
    ORDER BY PERIODOFREPORT DESC
  `);
  for (const row of recentResult.getRowObjects() as { PERIODOFREPORT: string; cnt: bigint }[]) {
    console.log(`  ${row.PERIODOFREPORT}: ${Number(row.cnt).toLocaleString()}`);
  }

  // Check holdings for a recent period
  console.log('\nHoldings count by period (last 5):');
  const holdingsResult = await conn.runAndReadAll(`
    SELECT s.PERIODOFREPORT, COUNT(*) as holdings_count
    FROM holdings_13f h
    JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
    GROUP BY s.PERIODOFREPORT
    ORDER BY s.PERIODOFREPORT DESC
    LIMIT 5
  `);
  for (const row of holdingsResult.getRowObjects() as { PERIODOFREPORT: string; holdings_count: bigint }[]) {
    console.log(`  ${row.PERIODOFREPORT}: ${Number(row.holdings_count).toLocaleString()} holdings`);
  }

  conn.closeSync();
}

main().catch(console.error);
