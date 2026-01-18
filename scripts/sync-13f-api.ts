#!/usr/bin/env npx tsx
/**
 * Sync 13F Data from SEC EDGAR API
 *
 * Uses the SEC EDGAR API to fetch recent 13F filings and their holdings.
 */

import 'dotenv/config';
import { DuckDBInstance } from '@duckdb/node-api';
import pLimit from 'p-limit';

const MOTHERDUCK_TOKEN = process.env.MOTHERDUCK_TOKEN;
const MOTHERDUCK_DATABASE = process.env.MOTHERDUCK_DATABASE || 'rensider';
const SEC_USER_AGENT = process.env.SEC_USER_AGENT || 'Company admin@example.com';

if (!MOTHERDUCK_TOKEN) {
  console.error('Error: MOTHERDUCK_TOKEN environment variable is required');
  process.exit(1);
}

const rateLimiter = pLimit(10);

interface Filing13F {
  accessionNumber: string;
  cik: string;
  companyName: string;
  filingDate: string;
  formType: string;
}

interface Holding13F {
  accessionNumber: string;
  cusip: string;
  nameOfIssuer: string;
  titleOfClass: string;
  value: number;
  shares: number;
  shrsOrPrnAmt: string;
  putCall?: string;
  investmentDiscretion: string;
  votingAuthSole: number;
  votingAuthShared: number;
  votingAuthNone: number;
}

async function fetchWithRetry(url: string, maxRetries = 3): Promise<Response> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': SEC_USER_AGENT,
          'Accept': 'application/json, text/xml, */*',
        },
      });

      if (response.ok) return response;

      if (response.status === 429 || response.status === 503) {
        const delay = Math.pow(2, attempt) * 1000;
        console.warn(`Rate limited, waiting ${delay}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }

      throw new Error(`HTTP ${response.status}`);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)));
    }
  }
  throw new Error('Max retries exceeded');
}

async function fetchRecent13FFilings(startDate: string): Promise<Filing13F[]> {
  const year = new Date().getFullYear();
  const quarter = Math.ceil((new Date().getMonth() + 1) / 3);

  console.log(`Fetching ${year}-Q${quarter} form index...`);

  const indexUrl = `https://www.sec.gov/Archives/edgar/full-index/${year}/QTR${quarter}/form.idx`;
  const response = await fetchWithRetry(indexUrl);
  const text = await response.text();

  const lines = text.split('\n');
  let dataStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].startsWith('---')) {
      dataStart = i + 1;
      break;
    }
  }

  const filings: Filing13F[] = [];
  const startDateObj = new Date(startDate);

  for (let i = dataStart; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const parts = line.split(/\s{2,}/);
    if (parts.length < 5) continue;

    const formType = parts[0].trim();
    if (!formType.startsWith('13F-')) continue;

    const dateFiled = parts[3].trim();
    if (new Date(dateFiled) < startDateObj) continue;

    const fileName = parts[4].trim();
    const pathParts = fileName.split('/');
    const accessionNumber = pathParts[pathParts.length - 1].replace('.txt', '');

    filings.push({
      accessionNumber,
      cik: parts[2].trim(),
      companyName: parts[1].trim(),
      filingDate: dateFiled,
      formType,
    });
  }

  console.log(`Found ${filings.length} 13F filings since ${startDate}`);
  return filings;
}

