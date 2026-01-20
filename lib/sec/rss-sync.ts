/**
 * SEC RSS Feed Sync
 *
 * Fetches and parses SEC EDGAR RSS/Atom feeds for real-time filing updates.
 * The SEC updates these feeds every 10 minutes during business hours.
 *
 * Feed URL pattern:
 * https://www.sec.gov/cgi-bin/browse-edgar?action=getcurrent&type={form}&count=100&output=atom
 */

import { fetchFromSEC, fetchText, decodeHtmlEntities } from './client';
import {
  readSyncState,
  markSyncStarted,
  markSyncComplete,
  markSyncFailed,
} from './sync-state';
import {
  parseSchedule13Header,
  headerToFilingRecord,
} from './schedule13-header-parser';
import { upsertRows, initializeSchema, isCloudMode } from './duckdb';

// RSS Feed entry parsed from Atom XML
export interface RSSFeedEntry {
  formType: string;
  title: string;
  cik: string;
  companyName: string;
  accessionNumber: string;
  filingDate: string;
  updated: string;
  link: string;
  size: string;
}

export interface RSSFeedResult {
  title: string;
  updated: string;
  entries: RSSFeedEntry[];
}

export interface RSSSyncOptions {
  formTypes: string[];
  count?: number;
  dryRun?: boolean;
  force?: boolean;
}

export interface RSSSyncResult {
  processed: number;
  failed: number;
  skipped: number;
  message?: string;
}

const SEC_RSS_BASE = 'https://www.sec.gov/cgi-bin/browse-edgar';

/**
 * Escape a value for safe SQL insertion
 * Handles strings, numbers, null, and undefined
 */
function escapeSqlValue(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) return 'NULL';
    return String(v);
  }
  if (typeof v === 'boolean') return v ? '1' : '0';
  // Escape single quotes by doubling them
  return `'${String(v).replace(/'/g, "''")}'`;
}

/**
 * Build RSS feed URL for a specific form type
 */
export function buildRSSFeedUrl(formType: string, count = 100): string {
  const params = new URLSearchParams({
    action: 'getcurrent',
    type: formType,
    count: String(count),
    owner: 'include',
    output: 'atom',
  });
  return `${SEC_RSS_BASE}?${params.toString()}`;
}

/**
 * Parse SEC Atom feed XML into structured entries
 */
export function parseAtomFeed(xml: string): RSSFeedResult {
  const entries: RSSFeedEntry[] = [];

  // Extract feed metadata
  const feedTitleMatch = xml.match(/<title>([^<]+)<\/title>/);
  const feedUpdatedMatch = xml.match(/<updated>([^<]+)<\/updated>/);

  // Parse each entry
  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g;
  let match;

  while ((match = entryRegex.exec(xml)) !== null) {
    const entryXml = match[1];

    // Extract title: "4 - HANDLER RICHARD B (0001211677) (Reporting)"
    const titleMatch = entryXml.match(/<title>([^<]+)<\/title>/);
    const title = titleMatch?.[1] || '';

    // Parse title to extract form type, company name, CIK
    const titleParts = title.match(/^([^\s-]+(?:\s*\/\s*[A-Z])?)\s*-\s*(.+?)\s*\((\d+)\)/);
    const formType = titleParts?.[1]?.trim() || '';
    const companyName = decodeHtmlEntities(titleParts?.[2]?.trim() || '');
    const cik = titleParts?.[3] || '';

    // Extract link
    const linkMatch = entryXml.match(/<link[^>]+href="([^"]+)"/);
    const link = linkMatch?.[1] || '';

    // Extract summary: "&lt;b&gt;Filed:&lt;/b&gt; 2026-01-16 &lt;b&gt;AccNo:&lt;/b&gt; 0001214659-26-000611"
    const summaryMatch = entryXml.match(/<summary[^>]*>([\s\S]*?)<\/summary>/);
    const summary = summaryMatch?.[1] || '';

    // Parse summary fields (HTML entities are encoded as &lt; &gt;)
    const filedMatch = summary.match(/Filed:(?:&lt;\/b&gt;|<\/b>)\s*(\d{4}-\d{2}-\d{2})/);
    // Accession number format: 0001234567-YY-NNNNNN (flexible digit counts)
    const accNoMatch = summary.match(/AccNo:(?:&lt;\/b&gt;|<\/b>)\s*(\d{10}-\d{2}-\d{6})/);
    const sizeMatch = summary.match(/Size:(?:&lt;\/b&gt;|<\/b>)\s*([^<&\n]+)/);

    const filingDate = filedMatch?.[1] || '';
    const accessionNumber = accNoMatch?.[1] || '';
    const size = sizeMatch?.[1]?.trim() || '';

    // Extract updated timestamp
    const updatedMatch = entryXml.match(/<updated>([^<]+)<\/updated>/);
    const updated = updatedMatch?.[1] || '';

    // Extract form type from category if not in title
    const categoryMatch = entryXml.match(/<category[^>]+term="([^"]+)"/);
    const categoryFormType = categoryMatch?.[1] || formType;

    if (accessionNumber && cik) {
      entries.push({
        formType: categoryFormType || formType,
        title,
        cik,
        companyName,
        accessionNumber,
        filingDate,
        updated,
        link,
        size,
      });
    }
  }

  return {
    title: feedTitleMatch?.[1] || 'SEC RSS Feed',
    updated: feedUpdatedMatch?.[1] || new Date().toISOString(),
    entries,
  };
}

