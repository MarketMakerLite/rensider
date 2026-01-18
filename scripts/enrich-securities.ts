#!/usr/bin/env npx tsx

/**
 * Enrich Securities Script
 *
 * Populates CUSIP to ticker mappings using the OpenFIGI API.
 * Builds a securities master table from 13F holdings data.
 *
 * Usage:
 *   npx tsx scripts/enrich-securities.ts [options]
 *
 * Options:
 *   --limit=N       Limit number of CUSIPs to process
 *   --force         Re-fetch even if already cached
 *   --stats         Show cache statistics only
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
import { mapCUSIPs, getCacheStats, getAllCachedMappings } from '../lib/sec/openfigi';

const DATA_DIR = process.env.SEC_DATA_DIR || 'data';

interface Options {
  limit?: number;
  force: boolean;
  statsOnly: boolean;
}

function parseArgs(): Options {
  const args = process.argv.slice(2);

  const options: Options = {
    force: false,
    statsOnly: false,
  };

  for (const arg of args) {
    if (arg.startsWith('--limit=')) {
      options.limit = parseInt(arg.split('=')[1]);
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--stats') {
      options.statsOnly = true;
    }
  }

  return options;
}

async function getUniqueCUSIPsFromHoldings(): Promise<string[]> {
  const parquetModule = await import('parquetjs-lite');
  const parquet = parquetModule.default || parquetModule;
  const cusips = new Set<string>();

  // Read from 13F holdings files
  const holdingsDir = join(DATA_DIR, '13f', 'holdings');

  try {
    const files = await readdir(holdingsDir);
    const parquetFiles = files.filter(f => f.endsWith('.parquet'));

    console.log(`Found ${parquetFiles.length} holdings files`);

    for (const file of parquetFiles) {
      const filePath = join(holdingsDir, file);

      try {
        const reader = await parquet.ParquetReader.openFile(filePath);
        const cursor = reader.getCursor();
        let row;

        while ((row = await cursor.next()) !== null) {
          const record = row as { CUSIP?: string };
          if (record.CUSIP) {
            cusips.add(record.CUSIP);
          }
        }

        await reader.close();
        console.log(`  Processed ${file}: ${cusips.size} unique CUSIPs so far`);
      } catch (error) {
        console.error(`  Error reading ${file}:`, error);
      }
    }
  } catch (error) {
    console.error('Error reading holdings directory:', error);
  }

  // Also read from 13D/13G filings
  const filingsDir = join(DATA_DIR, '13dg', 'filings');

  try {
    const files = await readdir(filingsDir);
    const parquetFiles = files.filter(f => f.endsWith('.parquet'));

    for (const file of parquetFiles) {
      const filePath = join(filingsDir, file);

      try {
        const reader = await parquet.ParquetReader.openFile(filePath);
        const cursor = reader.getCursor();
        let row;

        while ((row = await cursor.next()) !== null) {
          const record = row as { ISSUER_CUSIP?: string };
          if (record.ISSUER_CUSIP) {
            cusips.add(record.ISSUER_CUSIP);
          }
        }

        await reader.close();
      } catch (error) {
        // Ignore errors for 13D/13G files
      }
    }
  } catch {
    // 13D/13G directory may not exist yet
  }

  return Array.from(cusips);
}

async function main() {
  const options = parseArgs();

  console.log('Securities Enrichment Script');
  console.log('='.repeat(60));

  // Show stats if requested
  if (options.statsOnly) {
    const stats = await getCacheStats();
    console.log('\nCache Statistics:');
    console.log(`  Total mappings: ${stats.totalMappings}`);
    console.log(`  Successful: ${stats.successfulMappings}`);
    console.log(`  Failed: ${stats.failedMappings}`);
    console.log(`  Memory cache: ${stats.memoryCacheSize}`);

    // Show sample of cached tickers
    const cached = await getAllCachedMappings();
    const withTickers = cached.filter(m => m.ticker).slice(0, 10);

    if (withTickers.length > 0) {
      console.log('\nSample mappings:');
      for (const m of withTickers) {
        console.log(`  ${m.cusip} -> ${m.ticker} (${m.name})`);
      }
    }

    return;
  }

  // Get unique CUSIPs from holdings
  console.log('\nCollecting CUSIPs from holdings files...');
  const allCusips = await getUniqueCUSIPsFromHoldings();
  console.log(`Found ${allCusips.length} unique CUSIPs`);

  if (allCusips.length === 0) {
    console.log('No CUSIPs found. Run backfill scripts first.');
    return;
  }

  // Check what's already cached
  const cached = await getAllCachedMappings();
  const cachedCusips = new Set(cached.map(m => m.cusip));

  let cusipsToProcess: string[];

  if (options.force) {
    cusipsToProcess = allCusips;
  } else {
    cusipsToProcess = allCusips.filter(c => !cachedCusips.has(c));
  }

  if (options.limit) {
    cusipsToProcess = cusipsToProcess.slice(0, options.limit);
  }

  console.log(`\nCUSIPs to process: ${cusipsToProcess.length}`);
  console.log(`Already cached: ${cachedCusips.size}`);

  if (cusipsToProcess.length === 0) {
    console.log('All CUSIPs already cached. Use --force to re-fetch.');
    return;
  }

  // Process in batches
  const batchSize = 500;
  let processed = 0;
  let successful = 0;
  let failed = 0;

  for (let i = 0; i < cusipsToProcess.length; i += batchSize) {
    const batch = cusipsToProcess.slice(i, i + batchSize);
    console.log(`\nProcessing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(cusipsToProcess.length / batchSize)}...`);

    const mappings = await mapCUSIPs(batch);

    for (const m of mappings) {
      processed++;
      if (m.ticker) {
        successful++;
      } else {
        failed++;
      }
    }

    console.log(`  Batch complete: ${successful} successful, ${failed} failed (${processed} total)`);
  }

  // Final stats
  console.log('\n' + '='.repeat(60));
  console.log('Enrichment Complete');
  console.log('='.repeat(60));
  console.log(`Processed: ${processed}`);
  console.log(`Successful mappings: ${successful}`);
  console.log(`Failed mappings: ${failed}`);

  const finalStats = await getCacheStats();
  console.log(`\nTotal cached mappings: ${finalStats.totalMappings}`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
