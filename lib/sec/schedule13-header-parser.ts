/**
 * Schedule 13D/13G Header Parser
 *
 * Parses SEC EDGAR submission text files to extract structured data from the
 * SEC-HEADER section. This works for all filings regardless of whether they
 * have XML documents or not.
 */

export interface Schedule13HeaderData {
  accessionNumber: string;
  formType: 'SC 13D' | 'SC 13D/A' | 'SC 13G' | 'SC 13G/A' | 'SCHEDULE 13D' | 'SCHEDULE 13D/A' | 'SCHEDULE 13G' | 'SCHEDULE 13G/A';
  filingDate: string;

  // Subject company (issuer)
  issuerCik: string;
  issuerName: string;
  issuerSic?: string;

  // Filing person (reporting person)
  filedByCik: string;
  filedByName: string;

  // Extracted from HTML content
  cusip?: string;
  securitiesClassTitle?: string;
  eventDate?: string;
  percentOfClass?: number;
  sharesOwned?: number;
}

/**
 * Parse SEC-HEADER section from submission text
 */
function parseSecHeader(text: string): Map<string, string> {
  const headerMatch = text.match(/<SEC-HEADER>([\s\S]*?)<\/SEC-HEADER>/);
  if (!headerMatch) return new Map();

  const headerText = headerMatch[1];
  const data = new Map<string, string>();

  // Track current section for nested data
  let isSubjectCompany = false;
  let isFiledBy = false;

  for (const line of headerText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Section markers
    if (trimmed === 'SUBJECT COMPANY:') {
      isSubjectCompany = true;
      isFiledBy = false;
      continue;
    }
    if (trimmed === 'FILED BY:') {
      isSubjectCompany = false;
      isFiledBy = true;
      continue;
    }

    // Key-value pairs with tabs or colons
    const kvMatch = trimmed.match(/^([A-Z][A-Z\s]+?):\s*(.*)$/);
    if (kvMatch) {
      const [, key, value] = kvMatch;
      const normalizedKey = key.trim();

      // Prefix with section context
      if (isSubjectCompany) {
        data.set(`SUBJECT_${normalizedKey}`, value.trim());
      } else if (isFiledBy) {
        data.set(`FILEDBY_${normalizedKey}`, value.trim());
      } else {
        data.set(normalizedKey, value.trim());
      }
    }
  }

  return data;
}

/**
 * Extract CUSIP from HTML content
 * CUSIP format: 9 characters, typically alphanumeric (e.g., G1645N101, 037833100)
 */
function extractCusip(htmlContent: string): string | undefined {
  // Look for CUSIP patterns - must be exactly 9 characters
  // CUSIP format: 6-char issuer + 2-char issue + 1-char check digit
  const patterns = [
    // After "CUSIP Number" label, capture the 9-char code
    /\(CUSIP\s*Number\)<\/[^>]+>[\s\S]{0,500}?([A-Z0-9]{6}[A-Z0-9]{2}[0-9])/i,
    // CUSIP in centered text
    /text-align:\s*center[^>]*>[\s]*([A-Z0-9]{6}[A-Z0-9]{2}[0-9])[\s]*</i,
    // After CUSIP label with colon
    /CUSIP[:\s]+([A-Z0-9]{6}[A-Z0-9]{2}[0-9])/i,
    // Standalone 9-char code that looks like CUSIP (letter+numbers pattern common)
    />([A-Z][0-9]{5}[A-Z0-9]{2}[0-9])</,
  ];

  for (const pattern of patterns) {
    const match = htmlContent.match(pattern);
    if (match && match[1]) {
      const cusip = match[1].toUpperCase();
      // Validate: CUSIPs typically have numbers in specific positions
      if (/^[A-Z0-9]{6}[A-Z0-9]{2}[0-9]$/.test(cusip)) {
        return cusip;
      }
    }
  }
  return undefined;
}

/**
 * Extract securities class title from HTML content
 */
function extractSecuritiesClass(htmlContent: string): string | undefined {
  // Look for title of class patterns
  const patterns = [
    /Title of Class of Securities[^>]*>[\s\S]*?<[^>]+>([^<]+)</i,
    /\(Title of Class[^)]*\)[\s\S]*?([A-Za-z][^<\n]{5,50})/i,
    /Class of Securities[:\s]*([A-Za-z][^\n<]{5,50})/i,
  ];

  for (const pattern of patterns) {
    const match = htmlContent.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  return undefined;
}

/**
 * Extract percent of class from HTML content
 */
function extractPercentOfClass(htmlContent: string): number | undefined {
  // Look for percentage patterns - Item 11 in 13D, Item 9 in 13G
  const patterns = [
    /Percent of Class[^:]*:\s*([\d.]+)\s*%/i,
    /Item\s*(?:11|9)[^%]*?([\d.]+)\s*%/i,
    /Aggregate Amount[^%]*?([\d.]+)\s*%/i,
  ];

  for (const pattern of patterns) {
    const match = htmlContent.match(pattern);
    if (match && match[1]) {
      const percent = parseFloat(match[1]);
      if (!isNaN(percent) && percent >= 0 && percent <= 100) {
        return percent;
      }
    }
  }
  return undefined;
}

