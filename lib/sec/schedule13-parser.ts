/**
 * Schedule 13D/13G XML Parser
 *
 * Parses SEC EDGAR Schedule 13D and 13G XML filings into structured data.
 * Based on XSD schemas from EDGAR Schedule 13D and 13G XML Technical Specification.
 */

import type {
  ReportingPersonTypeCode,
  IntentCategory,
} from '@/types/activists';
import { parseIntentFromPurpose } from '@/types/activists';

// Parsed filing types

export interface Schedule13Filing {
  accessionNumber: string;
  formType: 'SC 13D' | 'SC 13D/A' | 'SC 13G' | 'SC 13G/A';
  filingDate: string;
  previousAccessionNumber?: string;

  // Issuer info
  issuerCik?: string;
  issuerName: string;
  issuerCusips: string[];
  issuerAddress?: Address;

  // Cover page
  securitiesClassTitle: string;
  eventDate?: string;
  amendmentNumber?: number;

  // Reporting persons
  reportingPersons: ReportingPersonInfo[];

  // Items (13D only - has narrative items 1-7)
  items?: {
    item1?: { securityTitle?: string; issuerName?: string };
    item2?: { filingPersonName?: string; principalBusinessAddress?: string };
    item3?: { fundsSource?: string };
    item4?: { transactionPurpose?: string };
    item5?: { percentageOfClassSecurities?: string; numberOfShares?: string };
    item6?: { contractDescription?: string };
    item7?: { filedExhibits?: string };
  };

  // Signatures
  signatures: SignatureInfo[];
}

export interface ReportingPersonInfo {
  reportingPersonCik?: string;
  reportingPersonName: string;
  memberOfGroup?: 'a' | 'b';

  // Ownership numbers
  soleVotingPower?: number;
  sharedVotingPower?: number;
  soleDispositivePower?: number;
  sharedDispositivePower?: number;
  aggregateAmountOwned?: number;
  percentOfClass?: number;

  // Classification
  typeOfReportingPerson: ReportingPersonTypeCode[];
  citizenshipOrOrganization?: string;

  // Derived
  intentFlags?: IntentCategory[];
}

export interface Address {
  street1?: string;
  street2?: string;
  city?: string;
  stateOrCountry?: string;
  zipCode?: string;
}

export interface SignatureInfo {
  reportingPersonName: string;
  signature?: string;
  title?: string;
  date?: string;
}

// XML parsing utilities

function getTextContent(element: Element | null): string | undefined {
  return element?.textContent?.trim() || undefined;
}

function getNumberContent(element: Element | null): number | undefined {
  const text = getTextContent(element);
  if (!text) return undefined;
  const num = parseFloat(text);
  return isNaN(num) ? undefined : num;
}

function querySelectorAll(parent: Element | Document, selector: string): Element[] {
  const results: Element[] = [];
  const tagName = selector.replace(/[[\]]/g, '');

  const search = (el: Element) => {
    if (el.localName === tagName || el.tagName === tagName) {
      results.push(el);
    }
    for (const child of Array.from(el.children)) {
      search(child);
    }
  };

  const root = parent instanceof Document ? parent.documentElement : parent;
  if (root) search(root);

  return results;
}

function findElement(parent: Element | Document, ...tagNames: string[]): Element | null {
  for (const tagName of tagNames) {
    const elements = querySelectorAll(parent, tagName);
    if (elements.length > 0) return elements[0];
  }
  return null;
}

function findElementText(parent: Element | Document, ...tagNames: string[]): string | undefined {
  const el = findElement(parent, ...tagNames);
  return getTextContent(el);
}

function findElementNumber(parent: Element | Document, ...tagNames: string[]): number | undefined {
  const el = findElement(parent, ...tagNames);
  return getNumberContent(el);
}

// Parse address from XML element
function parseAddress(addressEl: Element | null): Address | undefined {
  if (!addressEl) return undefined;

  return {
    street1: findElementText(addressEl, 'street1'),
    street2: findElementText(addressEl, 'street2'),
    city: findElementText(addressEl, 'city'),
    stateOrCountry: findElementText(addressEl, 'stateOrCountry', 'state'),
    zipCode: findElementText(addressEl, 'zipCode', 'zip'),
  };
}

