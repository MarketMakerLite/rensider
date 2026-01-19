// =============================================
// BENEFICIAL OWNERSHIP TYPES (Schedule 13D/13G)
// For tracking 5%+ beneficial owners
// =============================================

// Entity types for beneficial owners
export type EntityType =
  | 'individual'
  | 'corporation'
  | 'partnership'
  | 'llc'
  | 'group'
  | 'trust'
  | 'other';

// Source of funds codes (SEC defined)
export type SourceOfFunds =
  | 'WC' // Working Capital
  | 'BK' // Bank Loan
  | 'AF' // Affiliate
  | 'PF' // Personal Funds
  | 'OO'; // Other

// Reporting person type codes (SEC defined)
export type ReportingPersonTypeCode =
  | 'BD' // Broker-Dealer
  | 'BK' // Bank
  | 'IC' // Insurance Company
  | 'IV' // Investment Company
  | 'IA' // Investment Adviser
  | 'EP' // Employee Benefit Plan
  | 'HC' // Holding Company
  | 'SA' // Savings Association
  | 'CP' // Corporation
  | 'CO' // Partnership
  | 'PN' // Pension Fund
  | 'IN' // Individual
  | 'OO'; // Other

// 13G filer classification
export type FilerType =
  | 'QII' // Qualified Institutional Investor (banks, brokers, etc.)
  | 'passive' // Passive investor (<20% and no control intent)
  | 'exempt'; // Exempt investor

// Intent categories (parsed from purpose of transaction)
export type IntentCategory =
  | 'passive' // Investment purposes only
  | 'activist' // Seeking to influence management
  | 'board' // Seeking board representation
  | 'merger' // Related to merger/acquisition
  | 'proxy' // Proxy contest
  | 'restructuring' // Seeking restructuring
  | 'other';

// Event types for ownership changes
export type OwnershipEventType =
  | 'initial' // First filing (crossed 5%)
  | 'increase' // Increased position
  | 'decrease' // Decreased position
  | 'exit' // Dropped below 5%
  | 'form_change'; // Changed from 13G to 13D or vice versa

// Alert types
export type BeneficialOwnershipAlertType =
  | 'new_13d' // New activist filing
  | 'new_13g' // New passive 5%+ holder
  | '13g_to_13d' // Passive investor turned activist
  | 'crossed_5pct' // Any new 5%+ position
  | 'activist_increase' // Activist increased stake
  | 'activist_decrease' // Activist decreased stake
  | 'major_exit'; // 5%+ holder exited

// =============================================
// DATA MODELS
// =============================================

export interface BeneficialOwner {
  id: number;
  name: string;
  cik: string | null;
  address: {
    street: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  };
  entityType: EntityType;
  createdAt: number;
  updatedAt: number;
}

export interface Schedule13DFiling {
  accessionNumber: string;

  // Issuer
  issuerName: string;
  issuerTicker: string | null;
  issuerCusip: string;
  issuerCik: string | null;

  // Metadata
  filingDate: number;
  eventDate: number | null;
  amendmentNumber: number;
  supersedesAccession: string | null;

  // Ownership
  sharesBeneficiallyOwned: number;
  percentOfClass: number;

  // Voting power
  soleVotingPower: number;
  sharedVotingPower: number;
  noVotingPower: number;

  // Dispositive power
  soleDispositivePower: number;
  sharedDispositivePower: number;

  // Funds & intent
  sourceOfFunds: SourceOfFunds | null;
  sourceOfFundsDescription: string | null;
  purposeOfTransaction: string;
  intentFlags: IntentCategory[];

  // Filer info
  reportingPersonType: ReportingPersonTypeCode | null;
  isGroupFiling: boolean;

  // Filers (populated via join)
  filers?: BeneficialOwner[];

  rawXmlUrl: string | null;
  createdAt: number;
}

export interface Schedule13GFiling {
  accessionNumber: string;

  // Issuer
  issuerName: string;
  issuerTicker: string | null;
  issuerCusip: string;
  issuerCik: string | null;

  // Metadata
  filingDate: number;
  amendmentNumber: number;
  supersedesAccession: string | null;

  // Ownership
  sharesBeneficiallyOwned: number;
  percentOfClass: number;

  // Voting power
  soleVotingPower: number;
  sharedVotingPower: number;
  noVotingPower: number;

  // Dispositive power
  soleDispositivePower: number;
  sharedDispositivePower: number;

  // Classification
  filerType: FilerType;

  // Filers (populated via join)
  filers?: BeneficialOwner[];

  rawXmlUrl: string | null;
  createdAt: number;
}

export interface BeneficialOwnershipEvent {
  id: number;

  // What
  ticker: string;
  cusip: string;
  ownerId: number;
  ownerName: string;

  // Filing
  filingType: '13D' | '13D/A' | '13G' | '13G/A';
  accessionNumber: string;
  filingDate: number;

  // Change
  previousShares: number | null;
  currentShares: number;
  sharesChange: number | null;

  previousPercent: number | null;
  currentPercent: number;
  percentChange: number | null;

  // Classification
  eventType: OwnershipEventType;

