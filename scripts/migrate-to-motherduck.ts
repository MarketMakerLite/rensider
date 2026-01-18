#!/usr/bin/env npx tsx
/**
 * Migrate local data to MotherDuck
 *
 * Migrates:
 * - 13F submissions and holdings from parquet files
 * - 13D/G filings from parquet files
 * - Form 3/4/5 data from local DuckDB file
 *
 * Usage:
 *   MOTHERDUCK_TOKEN=your_token npx tsx scripts/migrate-to-motherduck.ts
 */

import { DuckDBInstance } from '@duckdb/node-api';
import { readdir, access, copyFile, rm } from 'fs/promises';
import { join } from 'path';

const DATA_DIR = process.env.SEC_DATA_DIR || 'data';
const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';
const FORM345_DB_PATH = join(DATA_DIR, 'form345.duckdb');

if (!MOTHERDUCK_TOKEN) {
  console.error('Error: MOTHERDUCK_TOKEN environment variable is required');
  console.error('Usage: MOTHERDUCK_TOKEN=your_token npx tsx scripts/migrate-to-motherduck.ts');
  process.exit(1);
}

// Form 3/4/5 tables to migrate
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
  console.log('🦆 Starting migration to MotherDuck...\n');

  // Create DuckDB instance
  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();

  try {
    // Install and load MotherDuck extension
    console.log('📦 Loading MotherDuck extension...');
    await conn.run("INSTALL 'motherduck'");
    await conn.run("LOAD 'motherduck'");

    // Connect to MotherDuck
    console.log(`🔗 Connecting to MotherDuck database: ${MOTHERDUCK_DATABASE}...`);
    await conn.run(`SET motherduck_token='${MOTHERDUCK_TOKEN}'`);

    // Create database if it doesn't exist
    await conn.run(`CREATE DATABASE IF NOT EXISTS ${MOTHERDUCK_DATABASE}`);
    await conn.run(`USE ${MOTHERDUCK_DATABASE}`);

    console.log('✅ Connected to MotherDuck\n');

    // Initialize schema (creates tables if they don't exist)
    console.log('📋 Initializing schema...');
    await initializeSchema(conn);
    console.log('✅ Schema initialized\n');

    // Migrate 13D/G filings from parquet
    await migrateParquetCategory(conn, '13dg', 'filings', 'filings_13dg');

    // Migrate 13D/G reporting persons from parquet
    await migrateParquetCategory(conn, '13dg', 'reporting_persons', 'reporting_persons_13dg');

    // Migrate 13F submissions from parquet
    await migrateParquetCategory(conn, '13f', 'submissions', 'submissions_13f');

    // Migrate 13F holdings from parquet
    await migrateParquetCategory(conn, '13f', 'holdings', 'holdings_13f');

    // Migrate Form 3/4/5 data from local DuckDB
    await migrateForm345(conn);

    console.log('\n🎉 Migration complete!');

    // Show table counts
    console.log('\n📊 Final table row counts:');
    const allTables = ['filings_13dg', 'submissions_13f', 'holdings_13f', ...FORM345_TABLES];
    for (const table of allTables) {
      try {
        const result = await conn.runAndReadAll(`SELECT COUNT(*) as count FROM ${table}`);
        const rows = result.getRowObjects();
        const count = Number(rows[0]?.count || 0);
        console.log(`   ${table}: ${count.toLocaleString()} rows`);
      } catch {
        console.log(`   ${table}: (table not found)`);
      }
    }

  } finally {
    conn.closeSync();
  }
}

