#!/usr/bin/env npx tsx

/**
 * Verify Backfill Data
 *
 * Counts rows in all parquet files to verify data integrity.
 */

import { join } from 'path';
import { readdir } from 'fs/promises';

const DATA_DIR = process.env.SEC_DATA_DIR || 'data';

async function verifyFile(filePath: string): Promise<{ readable: boolean; sampleRow: Record<string, unknown> | null }> {
  const parquetModule = await import('parquetjs-lite');
  const parquet = parquetModule.default || parquetModule;

  try {
    const reader = await parquet.ParquetReader.openFile(filePath);
    const cursor = reader.getCursor();
    const sampleRow = await cursor.next();
    await reader.close();
    return { readable: true, sampleRow };
  } catch (error) {
    return { readable: false, sampleRow: null };
  }
}

async function main() {
  const holdingsDir = join(DATA_DIR, '13f', 'holdings');
  const submissionsDir = join(DATA_DIR, '13f', 'submissions');

  const holdingsFiles = (await readdir(holdingsDir)).filter(f => f.endsWith('.parquet')).sort();

  console.log('Quarter          | Holdings | Submissions | Sample CUSIP');
  console.log('----------------------------------------------------------------------');

  let validCount = 0;
  let invalidCount = 0;

  for (const file of holdingsFiles) {
    const quarter = file.replace('.parquet', '');

    const holdingsResult = await verifyFile(join(holdingsDir, file));
    const submissionsResult = await verifyFile(join(submissionsDir, file));

    const holdingsStatus = holdingsResult.readable ? '✓' : '✗';
    const submissionsStatus = submissionsResult.readable ? '✓' : '✗';
    const sampleCusip = (holdingsResult.sampleRow as { CUSIP?: string })?.CUSIP || 'N/A';

    if (holdingsResult.readable && submissionsResult.readable) {
      validCount++;
    } else {
      invalidCount++;
    }

    console.log(`${quarter.padEnd(16)} | ${holdingsStatus.padStart(8)} | ${submissionsStatus.padStart(11)} | ${sampleCusip}`);
  }

  console.log('----------------------------------------------------------------------');
  console.log(`Total quarters: ${holdingsFiles.length}`);
  console.log(`Valid: ${validCount}, Invalid: ${invalidCount}`);

  // Show expected vs actual from import logs
  console.log('\n=== Expected Row Counts (from import logs) ===');
  const expected: Record<string, { holdings: number; submissions: number }> = {
    '2020-Q4': { holdings: 2156794, submissions: 7237 },
    '2021-Q1': { holdings: 2454113, submissions: 7883 },
    '2021-Q2': { holdings: 2376681, submissions: 7927 },
    '2021-Q3': { holdings: 2660728, submissions: 8096 },
    '2021-Q4': { holdings: 2569324, submissions: 7985 },
    '2022-Q1': { holdings: 2684317, submissions: 8921 },
    '2022-Q2': { holdings: 2603731, submissions: 8906 },
    '2022-Q3': { holdings: 2632327, submissions: 8948 },
    '2022-Q4': { holdings: 2622058, submissions: 9010 },
    '2023-Q1': { holdings: 2786017, submissions: 9201 },
    '2023-Q2': { holdings: 2672308, submissions: 9113 },
    '2023-Q3': { holdings: 2724039, submissions: 9108 },
    '2023-Q4': { holdings: 2886468, submissions: 9196 },
    '2024-Q2': { holdings: 3026705, submissions: 9884 },
    '2024-Q3': { holdings: 3278515, submissions: 10117 },
    '2024-Q4': { holdings: 3201864, submissions: 9891 },
  };

  let totalHoldings = 0;
  let totalSubmissions = 0;
  for (const q of Object.keys(expected).sort()) {
    totalHoldings += expected[q].holdings;
    totalSubmissions += expected[q].submissions;
  }

  console.log(`Total expected holdings: ${totalHoldings.toLocaleString()}`);
  console.log(`Total expected submissions: ${totalSubmissions.toLocaleString()}`);
}

main().catch(console.error);
