/**
 * DuckDB/MotherDuck wrapper for SEC filings data
 *
 * Connects to MotherDuck (cloud DuckDB) for all data operations.
 * Requires MOTHERDUCK_TOKEN environment variable to be set.
 */

import { DuckDBInstance } from '@duckdb/node-api';
import { dbLogger } from '@/lib/logger';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';

// Allowlist of valid table names for security
const ALLOWED_TABLES = new Set([
  'filings_13dg',
  'submissions_13f',
  'holdings_13f',
  'form345_submissions',
  'form345_reporting_owners',
  'form345_nonderiv_trans',
  'form345_nonderiv_holding',
  'form345_deriv_trans',
  'form345_deriv_holding',
  'cusip_mappings',
  'reporting_persons_13dg',
]);

// Validate identifier (table/column name) - alphanumeric and underscore only
function isValidIdentifier(name: string): boolean {
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
}

// Validate table name against allowlist
function assertValidTableName(tableName: string): void {
  // Strip database prefix if present
  const baseName = tableName.includes('.') ? tableName.split('.').pop()! : tableName;
  if (!ALLOWED_TABLES.has(baseName)) {
    throw new Error(`Table "${tableName}" is not in the allowed tables list`);
  }
}

// Validate column names
function assertValidColumnNames(columns: string[]): void {
  for (const col of columns) {
    if (!isValidIdentifier(col)) {
      throw new Error(`Invalid column name: "${col}"`);
    }
  }
}

let instance: DuckDBInstance | null = null;
let initPromise: Promise<DuckDBInstance> | null = null;
let initialized = false;

// Health check state
let lastHealthCheck: number = 0;
const HEALTH_CHECK_INTERVAL = 60_000; // 1 minute

/**
 * Check if we're using MotherDuck (cloud) mode
 * Always returns true since local mode is no longer supported
 */
export function isCloudMode(): boolean {
  return true;
}

/**
 * Check if the connection is healthy
 */
export async function isHealthy(): Promise<boolean> {
  if (!instance || !initialized) return false;
  try {
    const conn = await instance.connect();
    try {
      await conn.run('SELECT 1');
      return true;
    } finally {
      conn.closeSync();
    }
  } catch {
    return false;
  }
}

/**
 * Perform health check if interval has elapsed
 */
async function maybeHealthCheck(): Promise<void> {
  const now = Date.now();
  if (now - lastHealthCheck < HEALTH_CHECK_INTERVAL) return;
  lastHealthCheck = now;

  if (initialized && !(await isHealthy())) {
    dbLogger.warn('Connection unhealthy, resetting');
    await resetConnection();
  }
}

/**
 * Get the singleton DuckDB instance
 */
async function getInstance(): Promise<DuckDBInstance> {
  if (instance && initialized) {
    return instance;
  }

  if (initPromise) {
    return initPromise;
  }

  if (!MOTHERDUCK_TOKEN) {
    throw new Error('MOTHERDUCK_TOKEN environment variable is required. Local DuckDB mode is no longer supported.');
  }

  initPromise = (async () => {
    dbLogger.info('Connecting to MotherDuck...');

    // Set HOME env var for serverless environments (Vercel) before DuckDB init
    // MotherDuck extension requires HOME to be set
    if (!process.env.HOME) {
      process.env.HOME = '/tmp';
    }

    const db = await DuckDBInstance.create(':memory:');
    instance = db;

    const connection = await db.connect();
    try {
      // Set home directory to /tmp for serverless environments (Vercel)
      await connection.run("SET home_directory='/tmp'");

      // Set extension directory explicitly
      await connection.run("SET extension_directory='/tmp/.duckdb/extensions'");

      // Install and load MotherDuck extension
      await connection.run("INSTALL 'motherduck'");
      await connection.run("LOAD 'motherduck'");

      // Attach to MotherDuck database
      // Token is sanitized to prevent SQL injection - DuckDB SET doesn't support params
      const sanitizedToken = MOTHERDUCK_TOKEN!.replace(/'/g, "''");
      if (sanitizedToken.includes(';') || sanitizedToken.includes('--')) {
        throw new Error('Invalid characters in MOTHERDUCK_TOKEN');
      }
      await connection.run(`SET motherduck_token='${sanitizedToken}'`);

      // Validate database name is a safe identifier
      if (!isValidIdentifier(MOTHERDUCK_DATABASE)) {
        throw new Error('Invalid MOTHERDUCK_DATABASE name');
      }
      await connection.run(`ATTACH 'md:${MOTHERDUCK_DATABASE}'`);
      await connection.run(`USE ${MOTHERDUCK_DATABASE}`);

      dbLogger.info('Connected to MotherDuck', { database: MOTHERDUCK_DATABASE });
    } finally {
      connection.closeSync();
    }

    initialized = true;
    return instance;
  })();

  return initPromise;
}

/**
 * Convert BigInt values to Numbers in row objects
 */
function convertBigInts<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map(row => {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      converted[key] = typeof value === 'bigint' ? Number(value) : value;
    }
    return converted as T;
  });
}