// Parse reporting person from XML element
function parseReportingPerson(personEl: Element, purposeOfTransaction?: string): ReportingPersonInfo {
  const typeElements = querySelectorAll(personEl, 'typeOfReportingPerson');
  const types = typeElements
    .map(el => getTextContent(el))
    .filter((t): t is ReportingPersonTypeCode => !!t);

  const person: ReportingPersonInfo = {
    reportingPersonCik: findElementText(personEl, 'reportingPersonCIK'),
    reportingPersonName: findElementText(personEl, 'reportingPersonName') || 'Unknown',
    memberOfGroup: findElementText(personEl, 'memberOfGroup') as 'a' | 'b' | undefined,
    soleVotingPower: findElementNumber(personEl, 'soleVotingPower'),
    sharedVotingPower: findElementNumber(personEl, 'sharedVotingPower'),
    soleDispositivePower: findElementNumber(personEl, 'soleDispositivePower'),
    sharedDispositivePower: findElementNumber(personEl, 'sharedDispositivePower'),
    aggregateAmountOwned: findElementNumber(personEl, 'aggregateAmountOwned'),
    percentOfClass: findElementNumber(personEl, 'percentOfClass'),
    typeOfReportingPerson: types.length > 0 ? types : ['OO'],
    citizenshipOrOrganization: findElementText(personEl, 'citizenshipOrOrganization'),
  };

  // Parse intent from purpose of transaction if available
  if (purposeOfTransaction) {
    person.intentFlags = parseIntentFromPurpose(purposeOfTransaction);
  }

  return person;
}

// Parse signature from XML element
function parseSignature(sigEl: Element): SignatureInfo {
  const detailsEl = findElement(sigEl, 'signatureDetails');

  return {
    reportingPersonName: findElementText(sigEl, 'signatureReportingPerson') || 'Unknown',
    signature: detailsEl ? findElementText(detailsEl, 'signature') : undefined,
    title: detailsEl ? findElementText(detailsEl, 'title') : undefined,
    date: detailsEl ? findElementText(detailsEl, 'date') : undefined,
  };
}

/**
 * Parse a Schedule 13D or 13G XML document
 */
export function parseSchedule13Xml(
  xmlContent: string,
  accessionNumber: string,
  filingDate: string
): Schedule13Filing | null {
  try {
    // Use a simple DOM parser approach
    // In a full implementation, you'd use a proper XML parser
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlContent, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('XML parse error:', parseError.textContent);
      return null;
    }

    // Determine form type from submission type
    const submissionType = findElementText(doc, 'submissionType');
    let formType: Schedule13Filing['formType'];

    if (submissionType?.includes('13D/A')) {
      formType = 'SC 13D/A';
    } else if (submissionType?.includes('13D')) {
      formType = 'SC 13D';
    } else if (submissionType?.includes('13G/A')) {
      formType = 'SC 13G/A';
    } else if (submissionType?.includes('13G')) {
      formType = 'SC 13G';
    } else {
      // Default based on content detection
      formType = findElement(doc, 'schedule13D') ? 'SC 13D' : 'SC 13G';
    }

    // Parse cover page header
    const coverPageEl = findElement(doc, 'coverPageHeader');
    const issuerInfoEl = findElement(doc, 'issuerInfo');

    // Get CUSIP numbers
    const cusipElements = querySelectorAll(doc, 'issuerCusipNumber');
    const cusips = cusipElements
      .map(el => getTextContent(el))
      .filter((c): c is string => !!c);

    // Get purpose of transaction (for intent parsing)
    const purposeOfTransaction = findElementText(doc, 'transactionPurpose');

    // Parse reporting persons
    const reportingPersonEls = querySelectorAll(doc, 'reportingPersonInfo');
    const reportingPersons = reportingPersonEls.map(el =>
      parseReportingPerson(el, purposeOfTransaction)
    );

    // Parse signatures
    const signatureEls = querySelectorAll(doc, 'signaturePerson');
    const signatures = signatureEls.map(parseSignature);

    // Parse items (13D specific)
    let items: Schedule13Filing['items'];
    if (formType.includes('13D')) {
      const items1to7El = findElement(doc, 'items1To7');
      if (items1to7El) {
        items = {
          item1: {
            securityTitle: findElementText(items1to7El, 'securityTitle'),
            issuerName: findElementText(items1to7El, 'issuerName'),
          },
          item2: {
            filingPersonName: findElementText(items1to7El, 'filingPersonName'),
            principalBusinessAddress: findElementText(items1to7El, 'principalBusinessAddress'),
          },
          item3: {
            fundsSource: findElementText(items1to7El, 'fundsSource'),
          },
          item4: {
            transactionPurpose: purposeOfTransaction,
          },
          item5: {
            percentageOfClassSecurities: findElementText(items1to7El, 'percentageOfClassSecurities'),
            numberOfShares: findElementText(items1to7El, 'numberOfShares'),
          },
          item6: {
            contractDescription: findElementText(items1to7El, 'contractDescription'),
          },
          item7: {
            filedExhibits: findElementText(items1to7El, 'filedExhibits'),
          },
        };
      }
    }

    return {
      accessionNumber,
      formType,
      filingDate,
      previousAccessionNumber: findElementText(doc, 'previousAccessionNumber'),

      issuerCik: findElementText(issuerInfoEl || doc, 'issuerCIK'),
      issuerName: findElementText(issuerInfoEl || doc, 'issuerName') || 'Unknown Issuer',
      issuerCusips: cusips,
      issuerAddress: parseAddress(findElement(issuerInfoEl || doc, 'address')),

      securitiesClassTitle: findElementText(coverPageEl || doc, 'securitiesClassTitle') || '',
      eventDate: findElementText(coverPageEl || doc, 'dateOfEvent'),
      amendmentNumber: findElementNumber(coverPageEl || doc, 'amendmentNo'),

      reportingPersons,
      items,
      signatures,
    };
  } catch (error) {
    console.error(`Error parsing Schedule 13 XML for ${accessionNumber}:`, error);
    return null;
  }
}

