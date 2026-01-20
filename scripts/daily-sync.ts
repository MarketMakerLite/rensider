#!/usr/bin/env npx tsx

/**
 * Daily Sync Script
 *
 * Fetches new SEC filings since the last sync and appends them to Parquet files.
 * Designed to run daily via cron at 4:00 UTC (after SEC daily processing).
 *
 * Usage:
 *   npx tsx scripts/daily-sync.ts [options]
 *
 * Options:
 *   --forms=13F,13DG    Comma-separated form types to sync (default: all)
 *   --force             Force sync even if already run today
 *   --dry-run           Show what would be synced without making changes
 *
 * Cron example (run at 4:00 UTC daily):
 *   0 4 * * * cd /app && npx tsx scripts/daily-sync.ts >> /var/log/sec-sync.log 2>&1
 *
 * Alternative: Use the API endpoint for Vercel cron
 *   POST /api/sync?forms=13F,13DG&force=true
 */

import 'dotenv/config';
import { runSync, type SyncOptions } from '../lib/sec/daily-sync';

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);

  const options: SyncOptions = {
    forms: ['13F', '13DG'],
    force: false,
    dryRun: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--forms=')) {
      const formTypes = arg.split('=')[1].split(',').map(f => f.trim().toUpperCase());
      options.forms = formTypes.filter(f => f === '13F' || f === '13DG') as ('13F' | '13DG')[];
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
    }
  }

  return options;
}

async function main() {
  const options = parseArgs();

  console.log('SEC Daily Sync');
  console.log('='.repeat(60));
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Forms: ${options.forms.join(', ')}`);
  console.log(`Force: ${options.force}`);
  console.log(`Dry Run: ${options.dryRun}`);
  console.log('='.repeat(60));

  const result = await runSync(options);

  console.log('\n' + '='.repeat(60));
  console.log('Sync Summary');
  console.log('='.repeat(60));

  if (result['13F']) {
    const r = result['13F'];
    console.log(`13F: ${r.processed} processed, ${r.failed} failed${r.skipped ? ' (skipped)' : ''}`);
    if (r.message) console.log(`     ${r.message}`);
  }

  if (result['13DG']) {
    const r = result['13DG'];
    console.log(`13D/13G: ${r.processed} processed, ${r.failed} failed${r.skipped ? ' (skipped)' : ''}`);
    if (r.message) console.log(`     ${r.message}`);
  }

  if (result.pruned && result.pruned.totalDeleted > 0) {
    console.log(`\nPruned: ${result.pruned.totalDeleted.toLocaleString()} old records (>3 years)`);
  }

  console.log(`Started: ${result.startedAt}`);
  console.log(`Completed: ${result.completedAt}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
