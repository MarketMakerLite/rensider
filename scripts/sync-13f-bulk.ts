#!/usr/bin/env npx tsx
/**
 * Sync 13F Bulk Data from SEC to MotherDuck
 *
 * Downloads and imports SEC 13F quarterly bulk data directly into MotherDuck.
 *
 * Usage:
 *   npx tsx scripts/sync-13f-bulk.ts [options]
 *
 * Options:
 *   --quarter=YYYY-QN   Sync specific quarter (e.g., 2024-Q4)
 *   --from=YYYY-QN      Sync from this quarter onwards
 *   --all               Sync all available quarters (2020-Q4 to current)
 *   --dry-run           Preview what would be downloaded
 */

import 'dotenv/config';
import { DuckDBInstance } from '@duckdb/node-api';
import { mkdir, rm, writeFile, readdir, access } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import unzipper from 'unzipper';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';
const SEC_USER_AGENT = process.env.SEC_USER_AGENT || 'Company admin@example.com';
const BACKFILL_DIR = '.claude/backfill-data';

const SEC_BASE_URL = 'https://www.sec.gov/files/structureddata/data/form-13f-data-sets';

if (!MOTHERDUCK_TOKEN) {
  console.error('Error: MOTHERDUCK_TOKEN environment variable is required');
  process.exit(1);
}

interface QuarterInfo {
  year: number;
  quarter: number;
  quarterStr: string;
  zipFilename: string;
  zipUrl: string;
}

function parseArgs(): { quarters: QuarterInfo[]; dryRun: boolean } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let specificQuarter: string | null = null;
  let fromQuarter: string | null = null;
  let all = false;

  for (const arg of args) {
    if (arg === '--dry-run') dryRun = true;
    else if (arg === '--all') all = true;
    else if (arg.startsWith('--quarter=')) specificQuarter = arg.split('=')[1];
    else if (arg.startsWith('--from=')) fromQuarter = arg.split('=')[1];
  }

  const { year: currentYear, quarter: currentQuarter } = getCurrentQuarter();
  const quarters: QuarterInfo[] = [];

  if (specificQuarter) {
    const q = parseQuarterString(specificQuarter);
    if (q) quarters.push(q);
  } else if (fromQuarter) {
    const start = parseQuarterString(fromQuarter);
    if (start) {
      for (let y = start.year; y <= currentYear; y++) {
        const startQ = y === start.year ? start.quarter : 1;
        const endQ = y === currentYear ? currentQuarter : 4;
        for (let q = startQ; q <= endQ; q++) {
          quarters.push(generateQuarterInfo(y, q));
        }
      }
    }
  } else if (all) {
    // Start from 2020-Q4 (first available)
    for (let y = 2020; y <= currentYear; y++) {
      const startQ = y === 2020 ? 4 : 1;
      const endQ = y === currentYear ? currentQuarter : 4;
      for (let q = startQ; q <= endQ; q++) {
        quarters.push(generateQuarterInfo(y, q));
      }
    }
  } else {
    // Default: current and previous quarter
    quarters.push(generateQuarterInfo(currentYear, currentQuarter));
    let prevY = currentYear, prevQ = currentQuarter - 1;
    if (prevQ === 0) { prevY--; prevQ = 4; }
    quarters.push(generateQuarterInfo(prevY, prevQ));
  }

  return { quarters, dryRun };
}

function getCurrentQuarter(): { year: number; quarter: number } {
  const now = new Date();
  return {
    year: now.getFullYear(),
    quarter: Math.ceil((now.getMonth() + 1) / 3),
  };
}

function parseQuarterString(str: string): QuarterInfo | null {
  const match = str.match(/^(\d{4})-?Q(\d)$/i);
  if (!match) return null;
  return generateQuarterInfo(parseInt(match[1]), parseInt(match[2]));
}

