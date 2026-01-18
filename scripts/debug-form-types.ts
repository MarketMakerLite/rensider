#!/usr/bin/env npx tsx
/**
 * Debug script to check form types in index
 */

import 'dotenv/config';
import { fetchFormIndex } from '../lib/sec/client';

async function main() {
  console.log('Checking form types in SEC index');
  console.log('='.repeat(60));

  // Fetch current quarter's index
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);

  console.log(`\nFetching ${year}-Q${quarter} form index...`);
  const index = await fetchFormIndex(year, quarter);
  console.log(`Total filings: ${index.length}`);

  // Count form types
  const formTypeCounts = new Map<string, number>();
  for (const entry of index) {
    const count = formTypeCounts.get(entry.formType) || 0;
    formTypeCounts.set(entry.formType, count + 1);
  }

  // Sort by count descending
  const sorted = [...formTypeCounts.entries()].sort((a, b) => b[1] - a[1]);

  console.log('\nTop 30 form types:');
  for (const [formType, count] of sorted.slice(0, 30)) {
    console.log(`  ${formType}: ${count}`);
  }

  // Check specifically for 13-related forms
  console.log('\n13-related forms:');
  for (const [formType, count] of sorted) {
    if (formType.includes('13')) {
      console.log(`  ${formType}: ${count}`);
    }
  }

  // Show a sample entry
  console.log('\nSample entry:');
  console.log(JSON.stringify(index[0], null, 2));
}

main().catch(console.error);
