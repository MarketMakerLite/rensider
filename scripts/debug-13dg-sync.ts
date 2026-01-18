#!/usr/bin/env npx tsx
/**
 * Debug script to understand 13D/G sync failures
 */

import 'dotenv/config';
import { fetchFormIndex, fetchText } from '../lib/sec/client';
import { parseSchedule13Header } from '../lib/sec/schedule13-header-parser';

const SCHEDULE_13_TYPES = ['SC 13D', 'SC 13D/A', 'SC 13G', 'SC 13G/A'];

async function main() {
  console.log('Debug 13D/G Sync');
  console.log('='.repeat(60));

  // Fetch current quarter's index
  const now = new Date();
  const year = now.getFullYear();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);

  console.log(`\nFetching ${year}-Q${quarter} form index...`);
  const index = await fetchFormIndex(year, quarter);
  console.log(`Total filings in index: ${index.length}`);

  // Filter for Schedule 13D/G
  const schedule13 = index.filter(entry =>
    SCHEDULE_13_TYPES.some(ft => entry.formType === ft)
  );
  console.log(`Schedule 13D/G filings: ${schedule13.length}`);

  // Show first 10
  console.log('\nFirst 10 Schedule 13D/G filings:');
  for (const entry of schedule13.slice(0, 10)) {
    console.log(`  ${entry.formType} | ${entry.dateFiled} | ${entry.companyName} | ${entry.fileName}`);
  }

  // Try to fetch and parse one
  if (schedule13.length > 0) {
    const entry = schedule13[0];
    const parts = entry.fileName.split('/');
    const accessionWithDashes = parts[parts.length - 1].replace('.txt', '');
    const accessionNoDashes = accessionWithDashes.replace(/-/g, '');
    const url = `https://www.sec.gov/Archives/edgar/data/${entry.cik}/${accessionNoDashes}/${accessionWithDashes}.txt`;

    console.log(`\nTrying to fetch: ${url}`);
    try {
      const text = await fetchText(url);
      if (!text) {
        console.log('  fetchText returned null');
      } else {
        console.log(`  Got ${text.length} characters`);

        // Try to parse
        const parsed = parseSchedule13Header(text, accessionWithDashes);
        if (parsed) {
          console.log('  Parsed successfully!');
          console.log(`    Form Type: ${parsed.formType}`);
          console.log(`    Filing Date: ${parsed.filingDate}`);
          console.log(`    Issuer: ${parsed.issuerName}`);
          console.log(`    Filer: ${parsed.filedByName}`);
        } else {
          console.log('  parseSchedule13Header returned null');
          // Show SEC-HEADER section for debugging
          const headerMatch = text.match(/<SEC-HEADER>([\s\S]*?)<\/SEC-HEADER>/);
          if (headerMatch) {
            console.log('  SEC-HEADER found, first 500 chars:');
            console.log(headerMatch[1].slice(0, 500));
          } else {
            console.log('  No SEC-HEADER found in document');
            console.log('  First 500 chars of document:');
            console.log(text.slice(0, 500));
          }
        }
      }
    } catch (error) {
      console.error(`  Error: ${error}`);
    }
  }

  // Also check 2025 Q4
  console.log(`\n\nFetching 2025-Q4 form index...`);
  const index2025q4 = await fetchFormIndex(2025, 4);
  const schedule13_2025 = index2025q4.filter(entry =>
    SCHEDULE_13_TYPES.some(ft => entry.formType === ft)
  );
  console.log(`Schedule 13D/G filings in 2025-Q4: ${schedule13_2025.length}`);

  // Show some from 2025
  if (schedule13_2025.length > 0) {
    console.log('\nSample from 2025-Q4:');
    for (const entry of schedule13_2025.slice(0, 5)) {
      console.log(`  ${entry.formType} | ${entry.dateFiled} | ${entry.companyName}`);
    }
  }
}

main().catch(console.error);
