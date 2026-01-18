import { query, isCloudMode } from '../lib/sec/duckdb';

async function main() {
  console.log('Cloud mode:', isCloudMode());

  try {
    console.log('Testing query...');
    const result = await query('SELECT 1 as test');
    console.log('Query result:', result);

    // Check if tables exist
    console.log('\nChecking tables...');
    const tables = await query<{name: string}>(`SHOW TABLES`);
    console.log('Tables:', tables.map(t => t.name));

    // Check all databases and schemas
    console.log('\nChecking schemas...');
    const schemas = await query<{catalog_name: string, schema_name: string}>(`SELECT catalog_name, schema_name FROM information_schema.schemata`);
    console.log('Schemas:', schemas);

    // Check all tables across all schemas
    console.log('\nAll tables in information_schema...');
    const allTables = await query<{table_catalog: string, table_schema: string, table_name: string}>(`
      SELECT table_catalog, table_schema, table_name
      FROM information_schema.tables
      WHERE table_type = 'BASE TABLE'
      ORDER BY table_catalog, table_schema, table_name
    `);
    console.log('All tables:', allTables);

    // Test with qualified table names
    console.log('\nTesting with qualified table name (rensider.form345_submissions)...');
    try {
      const count = await query<{cnt: number}>('SELECT COUNT(*) as cnt FROM rensider.form345_submissions');
      console.log('form345_submissions count:', count[0]?.cnt);

      // Test the query used in insider-sales with qualified names
      console.log('\nTesting insider-sales query with qualified names...');
      const rows = await query<{cnt: number}>(`
        SELECT COUNT(*) as cnt
        FROM rensider.form345_submissions s
        JOIN rensider.form345_reporting_owners r ON s.ACCESSION_NUMBER = r.ACCESSION_NUMBER
        JOIN rensider.form345_nonderiv_trans t ON s.ACCESSION_NUMBER = t.ACCESSION_NUMBER
        WHERE t.TRANS_SHARES IS NOT NULL AND t.TRANS_SHARES > 0
      `);
      console.log('Join query count:', rows[0]?.cnt);
    } catch (error: any) {
      console.error('Qualified query error:', error.message);
    }

    // Test with unqualified table names (should fail because USE isn't persisted)
    console.log('\nTesting with unqualified table name (form345_submissions)...');
    try {
      const count = await query<{cnt: number}>('SELECT COUNT(*) as cnt FROM form345_submissions');
      console.log('Unqualified form345_submissions count:', count[0]?.cnt);
    } catch (error: any) {
      console.error('Unqualified query error:', error.message);
    }
  } catch (error: any) {
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

main();