async function fetch13FHoldings(cik: string, accessionNumber: string): Promise<Holding13F[]> {
  const accessionNoDashes = accessionNumber.replace(/-/g, '');
  const baseUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accessionNoDashes}`;
  const indexUrl = `${baseUrl}/index.json`;

  try {
    const indexResponse = await fetchWithRetry(indexUrl);
    const indexData = await indexResponse.json() as {
      directory: { item: { name: string; type: string }[] }
    };

    const infoTableFile = indexData.directory.item.find((item) =>
      item.name.toLowerCase().includes('infotable') &&
      (item.name.endsWith('.xml') || item.name.endsWith('.XML'))
    );

    if (!infoTableFile) {
      return [];
    }

    const xmlUrl = `${baseUrl}/${infoTableFile.name}`;
    const xmlResponse = await fetchWithRetry(xmlUrl);
    const xmlText = await xmlResponse.text();

    return parseInfoTableXml(xmlText, accessionNumber);
  } catch {
    return [];
  }
}

function parseInfoTableXml(xml: string, accessionNumber: string): Holding13F[] {
  const holdings: Holding13F[] = [];
  const entryPattern = /<infoTable[^>]*>([\s\S]*?)<\/infoTable>/gi;
  let match;

  while ((match = entryPattern.exec(xml)) !== null) {
    const entry = match[1];

    const getValue = (tag: string): string => {
      const tagMatch = entry.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'));
      return tagMatch ? tagMatch[1].trim() : '';
    };

    const getNumValue = (tag: string): number => {
      const val = getValue(tag);
      return val ? parseInt(val.replace(/,/g, ''), 10) || 0 : 0;
    };

    holdings.push({
      accessionNumber,
      cusip: getValue('cusip'),
      nameOfIssuer: getValue('nameOfIssuer'),
      titleOfClass: getValue('titleOfClass'),
      value: getNumValue('value'),
      shares: getNumValue('sshPrnamt') || getNumValue('shrsOrPrnAmt'),
      shrsOrPrnAmt: getValue('sshPrnamtType') || 'SH',
      putCall: getValue('putCall') || undefined,
      investmentDiscretion: getValue('investmentDiscretion'),
      votingAuthSole: getNumValue('Sole') || getNumValue('sole'),
      votingAuthShared: getNumValue('Shared') || getNumValue('shared'),
      votingAuthNone: getNumValue('None') || getNumValue('none'),
    });
  }

  return holdings;
}

async function main() {
  const args = process.argv.slice(2);
  const daysArg = args.find(a => a.startsWith('--days='))?.split('=')[1];
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];

  const days = parseInt(daysArg || '7', 10);
  const limit = parseInt(limitArg || '50', 10);

  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startDateStr = startDate.toISOString().split('T')[0];

  console.log('Sync 13F Data from SEC EDGAR API');
  console.log('='.repeat(50));
  console.log(`Syncing filings from last ${days} days (since ${startDateStr})`);
  console.log(`Processing limit: ${limit} filings`);

  console.log('\nConnecting to MotherDuck...');
  const db = await DuckDBInstance.create(':memory:');
  const conn = await db.connect();

  try {
    await conn.run("INSTALL 'motherduck'");
    await conn.run("LOAD 'motherduck'");
    await conn.run(`SET motherduck_token='${MOTHERDUCK_TOKEN}'`);
    await conn.run(`ATTACH 'md:${MOTHERDUCK_DATABASE}'`);
    await conn.run(`USE ${MOTHERDUCK_DATABASE}`);
    console.log('Connected!');

    const filings = await fetchRecent13FFilings(startDateStr);
    const filingsToProcess = filings.slice(0, limit);

    console.log(`\nProcessing ${filingsToProcess.length} filings...`);

    let processedFilings = 0;
    let processedHoldings = 0;

    for (const filing of filingsToProcess) {
      try {
        const escape = (s: string) => s.replace(/'/g, "''");

        // Check if exists first, then insert if not
        const existsResult = await conn.runAndReadAll(`
          SELECT 1 FROM submissions_13f WHERE ACCESSION_NUMBER = '${escape(filing.accessionNumber)}' LIMIT 1
        `);
        const exists = (existsResult.getRowObjects() as unknown[]).length > 0;

        if (!exists) {
          await conn.run(`
            INSERT INTO submissions_13f
            (ACCESSION_NUMBER, CIK, SUBMISSIONTYPE, PERIODOFREPORT, FILING_DATE)
            VALUES (
              '${escape(filing.accessionNumber)}',
              '${escape(filing.cik)}',
              '${escape(filing.formType)}',
              '',
              '${escape(filing.filingDate)}'
            )
          `);
        }

        processedFilings++;
        process.stdout.write(`\rFilings: ${processedFilings}/${filingsToProcess.length}`);

        const holdings = await rateLimiter(() => fetch13FHoldings(filing.cik, filing.accessionNumber));

        // Insert holdings only if the submission is new
        if (!exists && holdings.length > 0) {
          for (const holding of holdings) {
            try {
              await conn.run(`
                INSERT INTO holdings_13f
                (ACCESSION_NUMBER, CUSIP, NAMEOFISSUER, TITLEOFCLASS, VALUE, SSHPRNAMT,
                 SSHPRNAMTTYPE, PUTCALL, INVESTMENTDISCRETION,
                 VOTING_AUTH_SOLE, VOTING_AUTH_SHARED, VOTING_AUTH_NONE)
                VALUES (
                  '${escape(holding.accessionNumber)}',
                  '${escape(holding.cusip)}',
                  '${escape(holding.nameOfIssuer)}',
                  '${escape(holding.titleOfClass)}',
                  ${holding.value},
                  ${holding.shares},
                  '${escape(holding.shrsOrPrnAmt)}',
                  ${holding.putCall ? `'${escape(holding.putCall)}'` : 'NULL'},
                  '${escape(holding.investmentDiscretion)}',
                  ${holding.votingAuthSole},
                  ${holding.votingAuthShared},
                  ${holding.votingAuthNone}
                )
              `);
              processedHoldings++;
            } catch {
              // Ignore duplicate errors
            }
          }
        }
      } catch (error) {
        console.warn(`\nError processing ${filing.accessionNumber}: ${error}`);
      }
    }

    console.log(`\n\n${'='.repeat(50)}`);
    console.log('Summary');
    console.log('='.repeat(50));
    console.log(`Filings processed: ${processedFilings}`);
    console.log(`Holdings processed: ${processedHoldings}`);

    const subResult = await conn.runAndReadAll('SELECT COUNT(*) as cnt FROM submissions_13f');
    const holdResult = await conn.runAndReadAll('SELECT COUNT(*) as cnt FROM holdings_13f');
    console.log(`\nTotal submissions in DB: ${Number((subResult.getRowObjects() as {cnt: bigint}[])[0]?.cnt).toLocaleString()}`);
    console.log(`Total holdings in DB: ${Number((holdResult.getRowObjects() as {cnt: bigint}[])[0]?.cnt).toLocaleString()}`);

  } finally {
    conn.closeSync();
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});