/**
 * Fetch RSS feed for a specific form type
 */
export async function fetchRSSFeed(formType: string, count = 100): Promise<RSSFeedResult> {
  const url = buildRSSFeedUrl(formType, count);
  const response = await fetchFromSEC(url, {
    headers: {
      Accept: 'application/atom+xml, application/xml, text/xml',
    },
  });
  const xml = await response.text();
  return parseAtomFeed(xml);
}

/**
 * Fetch submission text file for a filing
 */
async function fetchSubmissionText(cik: string, accessionNumber: string): Promise<string | null> {
  try {
    const normalizedCik = normalizeCik(cik);
    const accessionNoDashes = accessionNumber.replace(/-/g, '');
    const url = `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${accessionNoDashes}/${accessionNumber}.txt`;
    return await fetchText(url);
  } catch {
    return null;
  }
}

/**
 * Sync Schedule 13D/13G filings from RSS feed
 */
export async function syncSchedule13FromRSS(options: RSSSyncOptions): Promise<RSSSyncResult> {
  const source = 'rss-sync-13dg';
  const result: RSSSyncResult = { processed: 0, failed: 0, skipped: 0 };

  // Check last sync state
  const syncState = await readSyncState();
  const state = syncState[source];

  // For RSS sync, we track the last accession number processed
  const lastAccession = state?.lastAccessionNumber;

  if (options.dryRun) {
    console.log('Dry run mode - fetching feed without processing...');
  }

  try {
    if (!options.dryRun) {
      await markSyncStarted(source);

      // Ensure schema exists (only needed when actually writing)
      if (isCloudMode()) {
        await initializeSchema();
      }
    }

    // Fetch RSS feeds for Schedule 13D/13G
    const formTypes = options.formTypes.length > 0
      ? options.formTypes
      : ['SC 13D', 'SC 13D/A', 'SC 13G', 'SC 13G/A'];

    const allEntries: RSSFeedEntry[] = [];

    for (const formType of formTypes) {
      console.log(`Fetching RSS feed for ${formType}...`);
      try {
        const feed = await fetchRSSFeed(formType, options.count || 100);
        console.log(`  Found ${feed.entries.length} entries`);
        allEntries.push(...feed.entries);
      } catch (error) {
        console.error(`  Error fetching ${formType} feed:`, error);
      }
    }

    if (allEntries.length === 0) {
      const msg = 'No entries found in RSS feeds';
      if (!options.dryRun) {
        await markSyncComplete(source, new Date().toISOString().split('T')[0]);
      }
      return { ...result, message: msg };
    }

    // Deduplicate by accession number (same filing can appear for issuer and filer)
    const uniqueEntries = new Map<string, RSSFeedEntry>();
    for (const entry of allEntries) {
      if (!uniqueEntries.has(entry.accessionNumber)) {
        uniqueEntries.set(entry.accessionNumber, entry);
      }
    }

    console.log(`Processing ${uniqueEntries.size} unique filings...`);

    // Sort by filing date (oldest first) to process in order
    const sortedEntries = Array.from(uniqueEntries.values()).sort(
      (a, b) => a.filingDate.localeCompare(b.filingDate)
    );

    // Find where to start processing (skip already processed)
    let startIndex = 0;
    if (lastAccession && !options.force) {
      const lastIdx = sortedEntries.findIndex(e => e.accessionNumber === lastAccession);
      if (lastIdx >= 0) {
        startIndex = lastIdx + 1;
        result.skipped = startIndex;
      }
    }

    if (options.dryRun) {
      const toProcess = sortedEntries.length - startIndex;
      return {
        ...result,
        processed: toProcess,
        skipped: startIndex,
        message: `Dry run: would process ${toProcess} filings, skip ${startIndex}`,
      };
    }

    // Process new filings
    const filingRecords: Record<string, unknown>[] = [];
    let latestDate = state?.lastProcessedDate || '';
    let latestAccession = lastAccession || '';

    for (let i = startIndex; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];

      try {
        // Fetch submission text file
        const submissionText = await fetchSubmissionText(entry.cik, entry.accessionNumber);

        if (!submissionText) {
          result.failed++;
          continue;
        }

        // Parse SEC header
        const parsed = parseSchedule13Header(submissionText, entry.accessionNumber);

        if (!parsed) {
          result.failed++;
          continue;
        }

        // Convert to record
        const record = headerToFilingRecord(parsed);
        filingRecords.push(record);

        if (entry.filingDate > latestDate) {
          latestDate = entry.filingDate;
        }
        latestAccession = entry.accessionNumber;
        result.processed++;

        // Log progress every 10 filings
        if (result.processed % 10 === 0) {
          console.log(`  Processed ${result.processed} filings...`);
        }

      } catch (error) {
        console.error(`Error processing ${entry.accessionNumber}: ${error}`);
        result.failed++;
      }
    }

    // Insert records into database
    if (filingRecords.length > 0) {
      await upsertRows('filings_13dg', filingRecords, 'ACCESSION_NUMBER');
      console.log(`Inserted ${filingRecords.length} 13D/G filings into database`);
    }

    await markSyncComplete(source, latestDate, latestAccession);
    result.message = `Processed ${result.processed}, failed ${result.failed}, skipped ${result.skipped}`;

  } catch (error) {
    if (!options.dryRun) {
      await markSyncFailed(source, error as Error);
    }
    throw error;
  }

  return result;
}

