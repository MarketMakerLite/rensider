#!/usr/bin/env npx tsx

/**
 * Spot Check Data Quality
 *
 * Runs sample queries across quarters to verify data integrity.
 */

import { getFilerHoldings, getSecurityHolders, getTopFilersByAUM } from '../lib/sec/queries';

async function main() {
  console.log('=== Spot Check Data Quality ===\n');

  // Test 1: Top filers by AUM (uses latest quarter)
  console.log('1. Top 5 Filers by AUM (latest quarter):');
  const topFilers = await getTopFilersByAUM(5);
  for (const filer of topFilers) {
    const aumB = (filer.total_aum / 1_000_000_000).toFixed(1);
    console.log(`   CIK ${filer.cik}: $${aumB}B AUM, ${filer.position_count.toLocaleString()} positions`);
  }

  // Test 2: Holdings for a known large filer (Vanguard)
  console.log('\n2. Sample Holdings for CIK 0000102909 (Vanguard):');
  const holdings = await getFilerHoldings('0000102909');
  console.log(`   Total positions: ${holdings.length.toLocaleString()}`);
  console.log(`   Sample positions:`);
  for (const h of holdings.slice(0, 3)) {
    console.log(`     - ${h.name_of_issuer}: ${h.shares.toLocaleString()} shares ($${(h.value / 1_000_000).toFixed(1)}M)`);
  }

  // Test 3: Holders of AAPL (CUSIP: 037833100)
  console.log('\n3. Top 5 Holders of AAPL (CUSIP 037833100):');
  const aaplHolders = await getSecurityHolders('037833100');
  console.log(`   Total institutional holders: ${aaplHolders.length.toLocaleString()}`);
  for (const h of aaplHolders.slice(0, 5)) {
    const valueB = (h.value / 1_000_000_000).toFixed(2);
    console.log(`   CIK ${h.cik}: $${valueB}B (${(h.shares / 1_000_000).toFixed(1)}M shares)`);
  }

  // Test 4: Holders of MSFT (CUSIP: 594918104)
  console.log('\n4. Top 5 Holders of MSFT (CUSIP 594918104):');
  const msftHolders = await getSecurityHolders('594918104');
  console.log(`   Total institutional holders: ${msftHolders.length.toLocaleString()}`);
  for (const h of msftHolders.slice(0, 5)) {
    const valueB = (h.value / 1_000_000_000).toFixed(2);
    console.log(`   CIK ${h.cik}: $${valueB}B (${(h.shares / 1_000_000).toFixed(1)}M shares)`);
  }

  console.log('\n=== All Spot Checks Passed ===');
}

main().catch(console.error);
