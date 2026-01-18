#!/usr/bin/env npx tsx
/**
 * Check MotherDuck database state
 */

import 'dotenv/config';
import { DuckDBInstance } from '@duckdb/node-api';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';

if (!MOTHERDUCK_TOKEN) {
  console.error('MOTHERDUCK_TOKEN not set');
  process.exit(1);
}

async function main() {
  console.log('Connecting to MotherDuck...');
  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();

  await conn.run("INSTALL 'motherduck'");
  await conn.run("LOAD 'motherduck'");
  await conn.run(`SET motherduck_token='${MOTHERDUCK_TOKEN}'`);
  await conn.run(`ATTACH 'md:${MOTHERDUCK_DATABASE}'`);
  await conn.run(`USE ${MOTHERDUCK_DATABASE}`);
  console.log('Connected!\n');

  // Check tables
  const tables = await conn.runAndReadAll("SHOW TABLES");
  console.log('Tables in MotherDuck:');
  for (const row of tables.getRowObjects() as { name: string }[]) {
    console.log('  -', row.name);
  }

  // Check counts
  const queries = [
    { name: 'submissions_13f', sql: 'SELECT COUNT(*) as cnt FROM submissions_13f' },
    { name: 'holdings_13f', sql: 'SELECT COUNT(*) as cnt FROM holdings_13f' },
    { name: 'filings_13dg', sql: 'SELECT COUNT(*) as cnt FROM filings_13dg' },
    { name: 'form345_submissions', sql: 'SELECT COUNT(*) as cnt FROM form345_submissions' },
    { name: 'form345_nonderiv_trans', sql: 'SELECT COUNT(*) as cnt FROM form345_nonderiv_trans' },
  ];

  console.log('\nRow counts:');
  for (const q of queries) {
    try {
      const result = await conn.runAndReadAll(q.sql);
      const cnt = (result.getRowObjects() as { cnt: bigint }[])[0]?.cnt;
      console.log(`  ${q.name}: ${Number(cnt).toLocaleString()}`);
    } catch {
      console.log(`  ${q.name}: (table not found)`);
    }
  }

  // Check latest dates
  console.log('\nLatest filing dates:');
  try {
    const latest13f = await conn.runAndReadAll("SELECT MAX(FILING_DATE) as dt FROM submissions_13f");
    console.log('  13F:', (latest13f.getRowObjects() as { dt: string }[])[0]?.dt);
  } catch {}

  try {
    const latest13dg = await conn.runAndReadAll("SELECT MAX(FILING_DATE) as dt FROM filings_13dg");
    console.log('  13D/G:', (latest13dg.getRowObjects() as { dt: string }[])[0]?.dt);
  } catch {}

  try {
    const latest345 = await conn.runAndReadAll("SELECT MAX(FILING_DATE) as dt FROM form345_submissions");
    console.log('  Form 3/4/5:', (latest345.getRowObjects() as { dt: string }[])[0]?.dt);
  } catch {}

  // Check Q1 2026 data specifically
  console.log('\nQ1 2026 data:');
  try {
    const q1_13f = await conn.runAndReadAll("SELECT COUNT(*) as cnt FROM submissions_13f WHERE FILING_DATE >= '2026-01-01'");
    console.log('  13F filings since 2026-01-01:', Number((q1_13f.getRowObjects() as { cnt: bigint }[])[0]?.cnt));
  } catch {}

  try {
    const q1_13dg = await conn.runAndReadAll("SELECT COUNT(*) as cnt FROM filings_13dg WHERE FILING_DATE >= '2026-01-01'");
    console.log('  13D/G filings since 2026-01-01:', Number((q1_13dg.getRowObjects() as { cnt: bigint }[])[0]?.cnt));
  } catch {}

  try {
    const q1_345 = await conn.runAndReadAll("SELECT COUNT(*) as cnt FROM form345_submissions WHERE FILING_DATE >= '2026-01-01'");
    console.log('  Form 3/4/5 filings since 2026-01-01:', Number((q1_345.getRowObjects() as { cnt: bigint }[])[0]?.cnt));
  } catch {}

  conn.closeSync();
}

main().catch(console.error);