  // Intent (13D only)
  purposeSummary: string | null;
  intentCategory: IntentCategory | null;

  createdAt: number;
}

export interface BeneficialOwnershipAlert {
  id: number;

  ticker: string;
  ownerName: string;

  alertType: BeneficialOwnershipAlertType;

  filingType: string;
  accessionNumber: string;
  filingDate: number;

  percentOfClass: number;
  previousPercent: number | null;

  headline: string;
  summary: string | null;

  detectedAt: number;
  acknowledged: boolean;
}

// =============================================
// API RESPONSE TYPES
// =============================================

export interface TickerBeneficialOwnership {
  ticker: string;
  issuerName: string | null;

  // Current 5%+ holders
  majorHolders: MajorHolder[];

  // Recent events
  recentEvents: BeneficialOwnershipEvent[];

  // Stats
  stats: {
    totalMajorHolders: number;
    activistCount: number;
    totalBeneficialOwnership: number; // Sum of all 5%+ positions
    latestFilingDate: number | null;
  };
}

export interface MajorHolder {
  ownerId: number;
  ownerName: string;
  entityType: EntityType;

  // Current position
  shares: number;
  percentOfClass: number;

  // Latest filing
  latestFilingType: '13D' | '13G';
  latestFilingDate: number;
  latestAccession: string;

  // For 13D holders
  intentCategory: IntentCategory | null;
  purposeSummary: string | null;

  // History
  positionHistory: {
    date: number;
    percent: number;
    filingType: string;
  }[];
}

export interface ActivistActivity {
  accessionNumber: string;
  filingDate: number;

  // Filer
  ownerName: string;
  ownerCik: string;

  // Target
  ticker: string;
  issuerName: string;
  issuerCik: string;

  // Position
  percentOfClass: number;
  shares: number;

  // Intent
  intentCategory: IntentCategory;
  purposeSummary: string;

  // Change
  eventType: OwnershipEventType;
  previousPercent: number | null;
}

export interface OwnerProfile {
  owner: BeneficialOwner;

  // Current positions
  currentPositions: {
    ticker: string;
    issuerName: string;
    percentOfClass: number;
    shares: number;
    filingType: '13D' | '13G';
    latestFilingDate: number;
    intentCategory: IntentCategory | null;
  }[];

  // Filing history
  filingHistory: (Schedule13DFiling | Schedule13GFiling)[];

  // Stats
  stats: {
    totalPositions: number;
    activistPositions: number;
    totalValue: number | null;
    averagePosition: number;
  };
}

// =============================================
// INPUT TYPES FOR MUTATIONS
// =============================================

export type BeneficialOwnerInput = Omit<
  BeneficialOwner,
  'id' | 'createdAt' | 'updatedAt'
>;

export type Schedule13DFilingInput = Omit<
  Schedule13DFiling,
  'createdAt' | 'filers'
>;

export type Schedule13GFilingInput = Omit<
  Schedule13GFiling,
  'createdAt' | 'filers'
>;

export type BeneficialOwnershipEventInput = Omit<
  BeneficialOwnershipEvent,
  'id' | 'createdAt'
>;

export type BeneficialOwnershipAlertInput = Omit<
  BeneficialOwnershipAlert,
  'id' | 'detectedAt' | 'acknowledged'
>;

// =============================================
// INTENT PARSING UTILITIES
// =============================================

const INTENT_KEYWORDS: Record<IntentCategory, string[]> = {
  passive: [
    'investment purposes',
    'ordinary course',
    'no present intention',
    'passive investment',
  ],
  activist: [
    'influence management',
    'change in control',
    'strategic alternatives',
    'maximize shareholder value',
    'operational improvements',
  ],
  board: [
    'board representation',
    'board seats',
    'director nomination',
    'elect directors',
  ],
  merger: [
    'merger',
    'acquisition',
    'tender offer',
    'business combination',
    'going private',
  ],
  proxy: ['proxy', 'solicitation', 'consent', 'shareholder proposal'],
  restructuring: [
    'restructuring',
    'recapitalization',
    'spin-off',
    'sale of assets',
    'dividend',
  ],
  other: [],
};

export function parseIntentFromPurpose(purpose: string): IntentCategory[] {
  const lowercasePurpose = purpose.toLowerCase();
  const intents: IntentCategory[] = [];

  for (const [category, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (category === 'other') continue;

    for (const keyword of keywords) {
      if (lowercasePurpose.includes(keyword.toLowerCase())) {
        intents.push(category as IntentCategory);
        break;
      }
    }
  }

  // Default to passive if no specific intent detected
  if (intents.length === 0) {
    intents.push('passive');
  }

  return intents;
}

export function getPrimaryIntent(intents: IntentCategory[]): IntentCategory {
  // Priority order: activist > board > merger > proxy > restructuring > passive
  const priority: IntentCategory[] = [
    'activist',
    'board',
    'merger',
    'proxy',
    'restructuring',
    'passive',
    'other',
  ];

  for (const intent of priority) {
    if (intents.includes(intent)) {
      return intent;
    }
  }

  return 'other';
}
