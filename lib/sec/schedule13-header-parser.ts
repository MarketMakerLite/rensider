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

    // Section markers - use startsWith for more robust matching
    // SEC headers can have tabs/spaces after the colon
    if (trimmed.startsWith('SUBJECT COMPANY:') || trimmed === 'SUBJECT COMPANY') {
      isSubjectCompany = true;
      isFiledBy = false;
      continue;
    }
    if (trimmed.startsWith('FILED BY:') || trimmed === 'FILED BY') {
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
 * Decode HTML entities commonly found in SEC filings
 * Validates Unicode code points to prevent invalid character conversion
 */
function decodeHtmlEntities(text: string): string {
  if (!text) return text;

  return text
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&nbsp;/gi, ' ')
    // Numeric entities (decimal) - validate code point is in valid Unicode range
    .replace(/&#(\d+);/g, (match, code) => {
      const codePoint = parseInt(code, 10);
      // Valid Unicode code points: 0-0x10FFFF, excluding surrogates (0xD800-0xDFFF)
      if (codePoint >= 0 && codePoint <= 0x10FFFF && !(codePoint >= 0xD800 && codePoint <= 0xDFFF)) {
        return String.fromCodePoint(codePoint);
      }
      return match; // Return original if invalid
    })
    // Numeric entities (hex) - validate code point is in valid Unicode range
    .replace(/&#x([0-9a-fA-F]+);/g, (match, code) => {
      const codePoint = parseInt(code, 16);
      if (codePoint >= 0 && codePoint <= 0x10FFFF && !(codePoint >= 0xD800 && codePoint <= 0xDFFF)) {
        return String.fromCodePoint(codePoint);
      }
      return match; // Return original if invalid
    });
}

/**
 * Extract CUSIP from HTML content
 * CUSIP format: 9 characters, typically alphanumeric (e.g., G1645N101, 037833100)
 */
function extractCusip(htmlContent: string): string | undefined {
  // Standard CUSIP format: 6 alphanumeric + 2 alphanumeric + 1 digit
  const CUSIP_PATTERN = /[A-Z0-9]{6}[A-Z0-9]{2}[0-9]/;

  // Decode HTML entities
  const decoded = decodeHtmlEntities(htmlContent);

  // Patterns ordered by specificity (most specific first)
  const patterns = [
    // 1. CUSIP with label variations: "CUSIP No.", "CUSIP Number", "CUSIP #", "CUSIP:"
    /CUSIP\s*(?:No\.?|Number|#|:)?\s*(?:<[^>]*>|\s)*([A-Z0-9]{6}[A-Z0-9]{2}[0-9])/i,

    // 2. "(CUSIP Number)" label pattern with flexible spacing/tags
    /\(CUSIP\s*(?:No\.?|Number)?\)\s*(?:<[^>]*>|\s)*([A-Z0-9]{6}[A-Z0-9]{2}[0-9])/i,

    // 3. CUSIP in table cell - look for pattern after CUSIP text within 200 chars
    /CUSIP[\s\S]{0,200}?([A-Z0-9]{6}[A-Z0-9]{2}[0-9])/i,

    // 4. 9-char alphanumeric in HTML tag (broader than current pattern 4)
    />[\s]*([A-Z0-9]{6}[A-Z0-9]{2}[0-9])[\s]*</,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
    if (match?.[1]) {
      const cusip = match[1].toUpperCase();
      if (CUSIP_PATTERN.test(cusip)) {
        return cusip;
      }
    }
  }

  // Fallback: strip HTML tags and find CUSIP after "CUSIP" text
  const stripped = decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const cusipLabelIdx = stripped.toUpperCase().indexOf('CUSIP');

  if (cusipLabelIdx >= 0) {
    const afterLabel = stripped.slice(cusipLabelIdx);
    const match = afterLabel.match(/([A-Z0-9]{6}[A-Z0-9]{2}[0-9])/i);
    if (match?.[1]) {
      return match[1].toUpperCase();
    }
  }

  return undefined;
}

/**
 * Extract securities class title from HTML content
 */
function extractSecuritiesClass(htmlContent: string): string | undefined {
  const decoded = decodeHtmlEntities(htmlContent);

  // Look for title of class patterns
  const patterns = [
    /Title of Class of Securities[^>]*>[\s\S]*?<[^>]+>([^<]+)</i,
    /\(Title of Class[^)]*\)[\s\S]*?([A-Za-z][^<\n]{5,50})/i,
    /Class of Securities[:\s]*([A-Za-z][^\n<]{5,50})/i,
  ];

  for (const pattern of patterns) {
    const match = decoded.match(pattern);
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

    // Extract data from document content (XML and/or HTML sections)
    // Some filings have CUSIP in XML, others in HTML - search both
    const xmlStart = submissionText.indexOf('<XML>');
    const xmlEnd = submissionText.indexOf('</XML>');
    const htmlStart = submissionText.indexOf('<HTML>');

    // Build content to search: prefer XML first (more structured), then HTML
    let searchContent = submissionText; // fallback to full content
    if (xmlStart > -1 && xmlEnd > xmlStart) {
      searchContent = submissionText.slice(xmlStart, xmlEnd);
    }

    // Try XML first, then fall back to HTML content
    let cusip = extractCusip(searchContent);
    if (!cusip && htmlStart > -1) {
      cusip = extractCusip(submissionText.slice(htmlStart));
    }
    const htmlContent = htmlStart > -1 ? submissionText.slice(htmlStart) : submissionText;
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
