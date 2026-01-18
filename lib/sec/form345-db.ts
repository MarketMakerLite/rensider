/**
 * Form 3/4/5 Database Access
 *
 * Query functions for insider trading data (Form 3, 4, 5).
 * Uses the centralized DuckDB/MotherDuck connection from duckdb.ts.
 */

import {
  query,
  queryWithParams,
  execute,
  initializeSchema,
  isCloudMode,
} from './duckdb';

/**
 * Initialize Form 3/4/5 schema (part of the centralized schema now)
 */
export async function initForm345Schema(): Promise<void> {
  await initializeSchema();
}

/**
 * Execute a SQL query and return typed results
 */
export async function queryForm345<T = Record<string, unknown>>(sql: string): Promise<T[]> {
  return query<T>(sql);
}

/**
 * Execute a SQL query with parameters
 */
export async function queryForm345WithParams<T = Record<string, unknown>>(
  sql: string,
  params: (string | number | boolean | null)[]
): Promise<T[]> {
  return queryWithParams<T>(sql, params);
}

/**
 * Execute a SQL statement that doesn't return results
 */
export async function executeForm345(sql: string): Promise<void> {
  return execute(sql);
}

/**
 * Bulk insert data from a TSV file into a table
 */
export async function insertFromTSV(
  tableName: string,
  tsvPath: string
): Promise<number> {
  // Use INSERT OR IGNORE to skip duplicates
  const sql = `
    INSERT OR IGNORE INTO ${tableName}
    SELECT *
    FROM read_csv_auto('${tsvPath}', delim='\t', header=true, ignore_errors=true)
  `;

  await execute(sql);

  // Get row count
  const result = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM ${tableName}`
  );
  return result[0]?.cnt ?? 0;
}

/**
 * Get table row count
 */
export async function getTableCount(tableName: string): Promise<number> {
  const result = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM ${tableName}`
  );
  return result[0]?.cnt ?? 0;
}

/**
 * Get database stats
 */
export async function getForm345Stats(): Promise<{
  submissions: number;
  reportingOwners: number;
  nonderivTrans: number;
  nonderivHolding: number;
  derivTrans: number;
  derivHolding: number;
}> {
  const [submissions, reportingOwners, nonderivTrans, nonderivHolding, derivTrans, derivHolding] =
    await Promise.all([
      getTableCount('form345_submissions'),
      getTableCount('form345_reporting_owners'),
      getTableCount('form345_nonderiv_trans'),
      getTableCount('form345_nonderiv_holding'),
      getTableCount('form345_deriv_trans'),
      getTableCount('form345_deriv_holding'),
    ]);

  return {
    submissions,
    reportingOwners,
    nonderivTrans,
    nonderivHolding,
    derivTrans,
    derivHolding,
  };
}

/**
 * Check if we're using MotherDuck cloud mode
 */
export { isCloudMode };

/**
 * Table name to TSV file mapping
 */
export const TABLE_TSV_MAPPING = {
  form345_submissions: 'SUBMISSION.tsv',
  form345_reporting_owners: 'REPORTINGOWNER.tsv',
  form345_nonderiv_trans: 'NONDERIV_TRANS.tsv',
  form345_nonderiv_holding: 'NONDERIV_HOLDING.tsv',
  form345_deriv_trans: 'DERIV_TRANS.tsv',
  form345_deriv_holding: 'DERIV_HOLDING.tsv',
} as const;