/**
 * Convert parsed filing to flat records for Parquet storage
 */
export function filingToRecords(filing: Schedule13Filing): {
  filing: Record<string, unknown>;
  reportingPersons: Record<string, unknown>[];
} {
  // Aggregate ownership data from all reporting persons
  const totalSoleVoting = filing.reportingPersons.reduce(
    (sum, p) => sum + (p.soleVotingPower || 0),
    0
  );
  const totalSharedVoting = filing.reportingPersons.reduce(
    (sum, p) => sum + (p.sharedVotingPower || 0),
    0
  );
  const totalSoleDispositive = filing.reportingPersons.reduce(
    (sum, p) => sum + (p.soleDispositivePower || 0),
    0
  );
  const totalSharedDispositive = filing.reportingPersons.reduce(
    (sum, p) => sum + (p.sharedDispositivePower || 0),
    0
  );

  // Get primary reporting person's ownership percentage
  const primaryPerson = filing.reportingPersons[0];
  const percentOfClass = primaryPerson?.percentOfClass || 0;
  const aggregateOwned = primaryPerson?.aggregateAmountOwned || 0;

  const filingRecord: Record<string, unknown> = {
    ACCESSION_NUMBER: filing.accessionNumber,
    FORM_TYPE: filing.formType,
    FILING_DATE: filing.filingDate,
    PREVIOUS_ACCESSION_NUMBER: filing.previousAccessionNumber || null,

    ISSUER_CIK: filing.issuerCik || null,
    ISSUER_NAME: filing.issuerName,
    ISSUER_CUSIP: filing.issuerCusips[0] || null,
    SECURITIES_CLASS_TITLE: filing.securitiesClassTitle,

    EVENT_DATE: filing.eventDate || null,
    AMENDMENT_NUMBER: filing.amendmentNumber || 0,

    PERCENT_OF_CLASS: percentOfClass,
    AGGREGATE_AMOUNT_OWNED: aggregateOwned,
    SOLE_VOTING_POWER: totalSoleVoting,
    SHARED_VOTING_POWER: totalSharedVoting,
    SOLE_DISPOSITIVE_POWER: totalSoleDispositive,
    SHARED_DISPOSITIVE_POWER: totalSharedDispositive,

    PURPOSE_OF_TRANSACTION: filing.items?.item4?.transactionPurpose || null,
    SOURCE_OF_FUNDS: filing.items?.item3?.fundsSource || null,

    REPORTING_PERSON_COUNT: filing.reportingPersons.length,
  };

  const reportingPersonRecords = filing.reportingPersons.map((person, index) => ({
    ACCESSION_NUMBER: filing.accessionNumber,
    REPORTING_PERSON_SK: index + 1,
    REPORTING_PERSON_CIK: person.reportingPersonCik || null,
    REPORTING_PERSON_NAME: person.reportingPersonName,
    MEMBER_OF_GROUP: person.memberOfGroup || null,

    SOLE_VOTING_POWER: person.soleVotingPower || 0,
    SHARED_VOTING_POWER: person.sharedVotingPower || 0,
    SOLE_DISPOSITIVE_POWER: person.soleDispositivePower || 0,
    SHARED_DISPOSITIVE_POWER: person.sharedDispositivePower || 0,
    AGGREGATE_AMOUNT_OWNED: person.aggregateAmountOwned || 0,
    PERCENT_OF_CLASS: person.percentOfClass || 0,

    TYPE_OF_REPORTING_PERSON: person.typeOfReportingPerson.join(','),
    CITIZENSHIP_OR_ORGANIZATION: person.citizenshipOrOrganization || null,
    INTENT_FLAGS: person.intentFlags?.join(',') || null,
  }));

  return {
    filing: filingRecord,
    reportingPersons: reportingPersonRecords,
  };
}