async function initializeSchema(conn: Awaited<ReturnType<DuckDBInstance['connect']>>) {
  // 13D/G filings
  await conn.run(`
    CREATE TABLE IF NOT EXISTS filings_13dg (
      ACCESSION_NUMBER VARCHAR PRIMARY KEY,
      FORM_TYPE VARCHAR,
      FILING_DATE VARCHAR,
      ISSUER_CIK VARCHAR,
      ISSUER_NAME VARCHAR,
      ISSUER_SIC VARCHAR,
      ISSUER_CUSIP VARCHAR,
      FILED_BY_CIK VARCHAR,
      FILED_BY_NAME VARCHAR,
      SECURITIES_CLASS_TITLE VARCHAR,
      PERCENT_OF_CLASS DOUBLE,
      SHARES_OWNED DOUBLE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 13F submissions
  await conn.run(`
    CREATE TABLE IF NOT EXISTS submissions_13f (
      ACCESSION_NUMBER VARCHAR PRIMARY KEY,
      CIK VARCHAR,
      SUBMISSIONTYPE VARCHAR,
      PERIODOFREPORT VARCHAR,
      FILING_DATE VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 13F holdings
  await conn.run(`
    CREATE TABLE IF NOT EXISTS holdings_13f (
      id INTEGER PRIMARY KEY,
      ACCESSION_NUMBER VARCHAR,
      CUSIP VARCHAR,
      NAMEOFISSUER VARCHAR,
      TITLEOFCLASS VARCHAR,
      VALUE BIGINT,
      SSHPRNAMT BIGINT,
      SSHPRNAMTTYPE VARCHAR,
      PUTCALL VARCHAR,
      INVESTMENTDISCRETION VARCHAR,
      OTHERMANAGER VARCHAR,
      VOTING_AUTH_SOLE BIGINT,
      VOTING_AUTH_SHARED BIGINT,
      VOTING_AUTH_NONE BIGINT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Form 3/4/5 tables
  await conn.run(`
    CREATE TABLE IF NOT EXISTS form345_submissions (
      ACCESSION_NUMBER VARCHAR PRIMARY KEY,
      FILING_DATE VARCHAR,
      PERIOD_OF_REPORT VARCHAR,
      DATE_OF_ORIG_SUB VARCHAR,
      NO_SECURITIES_OWNED VARCHAR,
      NOT_SUBJECT_SEC16 VARCHAR,
      FORM3_HOLDINGS_REPORTED VARCHAR,
      FORM4_TRANS_REPORTED VARCHAR,
      DOCUMENT_TYPE VARCHAR,
      ISSUERCIK VARCHAR,
      ISSUERNAME VARCHAR,
      ISSUERTRADINGSYMBOL VARCHAR,
      REMARKS VARCHAR,
      AFF10B5ONE VARCHAR
    )
  `);

  await conn.run(`
    CREATE TABLE IF NOT EXISTS form345_reporting_owners (
      ACCESSION_NUMBER VARCHAR NOT NULL,
      RPTOWNERCIK VARCHAR NOT NULL,
      RPTOWNERNAME VARCHAR,
      RPTOWNER_RELATIONSHIP VARCHAR,
      RPTOWNER_TITLE VARCHAR,
      RPTOWNER_TXT VARCHAR,
      RPTOWNER_STREET1 VARCHAR,
      RPTOWNER_STREET2 VARCHAR,
      RPTOWNER_CITY VARCHAR,
      RPTOWNER_STATE VARCHAR,
      RPTOWNER_ZIPCODE VARCHAR,
      RPTOWNER_STATE_DESC VARCHAR,
      FILE_NUMBER VARCHAR,
      PRIMARY KEY (ACCESSION_NUMBER, RPTOWNERCIK)
    )
  `);

  await conn.run(`
    CREATE TABLE IF NOT EXISTS form345_nonderiv_trans (
      ACCESSION_NUMBER VARCHAR NOT NULL,
      NONDERIV_TRANS_SK BIGINT NOT NULL,
      SECURITY_TITLE VARCHAR,
      SECURITY_TITLE_FN VARCHAR,
      TRANS_DATE VARCHAR,
      TRANS_DATE_FN VARCHAR,
      DEEMED_EXECUTION_DATE VARCHAR,
      DEEMED_EXECUTION_DATE_FN VARCHAR,
      TRANS_FORM_TYPE VARCHAR,
      TRANS_CODE VARCHAR,
      EQUITY_SWAP_INVOLVED VARCHAR,
      EQUITY_SWAP_TRANS_CD_FN VARCHAR,
      TRANS_TIMELINESS VARCHAR,
      TRANS_TIMELINESS_FN VARCHAR,
      TRANS_SHARES DOUBLE,
      TRANS_SHARES_FN VARCHAR,
      TRANS_PRICEPERSHARE DOUBLE,
      TRANS_PRICEPERSHARE_FN VARCHAR,
      TRANS_ACQUIRED_DISP_CD VARCHAR,
      TRANS_ACQUIRED_DISP_CD_FN VARCHAR,
      SHRS_OWND_FOLWNG_TRANS DOUBLE,
      SHRS_OWND_FOLWNG_TRANS_FN VARCHAR,
      VALU_OWND_FOLWNG_TRANS DOUBLE,
      VALU_OWND_FOLWNG_TRANS_FN VARCHAR,
      DIRECT_INDIRECT_OWNERSHIP VARCHAR,
      DIRECT_INDIRECT_OWNERSHIP_FN VARCHAR,
      NATURE_OF_OWNERSHIP VARCHAR,
      NATURE_OF_OWNERSHIP_FN VARCHAR,
      PRIMARY KEY (ACCESSION_NUMBER, NONDERIV_TRANS_SK)
    )
  `);

  await conn.run(`
    CREATE TABLE IF NOT EXISTS form345_nonderiv_holding (
      ACCESSION_NUMBER VARCHAR NOT NULL,
      NONDERIV_HOLDING_SK BIGINT NOT NULL,
      SECURITY_TITLE VARCHAR,
      SECURITY_TITLE_FN VARCHAR,
      SHRS_OWND_FOLWNG_TRANS DOUBLE,
      SHRS_OWND_FOLWNG_TRANS_FN VARCHAR,
      VALU_OWND_FOLWNG_TRANS DOUBLE,
      VALU_OWND_FOLWNG_TRANS_FN VARCHAR,
      DIRECT_INDIRECT_OWNERSHIP VARCHAR,
      DIRECT_INDIRECT_OWNERSHIP_FN VARCHAR,
      NATURE_OF_OWNERSHIP VARCHAR,
      NATURE_OF_OWNERSHIP_FN VARCHAR,
      OWNERSHIPFOOTNOTE VARCHAR,
      POSTTRANSOWNFOOTNOTE VARCHAR,
      PRIMARY KEY (ACCESSION_NUMBER, NONDERIV_HOLDING_SK)
    )
  `);

  await conn.run(`
    CREATE TABLE IF NOT EXISTS form345_deriv_trans (
      ACCESSION_NUMBER VARCHAR NOT NULL,
      DERIV_TRANS_SK BIGINT NOT NULL,
      SECURITY_TITLE VARCHAR,
      SECURITY_TITLE_FN VARCHAR,
      CONV_EXERCISE_PRICE DOUBLE,
      CONV_EXERCISE_PRICE_FN VARCHAR,
      TRANS_DATE VARCHAR,
      TRANS_DATE_FN VARCHAR,
      DEEMED_EXECUTION_DATE VARCHAR,
      DEEMED_EXECUTION_DATE_FN VARCHAR,
      TRANS_FORM_TYPE VARCHAR,
      TRANS_CODE VARCHAR,
      EQUITY_SWAP_INVOLVED VARCHAR,
      EQUITY_SWAP_TRANS_CD_FN VARCHAR,
      TRANS_TIMELINESS VARCHAR,
      TRANS_TIMELINESS_FN VARCHAR,
      TRANS_SHARES DOUBLE,
      TRANS_SHARES_FN VARCHAR,
      TRANS_TOTAL_VALUE DOUBLE,
      TRANS_TOTAL_VALUE_FN VARCHAR,
      TRANS_PRICEPERSHARE DOUBLE,
      TRANS_PRICEPERSHARE_FN VARCHAR,
      TRANS_ACQUIRED_DISP_CD VARCHAR,
      TRANS_ACQUIRED_DISP_CD_FN VARCHAR,
      EXERCISE_DATE VARCHAR,
      EXERCISE_DATE_FN VARCHAR,
      EXPIRATION_DATE VARCHAR,
      EXPIRATION_DATE_FN VARCHAR,
      UNDERLYING_SECURITY_TITLE VARCHAR,
      UNDERLYING_SECURITY_TITLE_FN VARCHAR,
      UNDERLYING_SECURITY_SHARES DOUBLE,
      UNDERLYING_SECURITY_SHARES_FN VARCHAR,
      UNDERLYING_SECURITY_VALUE DOUBLE,
      UNDERLYING_SECURITY_VALUE_FN VARCHAR,
      SHRS_OWND_FOLWNG_TRANS DOUBLE,
      SHRS_OWND_FOLWNG_TRANS_FN VARCHAR,
      DIRECT_INDIRECT_OWNERSHIP VARCHAR,
      DIRECT_INDIRECT_OWNERSHIP_FN VARCHAR,
      NATURE_OF_OWNERSHIP VARCHAR,
      NATURE_OF_OWNERSHIP_FN VARCHAR,
      OWNERSHIPFOOTNOTE VARCHAR,
      POSTTRANSOWNFOOTNOTE VARCHAR,
      PRIMARY KEY (ACCESSION_NUMBER, DERIV_TRANS_SK)
    )
  `);

  await conn.run(`
    CREATE TABLE IF NOT EXISTS form345_deriv_holding (
      ACCESSION_NUMBER VARCHAR NOT NULL,
      DERIV_HOLDING_SK BIGINT NOT NULL,
      SECURITY_TITLE VARCHAR,
      SECURITY_TITLE_FN VARCHAR,
      CONV_EXERCISE_PRICE DOUBLE,
      CONV_EXERCISE_PRICE_FN VARCHAR,
      EXERCISE_DATE VARCHAR,
      EXERCISE_DATE_FN VARCHAR,
      EXPIRATION_DATE VARCHAR,
      EXPIRATION_DATE_FN VARCHAR,
      UNDERLYING_SECURITY_TITLE VARCHAR,
      UNDERLYING_SECURITY_TITLE_FN VARCHAR,
      UNDERLYING_SECURITY_SHARES DOUBLE,
      UNDERLYING_SECURITY_SHARES_FN VARCHAR,
      UNDERLYING_SECURITY_VALUE DOUBLE,
      UNDERLYING_SECURITY_VALUE_FN VARCHAR,
      SHRS_OWND_FOLWNG_TRANS DOUBLE,
      SHRS_OWND_FOLWNG_TRANS_FN VARCHAR,
      DIRECT_INDIRECT_OWNERSHIP VARCHAR,
      DIRECT_INDIRECT_OWNERSHIP_FN VARCHAR,
      NATURE_OF_OWNERSHIP VARCHAR,
      NATURE_OF_OWNERSHIP_FN VARCHAR,
      OWNERSHIPFOOTNOTE VARCHAR,
      POSTTRANSOWNFOOTNOTE VARCHAR,
      EXERCISEFOOTNOTE VARCHAR,
      EXPIRATIONFOOTNOTE VARCHAR,
      PRIMARY KEY (ACCESSION_NUMBER, DERIV_HOLDING_SK)
    )
  `);

  // Create indexes
  await conn.run(`CREATE INDEX IF NOT EXISTS idx_filings_13dg_date ON filings_13dg(FILING_DATE)`);
  await conn.run(`CREATE INDEX IF NOT EXISTS idx_submissions_13f_cik ON submissions_13f(CIK)`);
  await conn.run(`CREATE INDEX IF NOT EXISTS idx_holdings_13f_accession ON holdings_13f(ACCESSION_NUMBER)`);
  await conn.run(`CREATE INDEX IF NOT EXISTS idx_form345_submissions_ticker ON form345_submissions(ISSUERTRADINGSYMBOL)`);
  await conn.run(`CREATE INDEX IF NOT EXISTS idx_form345_submissions_issuer_cik ON form345_submissions(ISSUERCIK)`);
  await conn.run(`CREATE INDEX IF NOT EXISTS idx_form345_submissions_filing_date ON form345_submissions(FILING_DATE)`);
  await conn.run(`CREATE INDEX IF NOT EXISTS idx_form345_owners_cik ON form345_reporting_owners(RPTOWNERCIK)`);
  await conn.run(`CREATE INDEX IF NOT EXISTS idx_form345_nonderiv_trans_date ON form345_nonderiv_trans(TRANS_DATE)`);
  await conn.run(`CREATE INDEX IF NOT EXISTS idx_form345_deriv_trans_date ON form345_deriv_trans(TRANS_DATE)`);
}

async function migrateParquetCategory(
  conn: Awaited<ReturnType<DuckDBInstance['connect']>>,
  category: string,
  subcategory: string,
  tableName: string
) {
  const dir = join(DATA_DIR, category, subcategory);

  try {
    const files = await readdir(dir);
    const parquetFiles = files.filter(f => f.endsWith('.parquet'));

    if (parquetFiles.length === 0) {
      console.log(`⏭️  Skipping ${tableName}: no parquet files found`);
      return;
    }

    console.log(`📁 Migrating ${tableName} (${parquetFiles.length} parquet files)...`);

    const globPattern = join(dir, '*.parquet');

    // Use CREATE OR REPLACE to fully replace table with parquet data
    await conn.run(`
      CREATE OR REPLACE TABLE ${tableName} AS
      SELECT * FROM read_parquet('${globPattern}')
    `);

    // Get row count
    const result = await conn.runAndReadAll(`SELECT COUNT(*) as count FROM ${tableName}`);
    const rows = result.getRowObjects();
    const count = Number(rows[0]?.count || 0);

    console.log(`   ✅ ${tableName}: ${count.toLocaleString()} rows`);

  } catch (error) {
    console.log(`   ⚠️  Could not migrate ${tableName}: ${error instanceof Error ? error.message : error}`);
  }
}

async function migrateForm345(conn: Awaited<ReturnType<DuckDBInstance['connect']>>) {
  // Check if local Form 3/4/5 DuckDB file exists
  const exists = await fileExists(FORM345_DB_PATH);

  if (!exists) {
    console.log(`⏭️  Skipping Form 3/4/5: local database not found at ${FORM345_DB_PATH}`);
    return;
  }

  console.log(`📁 Migrating Form 3/4/5 data from ${FORM345_DB_PATH}...`);

  // Copy the database file to avoid lock issues
  const tempDbPath = join('/tmp/claude', `form345-migrate-${Date.now()}.duckdb`);

  try {
    console.log(`   Copying database to avoid locks...`);
    await copyFile(FORM345_DB_PATH, tempDbPath);

    // Attach the copied database
    await conn.run(`ATTACH '${tempDbPath}' AS form345_local (READ_ONLY)`);

    // Migrate each table using CREATE OR REPLACE
    for (const tableName of FORM345_TABLES) {
      try {
        // Check if source table exists
        const checkResult = await conn.runAndReadAll(
          `SELECT COUNT(*) as cnt FROM form345_local.${tableName}`
        );
        const sourceCount = Number((checkResult.getRowObjects() as { cnt: bigint }[])[0]?.cnt ?? 0);

        if (sourceCount === 0) {
          console.log(`   ⏭️  ${tableName}: no data in source`);
          continue;
        }

        // Use CREATE OR REPLACE to fully replace table
        await conn.run(`
          CREATE OR REPLACE TABLE ${tableName} AS
          SELECT * FROM form345_local.${tableName}
        `);

        // Get final count
        const result = await conn.runAndReadAll(`SELECT COUNT(*) as count FROM ${tableName}`);
        const rows = result.getRowObjects();
        const count = Number(rows[0]?.count || 0);

        console.log(`   ✅ ${tableName}: ${count.toLocaleString()} rows`);

      } catch (error) {
        console.log(`   ⚠️  Could not migrate ${tableName}: ${error instanceof Error ? error.message : error}`);
      }
    }

    // Detach local database
    await conn.run(`DETACH form345_local`);

  } catch (error) {
    console.log(`   ⚠️  Could not migrate Form 3/4/5: ${error instanceof Error ? error.message : error}`);
  } finally {
    // Clean up temp file
    await rm(tempDbPath, { force: true }).catch(() => {});
  }
}

// Run migration
migrate().catch(error => {
  console.error('Migration failed:', error);
  process.exit(1);
});