/**
 * Extract shares owned from HTML content
 */
function extractSharesOwned(htmlContent: string): number | undefined {
  // Look for share count patterns
  const patterns = [
    /Aggregate Amount[^:]*:\s*([\d,]+)/i,
    /Total Shares[^:]*:\s*([\d,]+)/i,
    /Number of Shares[^:]*:\s*([\d,]+)/i,
  ];

  for (const pattern of patterns) {
    const match = htmlContent.match(pattern);
    if (match && match[1]) {
      const shares = parseInt(match[1].replace(/,/g, ''), 10);
      if (!isNaN(shares) && shares > 0) {
        return shares;
      }
    }
  }
  return undefined;
}

/**
 * Parse a Schedule 13D/13G submission text file
 */
export function parseSchedule13Header(
  submissionText: string,
  accessionNumber: string,
): Schedule13HeaderData | null {
  try {
    const headerData = parseSecHeader(submissionText);

    // Get form type
    const formType = headerData.get('CONFORMED SUBMISSION TYPE') as Schedule13HeaderData['formType'];
    if (!formType?.includes('13')) {
      return null;
    }

    // Get filing date
    const filingDate = headerData.get('FILED AS OF DATE');
    if (!filingDate) return null;

    // Format date from YYYYMMDD to YYYY-MM-DD
    const formattedDate = filingDate.length === 8
      ? `${filingDate.slice(0, 4)}-${filingDate.slice(4, 6)}-${filingDate.slice(6, 8)}`
      : filingDate;

    // Get subject company (issuer) info
    const issuerCik = headerData.get('SUBJECT_CENTRAL INDEX KEY') || '';
    const issuerName = headerData.get('SUBJECT_COMPANY CONFORMED NAME') || 'Unknown Issuer';
    const issuerSic = headerData.get('SUBJECT_STANDARD INDUSTRIAL CLASSIFICATION');

    // Get filing person info
    const filedByCik = headerData.get('FILEDBY_CENTRAL INDEX KEY') || '';
    const filedByName = headerData.get('FILEDBY_COMPANY CONFORMED NAME') || 'Unknown Filer';

    // Extract data from HTML content (everything after the header)
    const htmlStart = submissionText.indexOf('<HTML>');
    const htmlContent = htmlStart > -1 ? submissionText.slice(htmlStart) : submissionText;

    const cusip = extractCusip(htmlContent);
    const securitiesClassTitle = extractSecuritiesClass(htmlContent);
    const percentOfClass = extractPercentOfClass(htmlContent);
    const sharesOwned = extractSharesOwned(htmlContent);

    return {
      accessionNumber,
      formType: formType as Schedule13HeaderData['formType'],
      filingDate: formattedDate,
      issuerCik,
      issuerName,
      issuerSic,
      filedByCik,
      filedByName,
      cusip,
      securitiesClassTitle,
      percentOfClass,
      sharesOwned,
    };
  } catch (error) {
    console.error(`Error parsing Schedule 13 header for ${accessionNumber}:`, error);
    return null;
  }
}

/**
 * Convert parsed header data to flat record for Parquet storage
 */
export function headerToFilingRecord(data: Schedule13HeaderData): Record<string, unknown> {
  return {
    ACCESSION_NUMBER: data.accessionNumber,
    FORM_TYPE: data.formType,
    FILING_DATE: data.filingDate,

    ISSUER_CIK: data.issuerCik,
    ISSUER_NAME: data.issuerName,
    ISSUER_SIC: data.issuerSic || null,
    ISSUER_CUSIP: data.cusip || null,

    FILED_BY_CIK: data.filedByCik,
    FILED_BY_NAME: data.filedByName,

    SECURITIES_CLASS_TITLE: data.securitiesClassTitle || null,
    PERCENT_OF_CLASS: data.percentOfClass || 0,
    SHARES_OWNED: data.sharesOwned || 0,
  };
}

// Simplified schema for header-based parsing
export const SCHEDULE13_HEADER_SCHEMA = {
  ACCESSION_NUMBER: { type: 'UTF8' as const },
  FORM_TYPE: { type: 'UTF8' as const },
  FILING_DATE: { type: 'UTF8' as const },

  ISSUER_CIK: { type: 'UTF8' as const },
  ISSUER_NAME: { type: 'UTF8' as const },
  ISSUER_SIC: { type: 'UTF8' as const, optional: true },
  ISSUER_CUSIP: { type: 'UTF8' as const, optional: true },

  FILED_BY_CIK: { type: 'UTF8' as const },
  FILED_BY_NAME: { type: 'UTF8' as const },

  SECURITIES_CLASS_TITLE: { type: 'UTF8' as const, optional: true },
  PERCENT_OF_CLASS: { type: 'DOUBLE' as const },
  SHARES_OWNED: { type: 'DOUBLE' as const },
};