// Schema definitions for Parquet
export const SCHEDULE13_FILING_SCHEMA = {
  ACCESSION_NUMBER: { type: 'UTF8' as const },
  FORM_TYPE: { type: 'UTF8' as const },
  FILING_DATE: { type: 'UTF8' as const },
  PREVIOUS_ACCESSION_NUMBER: { type: 'UTF8' as const, optional: true },

  ISSUER_CIK: { type: 'UTF8' as const, optional: true },
  ISSUER_NAME: { type: 'UTF8' as const },
  ISSUER_CUSIP: { type: 'UTF8' as const, optional: true },
  SECURITIES_CLASS_TITLE: { type: 'UTF8' as const },

  EVENT_DATE: { type: 'UTF8' as const, optional: true },
  AMENDMENT_NUMBER: { type: 'INT64' as const },

  PERCENT_OF_CLASS: { type: 'DOUBLE' as const },
  AGGREGATE_AMOUNT_OWNED: { type: 'DOUBLE' as const },
  SOLE_VOTING_POWER: { type: 'DOUBLE' as const },
  SHARED_VOTING_POWER: { type: 'DOUBLE' as const },
  SOLE_DISPOSITIVE_POWER: { type: 'DOUBLE' as const },
  SHARED_DISPOSITIVE_POWER: { type: 'DOUBLE' as const },

  PURPOSE_OF_TRANSACTION: { type: 'UTF8' as const, optional: true },
  SOURCE_OF_FUNDS: { type: 'UTF8' as const, optional: true },

  REPORTING_PERSON_COUNT: { type: 'INT64' as const },
};

export const SCHEDULE13_REPORTING_PERSON_SCHEMA = {
  ACCESSION_NUMBER: { type: 'UTF8' as const },
  REPORTING_PERSON_SK: { type: 'INT64' as const },
  REPORTING_PERSON_CIK: { type: 'UTF8' as const, optional: true },
  REPORTING_PERSON_NAME: { type: 'UTF8' as const },
  MEMBER_OF_GROUP: { type: 'UTF8' as const, optional: true },

  SOLE_VOTING_POWER: { type: 'DOUBLE' as const },
  SHARED_VOTING_POWER: { type: 'DOUBLE' as const },
  SOLE_DISPOSITIVE_POWER: { type: 'DOUBLE' as const },
  SHARED_DISPOSITIVE_POWER: { type: 'DOUBLE' as const },
  AGGREGATE_AMOUNT_OWNED: { type: 'DOUBLE' as const },
  PERCENT_OF_CLASS: { type: 'DOUBLE' as const },

  TYPE_OF_REPORTING_PERSON: { type: 'UTF8' as const },
  CITIZENSHIP_OR_ORGANIZATION: { type: 'UTF8' as const, optional: true },
  INTENT_FLAGS: { type: 'UTF8' as const, optional: true },
};