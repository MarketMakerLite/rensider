// =============================================
// INSIDER SALES TYPES (Form 3/4/5)
// For tracking insider transactions and holdings
// =============================================

// Relationship types for reporting owners
export type InsiderRelationship =
  | 'Director'
  | 'Officer'
  | 'TenPercentOwner'
  | 'Other';

// Transaction codes (SEC defined)
export type TransactionCode =
  | 'P'  // Open market purchase
  | 'S'  // Open market sale
  | 'A'  // Grant/Award
  | 'D'  // Sale to issuer
  | 'F'  // Payment of exercise price
  | 'I'  // Discretionary transaction
  | 'M'  // Exercise of derivative
  | 'C'  // Conversion of derivative
  | 'E'  // Expiration of short derivative
  | 'H'  // Expiration of long derivative
  | 'O'  // Exercise of out-of-money derivative
  | 'X'  // Exercise of in-the-money derivative
  | 'G'  // Gift
  | 'L'  // Small acquisition
  | 'W'  // Acquisition by will/laws of descent
  | 'Z'  // Deposit/withdrawal from voting trust
  | 'J'  // Other acquisition/disposition
  | 'K'  // Equity swap
  | 'U'  // Tender of shares
  | 'V'; // Transaction voluntarily reported

// Acquired or disposed
export type AcquiredDisposedCode = 'A' | 'D';

// Direct or indirect ownership
export type OwnershipType = 'D' | 'I';

// Form type
export type Form345Type = '3' | '4' | '5';

// =============================================
// DATABASE ROW TYPES (match DuckDB schema)
// =============================================

export interface Form345Submission {
  accessionNumber: string;
  filingDate: string;        // DD-MMM-YYYY format from SEC
  periodOfReport: string;
  dateOfOrigSub: string | null;
  noSecuritiesOwned: boolean;
  notSubjectSec16: boolean;
  form3HoldingsReported: boolean;
  form4TransReported: boolean;
  documentType: Form345Type;
  issuerCik: string;
  issuerName: string;
  issuerTradingSymbol: string | null;
  remarks: string | null;
  aff10b5One: boolean;
}

export interface Form345ReportingOwner {
  accessionNumber: string;
  rptOwnerCik: string;
  rptOwnerName: string;
  rptOwnerRelationship: InsiderRelationship;
  rptOwnerTitle: string | null;
  rptOwnerStreet1: string | null;
  rptOwnerStreet2: string | null;
  rptOwnerCity: string | null;
  rptOwnerState: string | null;
  rptOwnerZipCode: string | null;
  fileNumber: string | null;
}

export interface Form345NonderivTrans {
  accessionNumber: string;
  nonderivTransSk: number;
  securityTitle: string;
  transDate: string;
  deemedExecutionDate: string | null;
  transFormType: Form345Type;
  transCode: TransactionCode;
  equitySwapInvolved: boolean;
  transTimeliness: string | null;
  transShares: number | null;
  transPricePerShare: number | null;
  transAcquiredDispCd: AcquiredDisposedCode;
  shrsOwndFollwngTrans: number | null;
  valuOwndFollwngTrans: number | null;
  directIndirectOwnership: OwnershipType;
  natureOfOwnership: string | null;
}

export interface Form345NonderivHolding {
  accessionNumber: string;
  nonderivHoldingSk: number;
  securityTitle: string;
  shrsOwndFollwngTrans: number | null;
  valuOwndFollwngTrans: number | null;
  directIndirectOwnership: OwnershipType;
  natureOfOwnership: string | null;
}

export interface Form345DerivTrans {
  accessionNumber: string;
  derivTransSk: number;
  securityTitle: string;
  conversionOrExercisePrice: number | null;
  transDate: string;
  deemedExecutionDate: string | null;
  transFormType: Form345Type;
  transCode: TransactionCode;
  equitySwapInvolved: boolean;
  transTimeliness: string | null;
  transShares: number | null;
  transTotalValue: number | null;
  transPricePerShare: number | null;
  transAcquiredDispCd: AcquiredDisposedCode;
  exerciseDate: string | null;
  expirationDate: string | null;
  underlyingSecurityTitle: string | null;
  underlyingSecurityShares: number | null;
  underlyingSecurityValue: number | null;
  shrsOwndFollwngTrans: number | null;
  directIndirectOwnership: OwnershipType;
  natureOfOwnership: string | null;
}

