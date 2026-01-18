/**
 * SEC Data Query Functions
 *
 * Query functions for SEC filings data stored in DuckDB tables.
 * Data files are loaded into DuckDB tables on initialization,
 * providing efficient SQL queries with proper indexing.
 *
 * Available tables:
 * - holdings_13f: 13F holdings data
 * - submissions_13f: 13F submission metadata
 * - filings_13dg: 13D/13G filings
 * - reporting_persons_13dg: 13D/13G reporting persons
 */

import { getFilerName, getFilerNames } from './filer-names';
import { mapCUSIPs } from './openfigi';
import { query } from './duckdb';
import { validateCik, validateCusip } from '@/lib/validators';

// ============================================================================
// SQL Injection Protection
// ============================================================================

/**
 * Escape a string value for safe use in SQL queries.
 * Replaces single quotes with escaped single quotes.
 */
function escapeSqlString(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Assert that a CIK is valid before using in SQL.
 * Throws if invalid, returns normalized CIK if valid.
 */
function assertValidCik(cik: string): string {
  const result = validateCik.validate(cik);
  if (!result.valid) {
    throw new Error(`Invalid CIK: ${result.error}`);
  }
  return result.normalized!;
}

/**
 * Assert that a CUSIP is valid before using in SQL.
 * Throws if invalid, returns normalized CUSIP if valid.
 */
function assertValidCusip(cusip: string): string {
  const result = validateCusip.validate(cusip);
  if (!result.valid) {
    throw new Error(`Invalid CUSIP: ${result.error}`);
  }
  return result.normalized!;
}

/**
 * Assert that a quarter string is valid (YYYY-QN format).
 */
function assertValidQuarter(quarter: string): string {
  if (!/^\d{4}-Q[1-4]$/.test(quarter)) {
    throw new Error(`Invalid quarter format: ${quarter}. Expected YYYY-QN`);
  }
  return quarter;
}

/**
 * Assert that a limit is a positive integer within bounds.
 */
function assertValidLimit(limit: number, max: number = 1000): number {
  const num = Math.floor(limit);
  if (!Number.isInteger(num) || num < 1 || num > max) {
    throw new Error(`Invalid limit: ${limit}. Must be between 1 and ${max}`);
  }
  return num;
}

// Cache for available quarters
const quartersCache = new Map<string, { quarters: string[]; loadedAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minute TTL

// Month abbreviations to quarter number mapping
const MONTH_TO_QUARTER: Record<string, number> = {
  'JAN': 1, 'FEB': 1, 'MAR': 1,
  'APR': 2, 'MAY': 2, 'JUN': 2,
  'JUL': 3, 'AUG': 3, 'SEP': 3,
  'OCT': 4, 'NOV': 4, 'DEC': 4,
};

/**
 * Convert PERIODOFREPORT (DD-MMM-YYYY) to quarter string (YYYY-QN)
 */
function periodToQuarter(periodOfReport: string): string | null {
  const match = periodOfReport?.match(/^\d{2}-([A-Z]{3})-(\d{4})$/i);
  if (!match) return null;

  const quarter = MONTH_TO_QUARTER[match[1].toUpperCase()];
  return quarter ? `${match[2]}-Q${quarter}` : null;
}

/**
 * Get month filter SQL for a quarter (YYYY-QN)
 */
function getQuarterMonthFilter(quarter: string, tableAlias: string = 's'): string | null {
  const match = quarter.match(/^(\d{4})-Q([1-4])$/);
  if (!match) return null;

  const year = match[1];
  const quarterNum = parseInt(match[2], 10);
  const quarterMonths: Record<number, string[]> = {
    1: ['JAN', 'FEB', 'MAR'],
    2: ['APR', 'MAY', 'JUN'],
    3: ['JUL', 'AUG', 'SEP'],
    4: ['OCT', 'NOV', 'DEC'],
  };

  return quarterMonths[quarterNum]
    .map(m => `${tableAlias}.PERIODOFREPORT LIKE '%-${m}-${year}'`)
    .join(' OR ');
}

/**
 * Get available quarters from loaded DuckDB tables
 */
async function getAvailableQuarters(tableName: string): Promise<string[]> {
  const cached = quartersCache.get(tableName);
  const now = Date.now();

  if (cached && now - cached.loadedAt < CACHE_TTL_MS) {
    return cached.quarters;
  }

  try {
    // Get distinct periods from submissions table and convert to quarters
    const result = await query<{ PERIODOFREPORT: string }>(`
      SELECT DISTINCT PERIODOFREPORT
      FROM submissions_13f
      WHERE PERIODOFREPORT IS NOT NULL
      ORDER BY PERIODOFREPORT DESC
    `);

    // Convert to quarters and deduplicate
    const quarterSet = new Set<string>();
    for (const r of result) {
      const q = periodToQuarter(r.PERIODOFREPORT);
      if (q) quarterSet.add(q);
    }

    const quarters = Array.from(quarterSet).sort().reverse();
    quartersCache.set(tableName, { quarters, loadedAt: now });
    return quarters;
  } catch {
    return [];
  }
}

// 13F Holdings types
interface HoldingRecord {
  ACCESSION_NUMBER: string;
  INFOTABLE_SK: number;
  NAMEOFISSUER: string;
  TITLEOFCLASS: string;
  CUSIP: string;
  FIGI?: string;
  VALUE: number;
  SSHPRNAMT: number;
  SSHPRNAMTTYPE: string;
  PUTCALL?: string;
  INVESTMENTDISCRETION: string;
  OTHERMANAGER?: string;
  VOTING_AUTH_SOLE: number;
  VOTING_AUTH_SHARED: number;
  VOTING_AUTH_NONE: number;
}

interface SubmissionRecord {
  ACCESSION_NUMBER: string;
  FILING_DATE: string;
  SUBMISSIONTYPE: string;
  CIK: string;
  PERIODOFREPORT: string;
}

// 13D/13G Filing types
interface Schedule13FilingRecord {
  ACCESSION_NUMBER: string;
  FORM_TYPE: string;
  FILING_DATE: string;
  ISSUER_CIK?: string;
  ISSUER_NAME: string;
  ISSUER_CUSIP?: string;
  SECURITIES_CLASS_TITLE: string;
  EVENT_DATE?: string;
  AMENDMENT_NUMBER: number;
  PERCENT_OF_CLASS: number;
  AGGREGATE_AMOUNT_OWNED: number;
  SOLE_VOTING_POWER: number;
  SHARED_VOTING_POWER: number;
  SOLE_DISPOSITIVE_POWER: number;
  SHARED_DISPOSITIVE_POWER: number;
  PURPOSE_OF_TRANSACTION?: string;
  SOURCE_OF_FUNDS?: string;
  REPORTING_PERSON_COUNT: number;
}

interface ReportingPersonRecord {
  ACCESSION_NUMBER: string;
  REPORTING_PERSON_SK: number;
  REPORTING_PERSON_CIK?: string;
  REPORTING_PERSON_NAME: string;
  MEMBER_OF_GROUP?: string;
  SOLE_VOTING_POWER: number;
  SHARED_VOTING_POWER: number;
  SOLE_DISPOSITIVE_POWER: number;
  SHARED_DISPOSITIVE_POWER: number;
  AGGREGATE_AMOUNT_OWNED: number;
  PERCENT_OF_CLASS: number;
  TYPE_OF_REPORTING_PERSON: string;
  CITIZENSHIP_OR_ORGANIZATION?: string;
  INTENT_FLAGS?: string;
}

/**
 * Get holdings for a specific filer (CIK)
 * Uses DuckDB tables for efficient querying
 */
export async function getFilerHoldings(cik: string, quarter?: string) {
  // Validate inputs to prevent SQL injection
  const validatedCik = assertValidCik(cik);

  // CIK is validated - safe to use in SQL
  const escapedCik = escapeSqlString(validatedCik);

  try {
    let submissions: SubmissionRecord[];

    if (quarter) {
      // If specific quarter requested, filter by it
      const targetQuarter = assertValidQuarter(quarter);
      const monthFilter = getQuarterMonthFilter(targetQuarter, 's');
      if (!monthFilter) {
        console.debug(`Invalid quarter format: ${targetQuarter}`);
        return [];
      }

      submissions = await query<SubmissionRecord>(`
        SELECT *
        FROM submissions_13f s
        WHERE (${monthFilter})
          AND (LTRIM(s.CIK, '0') = '${escapedCik}' OR s.CIK = '${escapedCik}')
        ORDER BY s.PERIODOFREPORT DESC
        LIMIT 1
      `);
    } else {
      // No quarter specified - find the most recent submission for this CIK
      submissions = await query<SubmissionRecord>(`
        SELECT *
        FROM submissions_13f s
        WHERE LTRIM(s.CIK, '0') = '${escapedCik}' OR s.CIK = '${escapedCik}'
        ORDER BY TRY_STRPTIME(s.PERIODOFREPORT, '%d-%b-%Y') DESC
        LIMIT 1
      `);
    }

    if (submissions.length === 0) {
      return [];
    }

    const latestSubmission = submissions[0];

    // Now get holdings for this submission, JOIN with cusip_mappings for tickers
    const holdings = await query<HoldingRecord & { mapped_ticker?: string; mapped_figi?: string }>(`
      SELECT h.*, m.ticker as mapped_ticker, m.figi as mapped_figi
      FROM holdings_13f h
      LEFT JOIN rensider.cusip_mappings m ON h.CUSIP = m.cusip
      WHERE h.ACCESSION_NUMBER = '${latestSubmission.ACCESSION_NUMBER}'
    `);

    // Resolve filer name
    const filerName = await getFilerName(cik);

    return holdings.map(h => ({
      cusip: h.CUSIP,
      ticker: h.mapped_ticker || null,
      figi: h.mapped_figi || h.FIGI || null,
      name_of_issuer: h.NAMEOFISSUER,
      title_of_class: h.TITLEOFCLASS,
      value: Number(h.VALUE),
      shares: Number(h.SSHPRNAMT),
      shares_or_principal_type: h.SSHPRNAMTTYPE,
      put_call: h.PUTCALL,
      investment_discretion: h.INVESTMENTDISCRETION,
      period_of_report: latestSubmission.PERIODOFREPORT,
      filing_date: latestSubmission.FILING_DATE,
      filingmanager_name: filerName,
    }));
  } catch (error) {
    console.error(`Error getting holdings for CIK ${cik}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Get holders of a specific security (CUSIP)
 * Uses DuckDB tables for efficient querying
 */
export async function getSecurityHolders(cusip: string, quarter?: string) {
  // Validate inputs to prevent SQL injection
  const validatedCusip = assertValidCusip(cusip);

  const quarters = await getAvailableQuarters('holdings_13f');

  if (quarters.length === 0) {
    return [];
  }

  const targetQuarter = quarter ? assertValidQuarter(quarter) : quarters[0];

  // CUSIP is validated and escaped
  const escapedCusip = escapeSqlString(validatedCusip);

  try {
    // Get month filter for quarter
    const monthFilter = getQuarterMonthFilter(targetQuarter, 's');
    if (!monthFilter) {
      return [];
    }

    // Use SQL JOIN to get holdings with submission metadata
    const results = await query<{
      CUSIP: string;
      VALUE: number;
      SSHPRNAMT: number;
      NAMEOFISSUER: string;
      CIK: string;
      PERIODOFREPORT: string;
      FILING_DATE: string;
    }>(`
      SELECT
        h.CUSIP,
        h.VALUE,
        h.SSHPRNAMT,
        h.NAMEOFISSUER,
        s.CIK,
        s.PERIODOFREPORT,
        s.FILING_DATE
      FROM holdings_13f h
      JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
      WHERE (${monthFilter})
        AND UPPER(TRIM(h.CUSIP)) = '${escapedCusip}'
      ORDER BY h.VALUE DESC
    `);

    // Collect unique CIKs for batch name resolution
    const ciks = [...new Set(results.map(r => r.CIK))];

    // Batch resolve filer names and CUSIP mapping in parallel
    const [filerNamesMap, cusipMappings] = await Promise.all([
      getFilerNames(ciks, { fetchMissing: true }),
      mapCUSIPs([cusip]),
    ]);

    const tickerInfo = cusipMappings[0];

    return results.map(r => ({
      cik: r.CIK,
      filer_name: filerNamesMap.get(r.CIK) || r.CIK,
      cusip: validatedCusip,
      ticker: tickerInfo?.ticker,
      issuer_name: r.NAMEOFISSUER,
      value: Number(r.VALUE),
      shares: Number(r.SSHPRNAMT),
      period_of_report: r.PERIODOFREPORT,
      filing_date: r.FILING_DATE,
    }));
  } catch (error) {
    console.error(`Error getting holders for CUSIP ${cusip}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Get position changes for a filer between two quarters
 * Uses DuckDB FULL OUTER JOIN for efficient comparison
 */
export async function getPositionChanges(cik: string, quarters: [string, string]) {
  // Validate inputs
  const validatedCik = assertValidCik(cik);
  const [prevQuarter, currQuarter] = [
    assertValidQuarter(quarters[0]),
    assertValidQuarter(quarters[1]),
  ];

  // Verify both quarters exist
  const availableQuarters = await getAvailableQuarters('holdings_13f');
  if (!availableQuarters.includes(prevQuarter) || !availableQuarters.includes(currQuarter)) {
    return [];
  }

  const escapedCik = escapeSqlString(validatedCik);

  try {
    // Get month filters for both quarters
    const prevMonthFilter = getQuarterMonthFilter(prevQuarter, 's');
    const currMonthFilter = getQuarterMonthFilter(currQuarter, 's');
    if (!prevMonthFilter || !currMonthFilter) {
      return [];
    }

    // Use SQL to get position changes with FULL OUTER JOIN
    const changes = await query<{
      cusip: string;
      name_of_issuer: string;
      prev_shares: number | null;
      curr_shares: number | null;
      prev_value: number | null;
      curr_value: number | null;
    }>(`
      WITH prev_sub AS (
        SELECT ACCESSION_NUMBER
        FROM submissions_13f s
        WHERE (${prevMonthFilter})
          AND (LTRIM(s.CIK, '0') = '${escapedCik}' OR s.CIK = '${escapedCik}')
        ORDER BY s.PERIODOFREPORT DESC
        LIMIT 1
      ),
      curr_sub AS (
        SELECT ACCESSION_NUMBER
        FROM submissions_13f s
        WHERE (${currMonthFilter})
          AND (LTRIM(s.CIK, '0') = '${escapedCik}' OR s.CIK = '${escapedCik}')
        ORDER BY s.PERIODOFREPORT DESC
        LIMIT 1
      ),
      prev_holdings AS (
        SELECT h.CUSIP, h.NAMEOFISSUER, h.SSHPRNAMT, h.VALUE
        FROM holdings_13f h
        WHERE h.ACCESSION_NUMBER = (SELECT ACCESSION_NUMBER FROM prev_sub)
      ),
      curr_holdings AS (
        SELECT h.CUSIP, h.NAMEOFISSUER, h.SSHPRNAMT, h.VALUE
        FROM holdings_13f h
        WHERE h.ACCESSION_NUMBER = (SELECT ACCESSION_NUMBER FROM curr_sub)
      )
      SELECT
        COALESCE(c.CUSIP, p.CUSIP) as cusip,
        COALESCE(c.NAMEOFISSUER, p.NAMEOFISSUER) as name_of_issuer,
        p.SSHPRNAMT as prev_shares,
        c.SSHPRNAMT as curr_shares,
        p.VALUE as prev_value,
        c.VALUE as curr_value
      FROM prev_holdings p
      FULL OUTER JOIN curr_holdings c ON p.CUSIP = c.CUSIP
      WHERE p.CUSIP IS NULL OR c.CUSIP IS NULL OR p.SSHPRNAMT != c.SSHPRNAMT
      ORDER BY ABS(COALESCE(c.SSHPRNAMT, 0) - COALESCE(p.SSHPRNAMT, 0)) DESC
    `);

    return changes.map(c => {
      let changeType: 'NEW' | 'SOLD' | 'INCREASED' | 'DECREASED' | 'UNCHANGED';

      if (c.prev_shares === null && c.curr_shares !== null) {
        changeType = 'NEW';
      } else if (c.prev_shares !== null && c.curr_shares === null) {
        changeType = 'SOLD';
      } else if ((c.curr_shares || 0) > (c.prev_shares || 0)) {
        changeType = 'INCREASED';
      } else if ((c.curr_shares || 0) < (c.prev_shares || 0)) {
        changeType = 'DECREASED';
      } else {
        changeType = 'UNCHANGED';
      }

      return {
        cusip: c.cusip,
        name_of_issuer: c.name_of_issuer,
        prev_shares: c.prev_shares,
        curr_shares: c.curr_shares,
        share_change: (c.curr_shares || 0) - (c.prev_shares || 0),
        prev_value: c.prev_value,
        curr_value: c.curr_value,
        change_type: changeType,
      };
    });
  } catch (error) {
    console.error(`Error getting position changes for CIK ${cik}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Get top filers by AUM
 * Uses DuckDB aggregation for efficient calculation
 */
export async function getTopFilersByAUM(limit = 10) {
  // Validate limit
  const validatedLimit = assertValidLimit(limit, 100);

  const quarters = await getAvailableQuarters('holdings_13f');

  if (quarters.length === 0) {
    return [];
  }

  const latestQuarter = quarters[0];

  try {
    // Get month filter for quarter
    const monthFilter = getQuarterMonthFilter(latestQuarter, 's');
    if (!monthFilter) {
      return [];
    }

    // Use SQL aggregation to calculate AUM per filer
    const topFilers = await query<{
      cik: string;
      total_aum: number;
      position_count: number;
    }>(`
      SELECT
        s.CIK as cik,
        SUM(h.VALUE) as total_aum,
        COUNT(*) as position_count
      FROM holdings_13f h
      JOIN submissions_13f s ON h.ACCESSION_NUMBER = s.ACCESSION_NUMBER
      WHERE (${monthFilter})
      GROUP BY s.CIK
      ORDER BY total_aum DESC
      LIMIT ${validatedLimit}
    `);

    // Batch resolve filer names for top filers only
    const ciks = topFilers.map(f => f.cik);
    const filerNamesMap = await getFilerNames(ciks, { fetchMissing: true });

    return topFilers.map(f => ({
      cik: f.cik,
      filingmanager_name: filerNamesMap.get(f.cik) || f.cik,
      total_aum: Number(f.total_aum),
      position_count: Number(f.position_count),
    }));
  } catch (error) {
    console.error(`Error getting top filers:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Get recent filings (13F, 13D, 13G)
 */
export async function getRecentFilings(
  formTypes: ('13F' | '13D' | '13G')[] = ['13F', '13D', '13G'],
  limit = 50
) {
  const filings: {
    accessionNumber: string;
    formType: string;
    filingDate: string;
    filerName: string;
    filerCik?: string;
    issuerName?: string;
    issuerCusip?: string;
  }[] = [];

  // Get 13F filings
  if (formTypes.includes('13F')) {
    const quarters = await getAvailableQuarters('submissions_13f');
    if (quarters.length > 0) {
      const latestQuarter = quarters[0];
      const monthFilter = getQuarterMonthFilter(latestQuarter, 's');

      try {
        const submissions = await query<SubmissionRecord>(monthFilter ? `
          SELECT *
          FROM submissions_13f s
          WHERE (${monthFilter})
          ORDER BY s.FILING_DATE DESC
          LIMIT ${limit}
        ` : `
          SELECT *
          FROM submissions_13f
          ORDER BY FILING_DATE DESC
          LIMIT ${limit}
        `);

        // Batch resolve filer names
        const ciks = submissions.map(s => s.CIK);
        const filerNamesMap = await getFilerNames(ciks, { fetchMissing: true });

        for (const s of submissions) {
          filings.push({
            accessionNumber: s.ACCESSION_NUMBER,
            formType: s.SUBMISSIONTYPE,
            filingDate: s.FILING_DATE,
            filerName: filerNamesMap.get(s.CIK) || s.CIK,
            filerCik: s.CIK,
          });
        }
      } catch (error) {
        console.error('Error getting 13F filings:', error instanceof Error ? error.message : error);
      }
    }
  }

  // Get 13D/13G filings
  if (formTypes.includes('13D') || formTypes.includes('13G')) {
    try {
      // Build form type filter
      const formFilters: string[] = [];
      if (formTypes.includes('13D')) formFilters.push("FORM_TYPE LIKE '%13D%'");
      if (formTypes.includes('13G')) formFilters.push("FORM_TYPE LIKE '%13G%'");

      // 13D/13G are event-based filings, not quarterly, so just get recent by filing date
      const schedule13Filings = await query<Schedule13FilingRecord>(`
        SELECT *
        FROM filings_13dg
        WHERE (${formFilters.join(' OR ')})
        ORDER BY FILING_DATE DESC
        LIMIT ${limit}
      `);

      for (const f of schedule13Filings) {
        filings.push({
          accessionNumber: f.ACCESSION_NUMBER,
          formType: f.FORM_TYPE,
          filingDate: f.FILING_DATE,
          filerName: f.ISSUER_NAME,
          issuerName: f.ISSUER_NAME,
          issuerCusip: f.ISSUER_CUSIP,
        });
      }
    } catch (error) {
      console.error('Error getting 13D/13G filings:', error instanceof Error ? error.message : error);
    }
  }

  // Sort by filing date, most recent first
  return filings
    .sort((a, b) => b.filingDate.localeCompare(a.filingDate))
    .slice(0, limit);
}

/**
 * Get 13D/13G activity for a specific CUSIP
 */
export async function getSchedule13Activity(cusip: string, limit = 20) {
  // Validate inputs
  const validatedCusip = assertValidCusip(cusip);
  const validatedLimit = assertValidLimit(limit, 100);
  const escapedCusip = escapeSqlString(validatedCusip);

  try {
    // Query filings for this CUSIP from table
    const filings = await query<Schedule13FilingRecord>(`
      SELECT *
      FROM filings_13dg
      WHERE ISSUER_CUSIP = '${escapedCusip}'
      ORDER BY FILING_DATE DESC
      LIMIT ${validatedLimit * 2}
    `);

    if (filings.length === 0) {
      return [];
    }

    // Get reporting persons for these accession numbers (escape for defense-in-depth)
    const accessionNumbers = filings.map(f => `'${escapeSqlString(f.ACCESSION_NUMBER)}'`).join(',');
    const reportingPersons = await query<ReportingPersonRecord>(`
      SELECT *
      FROM reporting_persons_13dg
      WHERE ACCESSION_NUMBER IN (${accessionNumbers})
    `);

    // Group reporting persons by accession
    const rpByAccession = new Map<string, ReportingPersonRecord[]>();
    for (const rp of reportingPersons) {
      const list = rpByAccession.get(rp.ACCESSION_NUMBER) || [];
      list.push(rp);
      rpByAccession.set(rp.ACCESSION_NUMBER, list);
    }

    const activity = filings.map(f => {
      const persons = rpByAccession.get(f.ACCESSION_NUMBER) || [];

      return {
        accessionNumber: f.ACCESSION_NUMBER,
        formType: f.FORM_TYPE,
        filingDate: f.FILING_DATE,
        eventDate: f.EVENT_DATE,
        issuerName: f.ISSUER_NAME,
        percentOfClass: Number(f.PERCENT_OF_CLASS),
        aggregateOwned: Number(f.AGGREGATE_AMOUNT_OWNED),
        purposeOfTransaction: f.PURPOSE_OF_TRANSACTION,
        reportingPersons: persons.map(p => ({
          name: p.REPORTING_PERSON_NAME,
          cik: p.REPORTING_PERSON_CIK,
          percentOfClass: Number(p.PERCENT_OF_CLASS),
          intentFlags: p.INTENT_FLAGS?.split(','),
        })),
      };
    });

    return activity
      .sort((a, b) => b.filingDate.localeCompare(a.filingDate))
      .slice(0, validatedLimit);
  } catch (error) {
    console.error(`Error reading 13D/13G data for CUSIP ${cusip}:`, error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Get recent 13D filings (activist activity)
 */
export async function getRecentActivistActivity(limit = 20) {
  // Validate limit
  const validatedLimit = assertValidLimit(limit, 100);

  try {
    // Query 13D filings only (activist) from table
    const filings = await query<Schedule13FilingRecord>(`
      SELECT *
      FROM filings_13dg
      WHERE FORM_TYPE LIKE '%13D%'
      ORDER BY FILING_DATE DESC
      LIMIT ${validatedLimit * 2}
    `);

    if (filings.length === 0) {
      return [];
    }

    // Get reporting persons (escape for defense-in-depth)
    const accessionNumbers = filings.map(f => `'${escapeSqlString(f.ACCESSION_NUMBER)}'`).join(',');
    const reportingPersons = await query<ReportingPersonRecord>(`
      SELECT *
      FROM reporting_persons_13dg
      WHERE ACCESSION_NUMBER IN (${accessionNumbers})
    `);

    const rpByAccession = new Map<string, ReportingPersonRecord[]>();
    for (const rp of reportingPersons) {
      const list = rpByAccession.get(rp.ACCESSION_NUMBER) || [];
      list.push(rp);
      rpByAccession.set(rp.ACCESSION_NUMBER, list);
    }

    const activity = filings.map(f => {
      const persons = rpByAccession.get(f.ACCESSION_NUMBER) || [];
      const primaryPerson = persons[0];

      return {
        accessionNumber: f.ACCESSION_NUMBER,
        filingDate: f.FILING_DATE,
        eventDate: f.EVENT_DATE,
        issuerName: f.ISSUER_NAME,
        issuerCusip: f.ISSUER_CUSIP,
        percentOfClass: Number(f.PERCENT_OF_CLASS),
        purposeOfTransaction: f.PURPOSE_OF_TRANSACTION,
        reportingPersonName: primaryPerson?.REPORTING_PERSON_NAME || 'Unknown',
        intentCategory: primaryPerson?.INTENT_FLAGS?.split(',')[0],
      };
    });

    return activity
      .sort((a, b) => b.filingDate.localeCompare(a.filingDate))
      .slice(0, validatedLimit);
  } catch (error) {
    console.error('Error reading activist activity:', error instanceof Error ? error.message : error);
    return [];
  }
}