/**
 * Get a connection with the correct database set
 */
async function getConnection(): Promise<Awaited<ReturnType<DuckDBInstance['connect']>>> {
  await maybeHealthCheck();

  const db = await getInstance();
  const connection = await db.connect();

  // Validate database name before using in SQL
  if (!isValidIdentifier(MOTHERDUCK_DATABASE)) {
    throw new Error('Invalid MOTHERDUCK_DATABASE name');
  }

  // Each connection needs to USE the correct database
  await connection.run(`USE ${MOTHERDUCK_DATABASE}`);

  return connection;
}

/**
 * Execute a SQL query and return typed results
 */
export async function query<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const connection = await getConnection();
      try {
        const reader = await connection.runAndReadAll(sql);
        const rows = reader.getRowObjects() as Record<string, unknown>[];
        return convertBigInts<T>(rows);
      } finally {
        connection.closeSync();
      }
    } catch (error) {
      if (attempt < 2) {
        dbLogger.warn('Query failed, retrying', { attempt }, error as Error);
        await resetConnection();
        continue;
      }
      throw error;
    }
  }
  return [];
}

/**
 * Execute a SQL query with parameters (for prepared statements)
 */
export async function queryWithParams<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | boolean | null)[]
): Promise<T[]> {
  const connection = await getConnection();

  try {
    const stmt = await connection.prepare(sql);

    // Bind parameters
    for (let i = 0; i < params.length; i++) {
      const value = params[i];
      if (value === null) {
        stmt.bindNull(i + 1);
      } else if (typeof value === 'string') {
        stmt.bindVarchar(i + 1, value);
      } else if (typeof value === 'number') {
        if (Number.isInteger(value)) {
          stmt.bindBigInt(i + 1, BigInt(value));
        } else {
          stmt.bindDouble(i + 1, value);
        }
      } else if (typeof value === 'boolean') {
        stmt.bindBoolean(i + 1, value);
      }
    }

    const reader = await stmt.runAndReadAll();
    const rows = reader.getRowObjects() as Record<string, unknown>[];
    return convertBigInts<T>(rows);
  } finally {
    connection.closeSync();
  }
}

/**
 * Execute a SQL statement (INSERT, UPDATE, CREATE, etc.)
 */
export async function execute(sql: string): Promise<void> {
  const connection = await getConnection();

  try {
    await connection.run(sql);
  } finally {
    connection.closeSync();
  }
}

/**
 * Execute multiple SQL statements in a transaction
 */
export async function executeTransaction(statements: string[]): Promise<void> {
  const connection = await getConnection();

  try {
    await connection.run('BEGIN TRANSACTION');
    for (const sql of statements) {
      await connection.run(sql);
    }
    await connection.run('COMMIT');
  } catch (error) {
    await connection.run('ROLLBACK');
    throw error;
  } finally {
    connection.closeSync();
  }
}

/**
 * Insert multiple rows into a table
 */
