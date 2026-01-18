#!/usr/bin/env npx tsx
/**
 * Migrate Form 3/4/5 data to MotherDuck
 *
 * Usage:
 *   MOTHERDUCK_TOKEN=your_token npx tsx scripts/migrate-form345-to-motherduck.ts
 */

import { DuckDBInstance } from '@duckdb/node-api';
import { access, copyFile, rm } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = process.env.SEC_DATA_DIR || 'data';
const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';
const FORM345_DB_PATH = join(DATA_DIR, 'form345.duckdb');

if (!MOTHERDUCK_TOKEN) {
  console.error('Error: MOTHERDUCK_TOKEN environment variable is required');
  process.exit(1);
}

const FORM345_TABLES = [
  'form345_submissions',
  'form345_reporting_owners',
  'form345_nonderiv_trans',
  'form345_nonderiv_holding',
  'form345_deriv_trans',
  'form345_deriv_holding',
];

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function migrate() {
  console.log('🦆 Migrating Form 3/4/5 data to MotherDuck...\n');

  // Check if local database exists
  const exists = await fileExists(FORM345_DB_PATH);
  if (!exists) {
    console.error(`Error: Local database not found at ${FORM345_DB_PATH}`);
    process.exit(1);
  }

  // Copy database to avoid lock issues
  const tempDbPath = join('/tmp/claude', `form345-migrate-${Date.now()}.duckdb`);
  console.log(`📋 Copying database to avoid locks...`);
  await copyFile(FORM345_DB_PATH, tempDbPath);

  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();

  try {
    // Load MotherDuck extension
    console.log('📦 Loading MotherDuck extension...');
    await conn.run("INSTALL 'motherduck'");
    await conn.run("LOAD 'motherduck'");

    // Connect to MotherDuck
    console.log(`🔗 Connecting to MotherDuck: ${MOTHERDUCK_DATABASE}...`);
    await conn.run(`SET motherduck_token='${MOTHERDUCK_TOKEN}'`);
    await conn.run(`ATTACH 'md:${MOTHERDUCK_DATABASE}'`);
    await conn.run(`USE ${MOTHERDUCK_DATABASE}`);
    console.log('✅ Connected\n');

    // Attach local database
    console.log(`📁 Attaching local database...`);
    await conn.run(`ATTACH '${tempDbPath}' AS form345_local (READ_ONLY)`);

    // Migrate each table
    for (const tableName of FORM345_TABLES) {
      try {
        // Get source count
        const srcResult = await conn.runAndReadAll(
          `SELECT COUNT(*) as cnt FROM form345_local.${tableName}`
        );
        const sourceCount = Number((srcResult.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

        if (sourceCount === 0) {
          console.log(`⏭️  ${tableName}: no data in source`);
          continue;
        }

        console.log(`📥 ${tableName}: migrating ${sourceCount.toLocaleString()} rows...`);

        // Create or replace the table
        await conn.run(`
          CREATE OR REPLACE TABLE ${tableName} AS
          SELECT * FROM form345_local.${tableName}
        `);

        // Verify
        const result = await conn.runAndReadAll(`SELECT COUNT(*) as cnt FROM ${tableName}`);
        const count = Number((result.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);
        console.log(`   ✅ ${count.toLocaleString()} rows migrated`);

      } catch (error) {
        console.log(`   ⚠️  Error: ${error instanceof Error ? error.message : error}`);
      }
    }

    await conn.run(`DETACH form345_local`);

    console.log('\n🎉 Migration complete!');

  } finally {
    conn.closeSync();
    await rm(tempDbPath, { force: true }).catch(() => {});
  }
}

migrate().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
