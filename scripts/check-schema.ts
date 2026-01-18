import { query, isCloudMode } from '../lib/sec/duckdb';

async function main() {
  console.log('Cloud mode:', isCloudMode());

  try {
    // Check holdings_13f schema
    console.log('\n=== holdings_13f schema ===');
    const holdingsSchema = await query<{column_name: string, data_type: string}>(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'holdings_13f'
      ORDER BY ordinal_position
    `);
    console.log('Columns:', holdingsSchema.map(c => `${c.column_name}: ${c.data_type}`));

    // Check submissions_13f schema
    console.log('\n=== submissions_13f schema ===');
    const submissionsSchema = await query<{column_name: string, data_type: string}>(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'submissions_13f'
      ORDER BY ordinal_position
    `);
    console.log('Columns:', submissionsSchema.map(c => `${c.column_name}: ${c.data_type}`));

    // Sample data from holdings_13f
    console.log('\n=== Sample holdings_13f row ===');
    const sampleHolding = await query(`SELECT * FROM holdings_13f LIMIT 1`);
    console.log(sampleHolding);

    // Sample data from submissions_13f
    console.log('\n=== Sample submissions_13f row ===');
    const sampleSubmission = await query(`SELECT * FROM submissions_13f LIMIT 1`);
    console.log(sampleSubmission);

    // Sample data from form345_submissions
    console.log('\n=== Sample form345_submissions row ===');
    const sampleForm345 = await query(`SELECT * FROM form345_submissions LIMIT 1`);
    console.log(sampleForm345);

  } catch (error: any) {
    console.error('Error:', error.message);
  }

  process.exit(0);
}

main();
