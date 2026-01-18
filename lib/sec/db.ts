import { join } from 'path';
import { createReadStream } from 'fs';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';

export const DATA_DIR = process.env.SEC_DATA_DIR || 'data';

// Parquet file utilities

/**
 * Get relative path for a parquet file (without DATA_DIR prefix)
 * Use with readParquetFile which will add DATA_DIR
 */
export function getParquetPath(category: string, subcategory: string, name: string): string {
  return join(category, subcategory, `${name}.parquet`);
}

/**
 * Get full absolute path for a parquet file (with DATA_DIR prefix)
 * Use for direct file access or glob patterns
 */
export function getParquetFullPath(category: string, subcategory: string, name: string): string {
  return join(DATA_DIR, category, subcategory, `${name}.parquet`);
}

export function getParquetGlob(category: string, subcategory: string, pattern = '*'): string {
  return join(DATA_DIR, category, subcategory, `${pattern}.parquet`);
}

// getDataPath is exported from download.ts

// TSV to Parquet conversion using parquetjs

interface ParquetSchema {
  [key: string]: {
    type: 'UTF8' | 'INT64' | 'DOUBLE' | 'BOOLEAN';
    optional?: boolean;
  };
}

export async function convertTsvToParquet(
  tsvPath: string,
  parquetPath: string,
  schema?: ParquetSchema
): Promise<number> {
  const parquet = await import('parquetjs-lite');
  const { parse } = await import('csv-parse');

  const fullTsvPath = tsvPath.startsWith('/') ? tsvPath : join(DATA_DIR, tsvPath);
  const fullParquetPath = parquetPath.startsWith('/') ? parquetPath : join(DATA_DIR, parquetPath);

  // Ensure output directory exists
  await mkdir(dirname(fullParquetPath), { recursive: true });

  return new Promise((resolve, reject) => {
    const rows: Record<string, unknown>[] = [];
    let headers: string[] = [];
    let inferredSchema: ParquetSchema | null = null;
    let firstRow = true;

    const parser = parse({
      delimiter: '\t',
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
      quote: false,
    });

    createReadStream(fullTsvPath)
      .pipe(parser)
      .on('data', (row: Record<string, string>) => {
        if (firstRow) {
          headers = Object.keys(row);
          // Infer schema from first row if not provided
          if (!schema) {
            inferredSchema = {};
            for (const key of headers) {
              const value = row[key];
              if (/^\d+$/.test(value) && value.length < 15) {
                inferredSchema[key] = { type: 'INT64', optional: true };
              } else if (/^\d+\.\d+$/.test(value)) {
                inferredSchema[key] = { type: 'DOUBLE', optional: true };
              } else {
                inferredSchema[key] = { type: 'UTF8', optional: true };
              }
            }
          }
          firstRow = false;
        }

        // Convert values based on schema
        const convertedRow: Record<string, unknown> = {};
        const schemaToUse = schema || inferredSchema!;

        for (const key of headers) {
          const value = row[key];
          const fieldSchema = schemaToUse[key];

          if (value === '' || value === null || value === undefined) {
            convertedRow[key] = null;
          } else if (fieldSchema?.type === 'INT64') {
            convertedRow[key] = parseInt(value, 10) || 0;
          } else if (fieldSchema?.type === 'DOUBLE') {
            convertedRow[key] = parseFloat(value) || 0;
          } else if (fieldSchema?.type === 'BOOLEAN') {
            convertedRow[key] = value.toLowerCase() === 'true' || value === '1';
          } else {
            convertedRow[key] = value;
          }
        }

        rows.push(convertedRow);
      })
      .on('end', async () => {
        try {
          if (rows.length === 0) {
            resolve(0);
            return;
          }

          const schemaToUse = schema || inferredSchema!;
          // Handle both ESM and CJS module formats
          const parquetLib = parquet.default || parquet;
          const parquetSchema = new parquetLib.ParquetSchema(schemaToUse);
          const writer = await parquetLib.ParquetWriter.openFile(parquetSchema, fullParquetPath);

          for (const row of rows) {
            await writer.appendRow(row);
          }

          await writer.close();
          resolve(rows.length);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

// Schema definitions for SEC data

export const SUBMISSION_SCHEMA: ParquetSchema = {
  ACCESSION_NUMBER: { type: 'UTF8' },
  FILING_DATE: { type: 'UTF8' },
  SUBMISSIONTYPE: { type: 'UTF8' },
  CIK: { type: 'UTF8' },
  PERIODOFREPORT: { type: 'UTF8' },
};

export const COVERPAGE_SCHEMA: ParquetSchema = {
  ACCESSION_NUMBER: { type: 'UTF8' },
  REPORTCALENDARORQUARTER: { type: 'UTF8', optional: true },
  ISAMENDMENT: { type: 'UTF8', optional: true },
  AMENDMENTNO: { type: 'UTF8', optional: true },
  AMENDMENTTYPE: { type: 'UTF8', optional: true },
  FILINGMANAGER_NAME: { type: 'UTF8', optional: true },
  FILINGMANAGER_STREET1: { type: 'UTF8', optional: true },
  FILINGMANAGER_CITY: { type: 'UTF8', optional: true },
  FILINGMANAGER_STATEORCOUNTRY: { type: 'UTF8', optional: true },
  FILINGMANAGER_ZIPCODE: { type: 'UTF8', optional: true },
  REPORTTYPE: { type: 'UTF8', optional: true },
  FORM13FFILENUMBER: { type: 'UTF8', optional: true },
};

export const INFOTABLE_SCHEMA: ParquetSchema = {
  ACCESSION_NUMBER: { type: 'UTF8' },
  INFOTABLE_SK: { type: 'INT64' },
  NAMEOFISSUER: { type: 'UTF8' },
  TITLEOFCLASS: { type: 'UTF8' },
  CUSIP: { type: 'UTF8' },
  FIGI: { type: 'UTF8', optional: true },
  VALUE: { type: 'INT64' },
  SSHPRNAMT: { type: 'INT64' },
  SSHPRNAMTTYPE: { type: 'UTF8' },
  PUTCALL: { type: 'UTF8', optional: true },
  INVESTMENTDISCRETION: { type: 'UTF8' },
  OTHERMANAGER: { type: 'UTF8', optional: true },
  VOTING_AUTH_SOLE: { type: 'INT64' },
  VOTING_AUTH_SHARED: { type: 'INT64' },
  VOTING_AUTH_NONE: { type: 'INT64' },
};

// Query helpers - these return Parquet file data
// Uses DuckDB for efficient SQL queries directly on Parquet files

import { query as duckdbQuery, queryWithParams } from './duckdb';

// Re-export DuckDB query functions
export { duckdbQuery as queryParquet, queryWithParams };

// Legacy function - kept for backward compatibility with TSV conversion tests
// For actual queries, use queryParquet() or queryWithParams() instead
export async function readParquetFile<T = Record<string, unknown>>(
  filePath: string
): Promise<T[]> {
  const fullPath = filePath.startsWith('/') ? filePath : join(DATA_DIR, filePath);
  return duckdbQuery<T>(`SELECT * FROM '${fullPath}'`);
}