export async function insertRows(
  tableName: string,
  rows: Record<string, unknown>[]
): Promise<number> {
  if (rows.length === 0) return 0;

  // Validate table name against allowlist
  assertValidTableName(tableName);

  const columns = Object.keys(rows[0]);

  // Validate all column names
  assertValidColumnNames(columns);

  const placeholders = columns.map(() => '?').join(', ');

  const connection = await getConnection();

  try {
    await connection.run('BEGIN TRANSACTION');

    const stmt = await connection.prepare(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`
    );

    let inserted = 0;
    for (const row of rows) {
      columns.forEach((col, i) => {
        const value = row[col];
        if (value === null || value === undefined) {
          stmt.bindNull(i + 1);
        } else if (typeof value === 'string') {
          stmt.bindVarchar(i + 1, value);
        } else if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            stmt.bindBigInt(i + 1, BigInt(value));
          } else {
            stmt.bindDouble(i + 1, value);
          }
        } else if (typeof value === 'boolean') {
          stmt.bindBoolean(i + 1, value);
        }
      });
      await stmt.run();
      inserted++;
    }

    await connection.run('COMMIT');
    return inserted;
  } catch (error) {
    await connection.run('ROLLBACK');
    throw error;
  } finally {
    connection.closeSync();
  }
}

/**
 * Upsert rows (insert or update on conflict)
 * Uses parameterized queries for security
 */
export async function upsertRows(
  tableName: string,
  rows: Record<string, unknown>[],
  conflictColumn: string
): Promise<number> {
  if (rows.length === 0) return 0;

  // Validate table name against allowlist
  assertValidTableName(tableName);

  const columns = Object.keys(rows[0]);

  // Validate all column names
  assertValidColumnNames(columns);
  if (!isValidIdentifier(conflictColumn)) {
    throw new Error(`Invalid conflict column name: "${conflictColumn}"`);
  }

  const updateCols = columns.filter(c => c !== conflictColumn);
  const placeholders = columns.map(() => '?').join(', ');
  const updateSet = updateCols.map(col => `${col} = EXCLUDED.${col}`).join(', ');

  const connection = await getConnection();

  try {
    await connection.run('BEGIN TRANSACTION');

    const stmt = await connection.prepare(`
      INSERT INTO ${tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      ON CONFLICT (${conflictColumn}) DO UPDATE SET ${updateSet}
    `);

    let upserted = 0;
    for (const row of rows) {
      // Bind parameters for each row
      columns.forEach((col, i) => {
        const value = row[col];
        if (value === null || value === undefined) {
          stmt.bindNull(i + 1);
        } else if (typeof value === 'string') {
          stmt.bindVarchar(i + 1, value);
        } else if (typeof value === 'number') {
          if (Number.isInteger(value)) {
            stmt.bindBigInt(i + 1, BigInt(value));
          } else {
            stmt.bindDouble(i + 1, value);
          }
        } else if (typeof value === 'boolean') {
          stmt.bindBoolean(i + 1, value);
        }
      });
      await stmt.run();
      upserted++;
    }

    await connection.run('COMMIT');
    return upserted;
  } catch (error) {
    await connection.run('ROLLBACK');
    throw error;
  } finally {
    connection.closeSync();
  }
}

/**
 * Check if a table exists
 */
export async function tableExists(tableName: string): Promise<boolean> {
  // Validate table name to prevent SQL injection
  if (!isValidIdentifier(tableName)) {
    throw new Error(`Invalid table name: "${tableName}"`);
  }
  try {
    await query(`SELECT 1 FROM ${tableName} LIMIT 1`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get row count from a table
 */
export async function countRows(tableName: string): Promise<number> {
  // Validate table name to prevent SQL injection
  if (!isValidIdentifier(tableName)) {
    throw new Error(`Invalid table name: "${tableName}"`);
  }
  const result = await query<{ count: number }>(`SELECT COUNT(*) as count FROM ${tableName}`);
  return result[0]?.count ?? 0;
}

/**
 * Initialize database schema (creates tables if they don't exist)
 */
export async function initializeSchema(): Promise<void> {
  await execute(`
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

  await execute(`
    CREATE TABLE IF NOT EXISTS submissions_13f (
      ACCESSION_NUMBER VARCHAR PRIMARY KEY,
      CIK VARCHAR,
      SUBMISSIONTYPE VARCHAR,
      PERIODOFREPORT VARCHAR,
      FILING_DATE VARCHAR,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await execute(`
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

  await execute(`
    CREATE INDEX IF NOT EXISTS idx_filings_13dg_date ON filings_13dg(FILING_DATE)
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS idx_submissions_13f_cik ON submissions_13f(CIK)
  `);

  await execute(`
    CREATE INDEX IF NOT EXISTS idx_holdings_13f_accession ON holdings_13f(ACCESSION_NUMBER)
  `);

  // Form 3/4/5 tables
  await execute(`
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

  await execute(`
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

  await execute(`
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

  await execute(`
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

  await execute(`
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

  await execute(`
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

  // CUSIP to ticker mappings table (for OpenFIGI enrichment)
  await execute(`
    CREATE TABLE IF NOT EXISTS ${MOTHERDUCK_DATABASE}.cusip_mappings (
      cusip VARCHAR PRIMARY KEY,
      ticker VARCHAR,
      figi VARCHAR,
      name VARCHAR,
      exch_code VARCHAR,
      security_type VARCHAR,
      market_sector VARCHAR,
      error VARCHAR,
      cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await execute(`CREATE INDEX IF NOT EXISTS idx_cusip_mappings_ticker ON ${MOTHERDUCK_DATABASE}.cusip_mappings(ticker)`);

  // Form 3/4/5 indexes
  await execute(`CREATE INDEX IF NOT EXISTS idx_form345_submissions_ticker ON form345_submissions(ISSUERTRADINGSYMBOL)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_form345_submissions_issuer_cik ON form345_submissions(ISSUERCIK)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_form345_submissions_filing_date ON form345_submissions(FILING_DATE)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_form345_owners_cik ON form345_reporting_owners(RPTOWNERCIK)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_form345_owners_name ON form345_reporting_owners(RPTOWNERNAME)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_form345_nonderiv_trans_date ON form345_nonderiv_trans(TRANS_DATE)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_form345_nonderiv_trans_code ON form345_nonderiv_trans(TRANS_CODE)`);
  await execute(`CREATE INDEX IF NOT EXISTS idx_form345_deriv_trans_date ON form345_deriv_trans(TRANS_DATE)`);

  dbLogger.info('Database schema initialized');
}

/**
 * Reset connection (for testing or after errors)
 */
export async function resetConnection(): Promise<void> {
  dbLogger.info('Resetting database connection');
  initialized = false;
  instance = null;
  initPromise = null;
  lastHealthCheck = 0;
}

/**
 * Execute a function with a database connection (for low-level operations like TSV import)
 * The connection is automatically closed when the function completes.
 */
export async function withConnection<T>(
  fn: (connection: Awaited<ReturnType<DuckDBInstance['connect']>>) => Promise<T>
): Promise<T> {
  const connection = await getConnection();
  try {
    return await fn(connection);
  } finally {
    connection.closeSync();
  }
}