// 13F Holdings interface
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

/**
 * Strip leading zeros from CIK for SEC file paths
 */
function normalizeCik(cik: string): string {
  return cik.replace(/^0+/, '') || '0';
}

/**
 * Fetch the filing index to find the infotable XML file
 */
async function fetchFilingIndex(cik: string, accessionNumber: string): Promise<{ name: string; type: string }[] | null> {
  try {
    const normalizedCik = normalizeCik(cik);
    const accessionNoDashes = accessionNumber.replace(/-/g, '');
    const url = `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${accessionNoDashes}/index.json`;
    const response = await fetchFromSEC(url);
    const data = await response.json() as { directory: { item: { name: string; type: string }[] } };
    return data.directory.item;
  } catch {
    return null;
  }
}

/**
 * Parse 13F infotable XML to extract holdings
 * Searches both XML <infoTable> tags and namespace-prefixed variants
 */
function parseInfoTableXml(xml: string, accessionNumber: string): Holding13F[] {
  const holdings: Holding13F[] = [];

  // Helper to extract and decode values (case-insensitive, with optional namespace)
  const getValue = (entry: string, tag: string): string => {
    // Try without namespace first, then with common ns1: prefix
    const patterns = [
      new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`, 'i'),
      new RegExp(`<\\w+:${tag}[^>]*>([^<]*)</\\w+:${tag}>`, 'i'),
    ];
    for (const pattern of patterns) {
      const tagMatch = entry.match(pattern);
      if (tagMatch) return decodeHtmlEntities(tagMatch[1].trim());
    }
    return '';
  };

  const getNumValue = (entry: string, tag: string): number => {
    const val = getValue(entry, tag);
    if (!val) return 0;
    // Use Number() instead of parseInt() to avoid precision loss for large share counts
    const num = Number(val.replace(/,/g, ''));
    return Number.isFinite(num) ? num : 0;
  };

  // Match both <infoTable> and namespace-prefixed variants like <ns1:infoTable>
  const entryPattern = /<(?:\w+:)?infoTable[^>]*>([\s\S]*?)<\/(?:\w+:)?infoTable>/gi;
  let match;

  while ((match = entryPattern.exec(xml)) !== null) {
    const entry = match[1];
    holdings.push({
      accessionNumber,
      cusip: getValue(entry, 'cusip'),
      nameOfIssuer: getValue(entry, 'nameOfIssuer'),
      titleOfClass: getValue(entry, 'titleOfClass'),
      value: getNumValue(entry, 'value'),
      shares: getNumValue(entry, 'sshPrnamt') || getNumValue(entry, 'shrsOrPrnAmt'),
      shrsOrPrnAmt: getValue(entry, 'sshPrnamtType') || 'SH',
      putCall: getValue(entry, 'putCall') || undefined,
      investmentDiscretion: getValue(entry, 'investmentDiscretion'),
      votingAuthSole: getNumValue(entry, 'Sole') || getNumValue(entry, 'sole'),
      votingAuthShared: getNumValue(entry, 'Shared') || getNumValue(entry, 'shared'),
      votingAuthNone: getNumValue(entry, 'None') || getNumValue(entry, 'none'),
    });
  }

  return holdings;
}

/**
 * Fetch all 13F data (period of report + holdings) in one call
 */
async function fetch13FData(cik: string, accessionNumber: string): Promise<{
  periodOfReport: string;
  holdings: Holding13F[];
}> {
  const items = await fetchFilingIndex(cik, accessionNumber);
  if (!items) return { periodOfReport: '', holdings: [] };

  const normalizedCik = normalizeCik(cik);
  const accessionNoDashes = accessionNumber.replace(/-/g, '');
  let periodOfReport = '';
  let holdings: Holding13F[] = [];

  // Find and fetch primary document for period of report
  const primaryDoc = items.find((item) =>
    (item.name.toLowerCase().includes('primary') ||
     item.name.toLowerCase().startsWith('form13f')) &&
    item.name.endsWith('.xml')
  );

  if (primaryDoc) {
    try {
      const url = `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${accessionNoDashes}/${primaryDoc.name}`;
      const xml = await fetchText(url);
      const periodMatch = xml.match(/<periodOfReport>([^<]+)<\/periodOfReport>/i);
      periodOfReport = periodMatch?.[1] || '';
    } catch {
      // Continue without period
    }
  }

  // Find and fetch infotable for holdings
  const infoTableFile = items.find((item) =>
    item.name.toLowerCase().includes('infotable') &&
    (item.name.endsWith('.xml') || item.name.endsWith('.XML'))
  );

  if (infoTableFile) {
    try {
      const url = `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${accessionNoDashes}/${infoTableFile.name}`;
      const xml = await fetchText(url);
      holdings = parseInfoTableXml(xml, accessionNumber);
    } catch {
      // Continue without holdings
    }
  }

  return { periodOfReport, holdings };
}

/**
 * Sync Form 13F filings from RSS feed
 */
export async function sync13FFromRSS(options: RSSSyncOptions): Promise<RSSSyncResult> {
  const source = 'rss-sync-13f';
  const result: RSSSyncResult = { processed: 0, failed: 0, skipped: 0 };

  const syncState = await readSyncState();
  const state = syncState[source];
  const lastAccession = state?.lastAccessionNumber;

  if (options.dryRun) {
    console.log('Dry run mode - fetching feed without processing...');
  }

  try {
    if (!options.dryRun) {
      await markSyncStarted(source);

      if (isCloudMode()) {
        await initializeSchema();
      }
    }

    // Fetch RSS feeds for 13F
    const formTypes = options.formTypes.length > 0
      ? options.formTypes
      : ['13F-HR', '13F-HR/A'];

    const allEntries: RSSFeedEntry[] = [];

    for (const formType of formTypes) {
      console.log(`Fetching RSS feed for ${formType}...`);
      try {
        const feed = await fetchRSSFeed(formType, options.count || 100);
        console.log(`  Found ${feed.entries.length} entries`);
        allEntries.push(...feed.entries);
      } catch (error) {
        console.error(`  Error fetching ${formType} feed:`, error);
      }
    }

    if (allEntries.length === 0) {
      const msg = 'No entries found in RSS feeds';
      if (!options.dryRun) {
        await markSyncComplete(source, new Date().toISOString().split('T')[0]);
      }
      return { ...result, message: msg };
    }

    // Deduplicate by accession number
    const uniqueEntries = new Map<string, RSSFeedEntry>();
    for (const entry of allEntries) {
      if (!uniqueEntries.has(entry.accessionNumber)) {
        uniqueEntries.set(entry.accessionNumber, entry);
      }
    }

    console.log(`Processing ${uniqueEntries.size} unique filings...`);

    const sortedEntries = Array.from(uniqueEntries.values()).sort(
      (a, b) => a.filingDate.localeCompare(b.filingDate)
    );

    let startIndex = 0;
    if (lastAccession && !options.force) {
      const lastIdx = sortedEntries.findIndex(e => e.accessionNumber === lastAccession);
      if (lastIdx >= 0) {
        startIndex = lastIdx + 1;
        result.skipped = startIndex;
      }
    }

    if (options.dryRun) {
      const toProcess = sortedEntries.length - startIndex;
      return {
        ...result,
        processed: toProcess,
        skipped: startIndex,
        message: `Dry run: would process ${toProcess} filings, skip ${startIndex}`,
      };
    }

    // Process new filings
    const submissionRecords: Record<string, unknown>[] = [];
    const holdingsRecords: Record<string, unknown>[] = [];
    let latestDate = state?.lastProcessedDate || '';
    let latestAccession = lastAccession || '';

    for (let i = startIndex; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];

      try {
        // Fetch period of report and holdings in one call
        const { periodOfReport, holdings } = await fetch13FData(entry.cik, entry.accessionNumber);

        // Create submission record
        submissionRecords.push({
          ACCESSION_NUMBER: entry.accessionNumber,
          CIK: normalizeCik(entry.cik),
          SUBMISSIONTYPE: entry.formType,
          PERIODOFREPORT: periodOfReport,
          FILING_DATE: entry.filingDate,
          FILER_NAME: entry.companyName || null,
        });

        for (const holding of holdings) {
          holdingsRecords.push({
            ACCESSION_NUMBER: holding.accessionNumber,
            CUSIP: holding.cusip,
            NAMEOFISSUER: holding.nameOfIssuer,
            TITLEOFCLASS: holding.titleOfClass,
            VALUE: holding.value,
            SSHPRNAMT: holding.shares,
            SSHPRNAMTTYPE: holding.shrsOrPrnAmt,
            PUTCALL: holding.putCall || null,
            INVESTMENTDISCRETION: holding.investmentDiscretion,
            VOTING_AUTH_SOLE: holding.votingAuthSole,
            VOTING_AUTH_SHARED: holding.votingAuthShared,
            VOTING_AUTH_NONE: holding.votingAuthNone,
          });
        }

        if (entry.filingDate > latestDate) {
          latestDate = entry.filingDate;
        }
        latestAccession = entry.accessionNumber;
        result.processed++;

        if (result.processed % 5 === 0) {
          console.log(`  Processed ${result.processed} filings (${holdingsRecords.length} holdings)...`);
        }

      } catch (error) {
        console.error(`Error processing ${entry.accessionNumber}: ${error}`);
        result.failed++;
      }
    }

    // Insert records into database
    if (submissionRecords.length > 0) {
      await upsertRows('submissions_13f', submissionRecords, 'ACCESSION_NUMBER');
      console.log(`Inserted ${submissionRecords.length} 13F submissions`);
    }

    if (holdingsRecords.length > 0) {
      // Use execute to insert with INSERT OR IGNORE for duplicates
      const { execute } = await import('./duckdb');
      for (const holding of holdingsRecords) {
        try {
          const cols = Object.keys(holding);
          const vals = cols.map(c => escapeSqlValue(holding[c]));
          await execute(`INSERT OR IGNORE INTO holdings_13f (${cols.join(', ')}) VALUES (${vals.join(', ')})`);
        } catch {
          // Ignore individual insert errors
        }
      }
      console.log(`Inserted ${holdingsRecords.length} 13F holdings`);
    }

    await markSyncComplete(source, latestDate, latestAccession);
    result.message = `Processed ${result.processed} filings (${holdingsRecords.length} holdings), failed ${result.failed}, skipped ${result.skipped}`;

  } catch (error) {
    if (!options.dryRun) {
      await markSyncFailed(source, error as Error);
    }
    throw error;
  }

  return result;
}

// Form 345 parsed data interfaces
interface Form345Submission {
  accessionNumber: string;
  filingDate: string;
  periodOfReport: string;
  documentType: string;
  issuerCik: string;
  issuerName: string;
  issuerTradingSymbol: string;
  noSecuritiesOwned: string;
  notSubjectSec16: string;
  remarks: string;
}

interface Form345ReportingOwner {
  accessionNumber: string;
  rptOwnerCik: string;
  rptOwnerName: string;
  rptOwnerRelationship: string;
  rptOwnerTitle: string;
  rptOwnerStreet1: string;
  rptOwnerCity: string;
  rptOwnerState: string;
  rptOwnerZipCode: string;
}

interface Form345NonDerivTrans {
  accessionNumber: string;
  nonderivTransSk: number;
  securityTitle: string;
  transDate: string;
  transCode: string;
  transShares: number;
  transPricePerShare: number;
  transAcquiredDispCd: string;
  shrsOwndFollwngTrans: number;
  directIndirectOwnership: string;
}

interface Form345NonDerivHolding {
  accessionNumber: string;
  nonderivHoldingSk: number;
  securityTitle: string;
  shrsOwndFollwngTrans: number;
  directIndirectOwnership: string;
}

/**
 * Parse Form 3/4/5 XML document
 */
function parseForm345Xml(xml: string, accessionNumber: string, filingDate: string): {
  submission: Form345Submission;
  owners: Form345ReportingOwner[];
  nonderivTrans: Form345NonDerivTrans[];
  nonderivHoldings: Form345NonDerivHolding[];
} | null {
  try {
    const getValue = (pattern: RegExp): string => {
      const match = xml.match(pattern);
      return match?.[1]?.trim() ? decodeHtmlEntities(match[1].trim()) : '';
    };

    // Parse issuer info
    const issuerCik = getValue(/<issuerCik>([^<]*)<\/issuerCik>/i);
    const issuerName = getValue(/<issuerName>([^<]*)<\/issuerName>/i);
    const issuerTradingSymbol = getValue(/<issuerTradingSymbol>([^<]*)<\/issuerTradingSymbol>/i);

    // Parse document info
    const periodOfReport = getValue(/<periodOfReport>([^<]*)<\/periodOfReport>/i);
    const documentType = getValue(/<documentType>([^<]*)<\/documentType>/i);
    const noSecuritiesOwned = getValue(/<noSecuritiesOwned>([^<]*)<\/noSecuritiesOwned>/i);
    const notSubjectSec16 = getValue(/<notSubjectToSection16>([^<]*)<\/notSubjectToSection16>/i);
    const remarks = getValue(/<remarks>([^<]*)<\/remarks>/i);

    if (!issuerCik) return null;

    const submission: Form345Submission = {
      accessionNumber,
      filingDate,
      periodOfReport,
      documentType,
      issuerCik,
      issuerName,
      issuerTradingSymbol,
      noSecuritiesOwned: noSecuritiesOwned || '0',
      notSubjectSec16: notSubjectSec16 || '0',
      remarks,
    };

    // Parse reporting owners
    const owners: Form345ReportingOwner[] = [];
    const ownerPattern = /<reportingOwner>([\s\S]*?)<\/reportingOwner>/gi;
    let ownerMatch;

    while ((ownerMatch = ownerPattern.exec(xml)) !== null) {
      const ownerXml = ownerMatch[1];
      const getOwnerValue = (tag: string): string => {
        const match = ownerXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
        return match?.[1]?.trim() ? decodeHtmlEntities(match[1].trim()) : '';
      };

      owners.push({
        accessionNumber,
        rptOwnerCik: getOwnerValue('rptOwnerCik'),
        rptOwnerName: getOwnerValue('rptOwnerName'),
        rptOwnerRelationship: [
          getOwnerValue('isDirector') === '1' ? 'Director' : '',
          getOwnerValue('isOfficer') === '1' ? 'Officer' : '',
          getOwnerValue('isTenPercentOwner') === '1' ? '10% Owner' : '',
          getOwnerValue('isOther') === '1' ? 'Other' : '',
        ].filter(Boolean).join(', '),
        rptOwnerTitle: getOwnerValue('officerTitle'),
        rptOwnerStreet1: getOwnerValue('rptOwnerStreet1'),
        rptOwnerCity: getOwnerValue('rptOwnerCity'),
        rptOwnerState: getOwnerValue('rptOwnerState'),
        rptOwnerZipCode: getOwnerValue('rptOwnerZipCode'),
      });
    }

    // Parse non-derivative transactions
    const nonderivTrans: Form345NonDerivTrans[] = [];
    const transPattern = /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/gi;
    let transMatch;
    let transSk = 1;

    while ((transMatch = transPattern.exec(xml)) !== null) {
      const transXml = transMatch[1];
      const getTransValue = (tag: string): string => {
        const match = transXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
        return match?.[1]?.trim() ? decodeHtmlEntities(match[1].trim()) : '';
      };
      const getTransNum = (tag: string): number => {
        const val = getTransValue(tag);
        return val ? parseFloat(val.replace(/,/g, '')) || 0 : 0;
      };

      nonderivTrans.push({
        accessionNumber,
        nonderivTransSk: transSk++,
        securityTitle: getTransValue('securityTitle'),
        transDate: getTransValue('transactionDate'),
        transCode: getTransValue('transactionCode'),
        transShares: getTransNum('transactionShares'),
        transPricePerShare: getTransNum('transactionPricePerShare'),
        transAcquiredDispCd: getTransValue('transactionAcquiredDisposedCode'),
        shrsOwndFollwngTrans: getTransNum('sharesOwnedFollowingTransaction'),
        directIndirectOwnership: getTransValue('directOrIndirectOwnership'),
      });
    }

    // Parse non-derivative holdings
    const nonderivHoldings: Form345NonDerivHolding[] = [];
    const holdingPattern = /<nonDerivativeHolding>([\s\S]*?)<\/nonDerivativeHolding>/gi;
    let holdingMatch;
    let holdingSk = 1;

    while ((holdingMatch = holdingPattern.exec(xml)) !== null) {
      const holdingXml = holdingMatch[1];
      const getHoldingValue = (tag: string): string => {
        const match = holdingXml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, 'i'));
        return match?.[1]?.trim() ? decodeHtmlEntities(match[1].trim()) : '';
      };
      const getHoldingNum = (tag: string): number => {
        const val = getHoldingValue(tag);
        return val ? parseFloat(val.replace(/,/g, '')) || 0 : 0;
      };

      nonderivHoldings.push({
        accessionNumber,
        nonderivHoldingSk: holdingSk++,
        securityTitle: getHoldingValue('securityTitle'),
        shrsOwndFollwngTrans: getHoldingNum('sharesOwnedFollowingTransaction'),
        directIndirectOwnership: getHoldingValue('directOrIndirectOwnership'),
      });
    }

    return { submission, owners, nonderivTrans, nonderivHoldings };
  } catch {
    return null;
  }
}

/**
 * Fetch Form 345 XML document
 */
async function fetchForm345Xml(cik: string, accessionNumber: string): Promise<string | null> {
  const items = await fetchFilingIndex(cik, accessionNumber);
  if (!items) return null;

  // Look for the primary XML document (form3.xml, form4.xml, form5.xml, or primary_doc.xml)
  // Prioritize exact matches first
  const xmlFile = items.find((item) =>
    item.name.match(/^(form[345]|primary_doc)\.xml$/i)
  ) || items.find((item) =>
    item.name.endsWith('.xml') &&
    !item.name.toLowerCase().includes('infotable') &&
    !item.name.toLowerCase().includes('index')
  );

  if (!xmlFile) return null;

  try {
    const normalizedCik = normalizeCik(cik);
    const accessionNoDashes = accessionNumber.replace(/-/g, '');
    const url = `https://www.sec.gov/Archives/edgar/data/${normalizedCik}/${accessionNoDashes}/${xmlFile.name}`;
    return await fetchText(url);
  } catch {
    return null;
  }
}

/**
 * Sync Form 3/4/5 filings from RSS feed
 */
export async function syncForm345FromRSS(options: RSSSyncOptions): Promise<RSSSyncResult> {
  const source = 'rss-sync-form345';
  const result: RSSSyncResult = { processed: 0, failed: 0, skipped: 0 };

  const syncState = await readSyncState();
  const state = syncState[source];
  const lastAccession = state?.lastAccessionNumber;

  if (options.dryRun) {
    console.log('Dry run mode - fetching feed without processing...');
  }

  try {
    if (!options.dryRun) {
      await markSyncStarted(source);

      if (isCloudMode()) {
        await initializeSchema();
      }
    }

    // Fetch RSS feeds for Form 3/4/5
    const formTypes = options.formTypes.length > 0
      ? options.formTypes
      : ['3', '4', '5'];

    const allEntries: RSSFeedEntry[] = [];

    for (const formType of formTypes) {
      console.log(`Fetching RSS feed for Form ${formType}...`);
      try {
        const feed = await fetchRSSFeed(formType, options.count || 100);
        console.log(`  Found ${feed.entries.length} entries`);
        allEntries.push(...feed.entries);
      } catch (error) {
        console.error(`  Error fetching Form ${formType} feed:`, error);
      }
    }

    if (allEntries.length === 0) {
      const msg = 'No entries found in RSS feeds';
      if (!options.dryRun) {
        await markSyncComplete(source, new Date().toISOString().split('T')[0]);
      }
      return { ...result, message: msg };
    }

    // Deduplicate by accession number
    const uniqueEntries = new Map<string, RSSFeedEntry>();
    for (const entry of allEntries) {
      if (!uniqueEntries.has(entry.accessionNumber)) {
        uniqueEntries.set(entry.accessionNumber, entry);
      }
    }

    console.log(`Processing ${uniqueEntries.size} unique filings...`);

    const sortedEntries = Array.from(uniqueEntries.values()).sort(
      (a, b) => a.filingDate.localeCompare(b.filingDate)
    );

    let startIndex = 0;
    if (lastAccession && !options.force) {
      const lastIdx = sortedEntries.findIndex(e => e.accessionNumber === lastAccession);
      if (lastIdx >= 0) {
        startIndex = lastIdx + 1;
        result.skipped = startIndex;
      }
    }

    if (options.dryRun) {
      const toProcess = sortedEntries.length - startIndex;
      return {
        ...result,
        processed: toProcess,
        skipped: startIndex,
        message: `Dry run: would process ${toProcess} filings, skip ${startIndex}`,
      };
    }

    // Process new filings
    const submissions: Record<string, unknown>[] = [];
    const owners: Record<string, unknown>[] = [];
    const nonderivTrans: Record<string, unknown>[] = [];
    const nonderivHoldings: Record<string, unknown>[] = [];

    let latestDate = state?.lastProcessedDate || '';
    let latestAccession = lastAccession || '';

    for (let i = startIndex; i < sortedEntries.length; i++) {
      const entry = sortedEntries[i];

      try {
        // Fetch Form 345 XML
        const xml = await fetchForm345Xml(entry.cik, entry.accessionNumber);

        if (!xml) {
          result.failed++;
          continue;
        }

        // Parse XML
        const parsed = parseForm345Xml(xml, entry.accessionNumber, entry.filingDate);

        if (!parsed) {
          result.failed++;
          continue;
        }

        // Collect records
        submissions.push({
          ACCESSION_NUMBER: parsed.submission.accessionNumber,
          FILING_DATE: parsed.submission.filingDate,
          PERIOD_OF_REPORT: parsed.submission.periodOfReport,
          DOCUMENT_TYPE: parsed.submission.documentType,
          ISSUERCIK: parsed.submission.issuerCik,
          ISSUERNAME: parsed.submission.issuerName,
          ISSUERTRADINGSYMBOL: parsed.submission.issuerTradingSymbol,
          NO_SECURITIES_OWNED: parsed.submission.noSecuritiesOwned,
          NOT_SUBJECT_SEC16: parsed.submission.notSubjectSec16,
          REMARKS: parsed.submission.remarks,
        });

        for (const owner of parsed.owners) {
          owners.push({
            ACCESSION_NUMBER: owner.accessionNumber,
            RPTOWNERCIK: owner.rptOwnerCik,
            RPTOWNERNAME: owner.rptOwnerName,
            RPTOWNER_RELATIONSHIP: owner.rptOwnerRelationship,
            RPTOWNER_TITLE: owner.rptOwnerTitle,
            RPTOWNER_STREET1: owner.rptOwnerStreet1,
            RPTOWNER_CITY: owner.rptOwnerCity,
            RPTOWNER_STATE: owner.rptOwnerState,
            RPTOWNER_ZIPCODE: owner.rptOwnerZipCode,
          });
        }

        for (const trans of parsed.nonderivTrans) {
          nonderivTrans.push({
            ACCESSION_NUMBER: trans.accessionNumber,
            NONDERIV_TRANS_SK: trans.nonderivTransSk,
            SECURITY_TITLE: trans.securityTitle,
            TRANS_DATE: trans.transDate,
            TRANS_CODE: trans.transCode,
            TRANS_SHARES: trans.transShares,
            TRANS_PRICEPERSHARE: trans.transPricePerShare,
            TRANS_ACQUIRED_DISP_CD: trans.transAcquiredDispCd,
            SHRS_OWND_FOLWNG_TRANS: trans.shrsOwndFollwngTrans,
            DIRECT_INDIRECT_OWNERSHIP: trans.directIndirectOwnership,
          });
        }

        for (const holding of parsed.nonderivHoldings) {
          nonderivHoldings.push({
            ACCESSION_NUMBER: holding.accessionNumber,
            NONDERIV_HOLDING_SK: holding.nonderivHoldingSk,
            SECURITY_TITLE: holding.securityTitle,
            SHRS_OWND_FOLWNG_TRANS: holding.shrsOwndFollwngTrans,
            DIRECT_INDIRECT_OWNERSHIP: holding.directIndirectOwnership,
          });
        }

        if (entry.filingDate > latestDate) {
          latestDate = entry.filingDate;
        }
        latestAccession = entry.accessionNumber;
        result.processed++;

        if (result.processed % 10 === 0) {
          console.log(`  Processed ${result.processed} filings...`);
        }

      } catch (error) {
        console.error(`Error processing ${entry.accessionNumber}: ${error}`);
        result.failed++;
      }
    }

    // Insert records into database using INSERT OR IGNORE for duplicates
    const { execute } = await import('./duckdb');

    const insertOrIgnore = async (table: string, records: Record<string, unknown>[]) => {
      let inserted = 0;
      for (const record of records) {
        try {
          const cols = Object.keys(record);
          const vals = cols.map(c => escapeSqlValue(record[c]));
          await execute(`INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')})`);
          inserted++;
        } catch {
          // Ignore individual insert errors
        }
      }
      return inserted;
    };

    if (submissions.length > 0) {
      await upsertRows('form345_submissions', submissions, 'ACCESSION_NUMBER');
      console.log(`Inserted ${submissions.length} Form 345 submissions`);
    }

    if (owners.length > 0) {
      const inserted = await insertOrIgnore('form345_reporting_owners', owners);
      console.log(`Inserted ${inserted} reporting owners`);
    }

    if (nonderivTrans.length > 0) {
      const inserted = await insertOrIgnore('form345_nonderiv_trans', nonderivTrans);
      console.log(`Inserted ${inserted} non-derivative transactions`);
    }

    if (nonderivHoldings.length > 0) {
      const inserted = await insertOrIgnore('form345_nonderiv_holding', nonderivHoldings);
      console.log(`Inserted ${inserted} non-derivative holdings`);
    }

    await markSyncComplete(source, latestDate, latestAccession);
    result.message = `Processed ${result.processed} filings, failed ${result.failed}, skipped ${result.skipped}`;

  } catch (error) {
    if (!options.dryRun) {
      await markSyncFailed(source, error as Error);
    }
    throw error;
  }

  return result;
}

/**
 * List available form types that can be synced via RSS
 */
export const RSS_FORM_TYPES = {
  SCHEDULE_13: ['SC 13D', 'SC 13D/A', 'SC 13G', 'SC 13G/A'],
  FORM_13F: ['13F-HR', '13F-HR/A', '13F-NT', '13F-NT/A'],
  FORM_4: ['4', '4/A'],
  FORM_3: ['3', '3/A'],
  FORM_5: ['5', '5/A'],
  FORM_8K: ['8-K', '8-K/A'],
  FORM_10K: ['10-K', '10-K/A'],
  FORM_10Q: ['10-Q', '10-Q/A'],
};