#!/usr/bin/env npx tsx
/**
 * Debug 13F data format from SEC
 */

import 'dotenv/config';
import { mkdir, rm, writeFile, readFile } from 'fs/promises';
import { createReadStream } from 'fs';
import { join } from 'path';
import unzipper from 'unzipper';

const SEC_USER_AGENT = process.env.SEC_USER_AGENT || 'Company admin@example.com';
const SEC_BASE_URL = 'https://www.sec.gov/files/structureddata/data/form-13f-data-sets';

async function main() {
  // Try 2024 Q4 which should be available
  const year = 2024;
  const quarter = 4;
  const zipFilename = `${year}q${quarter}_form13f.zip`;
  const zipUrl = `${SEC_BASE_URL}/${zipFilename}`;

  const tempDir = join('/tmp/claude', `13f-debug-${Date.now()}`);
  const zipPath = join(tempDir, zipFilename);
  const extractDir = join(tempDir, 'extracted');

  try {
    await mkdir(tempDir, { recursive: true });

    console.log(`Downloading ${zipUrl}...`);
    const response = await fetch(zipUrl, {
      headers: { 'User-Agent': SEC_USER_AGENT },
    });

    if (!response.ok) {
      console.error(`Failed: HTTP ${response.status}`);
      return;
    }

    const buffer = await response.arrayBuffer();
    await writeFile(zipPath, Buffer.from(buffer));
    console.log(`Downloaded ${(buffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

    // Extract
    console.log('Extracting...');
    await mkdir(extractDir, { recursive: true });
    await new Promise<void>((resolve, reject) => {
      createReadStream(zipPath)
        .pipe(unzipper.Extract({ path: extractDir }))
        .on('close', resolve)
        .on('error', reject);
    });

    // Read first few lines of SUBMISSION.tsv
    const submissionPath = join(extractDir, 'SUBMISSION.tsv');
    const content = await readFile(submissionPath, 'utf-8');
    const lines = content.split('\n').slice(0, 6);

    console.log('\n=== SUBMISSION.tsv ===');
    console.log('Header:');
    console.log(lines[0]);
    console.log('\nFirst 5 data rows:');
    for (let i = 1; i < lines.length; i++) {
      console.log(lines[i]);
    }

    // Parse and show structure
    const headers = lines[0].split('\t');
    console.log('\n=== Column Analysis ===');
    console.log(`Number of columns: ${headers.length}`);
    headers.forEach((h, i) => {
      console.log(`  ${i}: ${h}`);
    });

    // Show a sample as object
    const row = lines[1].split('\t');
    console.log('\n=== Sample Row as Object ===');
    headers.forEach((h, i) => {
      console.log(`  ${h}: ${row[i]}`);
    });

  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

main().catch(console.error);