function generateQuarterInfo(year: number, quarter: number): QuarterInfo {
  const quarterStr = `${year}-Q${quarter}`;
  const zipFilename = `${year}q${quarter}_form13f.zip`;
  return {
    year,
    quarter,
    quarterStr,
    zipFilename,
    zipUrl: `${SEC_BASE_URL}/${zipFilename}`,
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadZip(url: string, destPath: string): Promise<boolean> {
  try {
    console.log(`   Downloading from SEC...`);
    const response = await fetch(url, {
      headers: { 'User-Agent': SEC_USER_AGENT },
    });

    if (!response.ok) {
      if (response.status === 404) {
        console.log(`   ⚠️  Not available yet (404)`);
        return false;
      }
      console.error(`   Failed: HTTP ${response.status}`);
      return false;
    }

    const buffer = await response.arrayBuffer();
    await writeFile(destPath, Buffer.from(buffer));
    console.log(`   Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`);
    return true;
  } catch (error) {
    console.error(`   Download error: ${error}`);
    return false;
  }
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

async function syncQuarter(
  conn: Awaited<ReturnType<DuckDBInstance['connect']>>,
  quarter: QuarterInfo
): Promise<{ success: boolean; submissions: number; holdings: number }> {
  const tempDir = join('/tmp/claude', `13f-sync-${quarter.quarterStr}-${Date.now()}`);
  const zipPath = join(tempDir, quarter.zipFilename);
  const extractDir = join(tempDir, 'extracted');

  try {
    await mkdir(tempDir, { recursive: true });

    // Check if we have it in backfill-data first
    const backfillPath = join(BACKFILL_DIR, quarter.zipFilename);
    let downloaded = false;

    if (await fileExists(backfillPath)) {
      console.log(`   Using cached file from ${BACKFILL_DIR}`);
      await mkdir(extractDir, { recursive: true });
      await new Promise<void>((resolve, reject) => {
        createReadStream(backfillPath)
          .pipe(unzipper.Extract({ path: extractDir }))
          .on('close', resolve)
          .on('error', reject);
      });
      downloaded = true;
    } else {
      downloaded = await downloadZip(quarter.zipUrl, zipPath);
      if (downloaded) {
        await extractZip(zipPath, extractDir);
      }
    }

    if (!downloaded) {
      return { success: false, submissions: 0, holdings: 0 };
    }

    // Import SUBMISSION.tsv
    const submissionPath = join(extractDir, 'SUBMISSION.tsv');
    console.log(`   Importing submissions...`);

    await conn.run(`
      INSERT OR REPLACE INTO submissions_13f (ACCESSION_NUMBER, CIK, SUBMISSIONTYPE, PERIODOFREPORT, FILING_DATE)
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

    const subResult = await conn.runAndReadAll(`
      SELECT COUNT(*) as cnt FROM submissions_13f
      WHERE PERIODOFREPORT LIKE '%${quarter.year}%'
    `);
    const submissions = Number((subResult.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    // Import INFOTABLE.tsv (holdings)
    const infotablePath = join(extractDir, 'INFOTABLE.tsv');
    console.log(`   Importing holdings...`);

    await conn.run(`
      INSERT OR REPLACE INTO holdings_13f (
        id, ACCESSION_NUMBER, CUSIP, NAMEOFISSUER, TITLEOFCLASS,
        VALUE, SSHPRNAMT, SSHPRNAMTTYPE, PUTCALL, INVESTMENTDISCRETION,
        OTHERMANAGER, VOTING_AUTH_SOLE, VOTING_AUTH_SHARED, VOTING_AUTH_NONE, created_at
      )
      SELECT
        INFOTABLE_SK as id,
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
        VOTING_AUTH_NONE,
        CURRENT_TIMESTAMP as created_at
      FROM read_csv_auto('${infotablePath}',
        delim='\\t',
        header=true,
        ignore_errors=true
      )
    `);

    const holdResult = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM holdings_13f`);
    const holdings = Number((holdResult.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

    return { success: true, submissions, holdings };

  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function main() {
  const { quarters, dryRun } = parseArgs();

  console.log('📊 Sync 13F Bulk Data to MotherDuck');
  console.log('='.repeat(50));
  console.log(`Quarters to sync: ${quarters.map(q => q.quarterStr).join(', ')}`);

  if (dryRun) {
    console.log('\nDry run - no data will be downloaded or imported.');
    for (const q of quarters) {
      const cached = await fileExists(join(BACKFILL_DIR, q.zipFilename));
      console.log(`  ${q.quarterStr}: ${cached ? '(cached)' : q.zipUrl}`);
    }
    return;
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
    let synced = 0;
    let failed = 0;

    for (const quarter of quarters) {
      console.log(`\n📁 ${quarter.quarterStr}...`);
      const result = await syncQuarter(conn, quarter);

      if (result.success) {
        synced++;
        totalSubmissions += result.submissions;
        console.log(`   ✅ Done`);
      } else {
        failed++;
      }
    }

    // Show final stats
    console.log('\n' + '='.repeat(50));
    console.log('Summary');
    console.log('='.repeat(50));
    console.log(`Synced: ${synced} quarters`);
    console.log(`Failed: ${failed} quarters`);

    const finalSub = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM submissions_13f`);
    const finalHold = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM holdings_13f`);
    console.log(`\nTotal submissions: ${Number((finalSub.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0).toLocaleString()}`);
    console.log(`Total holdings: ${Number((finalHold.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0).toLocaleString()}`);

    // Show latest filing date
    const latest = await conn.runAndReadAll(`
      SELECT MAX(FILING_DATE) as latest FROM submissions_13f
    `);
    console.log(`Latest filing date: ${(latest.getRowObjects() as { latest: string }[])[0]?.latest}`);

  } finally {
    conn.closeSync();
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