export interface Form345DerivHolding {
  accessionNumber: string;
  derivHoldingSk: number;
  securityTitle: string;
  conversionOrExercisePrice: number | null;
  exerciseDate: string | null;
  expirationDate: string | null;
  underlyingSecurityTitle: string | null;
  underlyingSecurityShares: number | null;
  underlyingSecurityValue: number | null;
  shrsOwndFollwngTrans: number | null;
  directIndirectOwnership: OwnershipType;
  natureOfOwnership: string | null;
}

// =============================================
// API RESPONSE TYPES
// =============================================

export interface InsiderTransaction {
  accessionNumber: string;
  filingDate: number;         // Unix timestamp
  transactionDate: number;    // Unix timestamp

  // Issuer
  ticker: string;
  issuerName: string;
  issuerCik: string;

  // Insider
  insiderCik: string;
  insiderName: string;
  insiderTitle: string | null;
  relationship: InsiderRelationship;

  // Transaction
  securityTitle: string;
  transactionCode: TransactionCode;
  acquiredDisposed: AcquiredDisposedCode;
  shares: number;
  pricePerShare: number | null;
  totalValue: number | null;
  sharesOwnedAfter: number | null;

  // Flags
  isDerivative: boolean;
  ownershipType: OwnershipType;
}

export interface InsiderHolding {
  accessionNumber: string;
  filingDate: number;

  // Issuer
  ticker: string;
  issuerName: string;

  // Insider
  insiderCik: string;
  insiderName: string;
  relationship: InsiderRelationship;

  // Holding
  securityTitle: string;
  sharesOwned: number;
  valueOwned: number | null;
  ownershipType: OwnershipType;
  isDerivative: boolean;
}

export interface RecentInsiderActivity {
  transactions: InsiderTransaction[];
  totalCount: number;
}

export interface TickerInsiderActivity {
  ticker: string;
  issuerName: string;

  // Recent transactions
  recentTransactions: InsiderTransaction[];

  // Summary stats
  stats: {
    totalInsiders: number;
    netSharesLast30Days: number;
    netSharesLast90Days: number;
    totalBuysLast90Days: number;
    totalSalesLast90Days: number;
    largestTransaction: InsiderTransaction | null;
  };

  // Top insiders by activity
  topInsiders: {
    cik: string;
    name: string;
    title: string | null;
    relationship: InsiderRelationship;
    transactionCount: number;
    netShares: number;
  }[];
}

export interface InsiderProfile {
  cik: string;
  name: string;

  // Current positions
  currentPositions: {
    ticker: string;
    issuerName: string;
    relationship: InsiderRelationship;
    title: string | null;
    sharesOwned: number;
    lastFilingDate: number;
  }[];

  // Transaction history
  recentTransactions: InsiderTransaction[];

  // Stats
  stats: {
    totalCompanies: number;
    totalTransactions: number;
    netSharesAllTime: number;
  };
}

// =============================================
// UTILITY TYPES
// =============================================

export const TRANSACTION_CODE_LABELS: Record<TransactionCode, string> = {
  'P': 'Purchase',
  'S': 'Sale',
  'A': 'Grant/Award',
  'D': 'Sale to Issuer',
  'F': 'Exercise Payment',
  'I': 'Discretionary',
  'M': 'Exercise',
  'C': 'Conversion',
  'E': 'Expiration (Short)',
  'H': 'Expiration (Long)',
  'O': 'Out-of-Money Exercise',
  'X': 'In-the-Money Exercise',
  'G': 'Gift',
  'L': 'Small Acquisition',
  'W': 'Inheritance',
  'Z': 'Voting Trust',
  'J': 'Other',
  'K': 'Equity Swap',
  'U': 'Tender',
  'V': 'Voluntary Report',
};

export const RELATIONSHIP_LABELS: Record<InsiderRelationship, string> = {
  'Director': 'Director',
  'Officer': 'Officer',
  'TenPercentOwner': '10% Owner',
  'Other': 'Other',
};

export function isSignificantTransaction(trans: InsiderTransaction): boolean {
  // Sales or purchases of significant size
  if (trans.transactionCode === 'S' || trans.transactionCode === 'P') {
    if (trans.totalValue && trans.totalValue >= 100000) return true;
    if (trans.shares >= 10000) return true;
  }
  return false;
}

export function formatTransactionCode(code: TransactionCode): string {
  return TRANSACTION_CODE_LABELS[code] || code;
}
