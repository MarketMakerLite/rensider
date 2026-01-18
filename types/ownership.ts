// Core entity types for institutional ownership tracking

export interface Institution {
  cik: string
  name: string
  lastUpdated: number // Unix timestamp
}

export interface Holding {
  id: number
  cik: string
  institutionName?: string
  ticker: string
  cusip: string
  securityName: string
  shares: number
  value: number // USD in thousands (as reported in 13F)
  filingDate: number // Unix timestamp
  reportDate: number // Quarter end date
  quarter: string // e.g., "2024Q1"
  putCall: 'PUT' | 'CALL' | null // null for equity positions
  changeType: 'NEW' | 'ADDED' | 'REDUCED' | 'CLOSED' | 'UNCHANGED' | null
  changePercent: number | null
}

export interface RecentFiler {
  cik: string
  institutionName: string
  filingDate: number
  shares: number
  value: number
  changeType: Holding['changeType']
  changePercent: number | null
}

export interface ConcentrationMetrics {
  top10Concentration: number
  herfindahlIndex: number
  largestHolderPercent: number
  largestHolderName: string | null
}

export interface StockOwnership {
  ticker: string
  companyName: string | null
  holders: Holding[]
  metrics: OwnershipMetrics
  sentiment: SentimentScore
  putCallRatio: number | null
  historicalChanges: QuarterlyChange[]
  recentFilers: RecentFiler[]
  concentrationMetrics: ConcentrationMetrics
  lastUpdated: number
}

export interface FundHoldings {
  cik: string
  institutionName: string
  holdings: Holding[]
  totalValue: number
  positionCount: number
  topHoldings: Holding[]
  lastUpdated: number
  // Enhanced analytics
  quarterlyHistory?: FundQuarterlyData[]
  positionChanges?: FundPositionChanges
  filingHistory?: Filing[]
  typeBreakdown?: FundSectorBreakdown[]
  concentration?: FundConcentration
  previousQuarterValue?: number
}

export interface FundQuarterlyData {
  quarter: string
  totalValue: number
  positionCount: number
  filingDate: number
}

export interface FundPositionChanges {
  newPositions: Array<{ ticker: string; securityName: string; value: number; shares: number }>
  closedPositions: Array<{ ticker: string; securityName: string; previousValue: number }>
  increasedPositions: Array<{ ticker: string; securityName: string; value: number; changePercent: number }>
  decreasedPositions: Array<{ ticker: string; securityName: string; value: number; changePercent: number }>
}

export interface FundSectorBreakdown {
  sector: string
  value: number
  count: number
  percentage: number
}

export interface FundConcentration {
  top5Percent: number
  top10Percent: number
  top20Percent: number
}

export interface OwnershipMetrics {
  totalHolders: number
  totalShares: number
  totalValue: number
  newPositions: number
  closedPositions: number
  increasedPositions: number
  decreasedPositions: number
  percentOfFloat: number | null
}

export interface SentimentScore {
  score: number // 0-100
  signal: 'BULLISH' | 'NEUTRAL' | 'BEARISH'
  components: {
    valueChange: number // QoQ change in aggregate institutional value (%)
    ownerCountChange: number // Change in number of holders (%)
    concentrationHHI: number // HHI concentration metric (normalized 0-100)
    newVsClosed: number // Net new vs closed positions ratio (%)
  }
}

export interface QuarterlyChange {
  quarter: string
  newPositions: number
  addedPositions: number
  reducedPositions: number
  closedPositions: number
  totalHolders: number
  totalValue: number
}

export interface Filing {
  accessionNumber: string
  cik: string
  institutionName: string
  filingDate: number
  reportDate: number
  quarter: string
  formType: string
  holdingsCount: number
  totalValue?: number
  prevHoldingsCount?: number | null
  prevTotalValue?: number
  holdingsCountChange?: number | null
  totalValueChange?: number | null
}

export interface Alert {
  id: number
  ticker: string
  companyName: string | null
  alertType: 'ACCUMULATION'
  previousValue: number
  currentValue: number
  changeMultiple: number
  periodMonths: number
  detectedAt: number
  filingDate?: number
  acknowledged: boolean
  /** Recent 12-month change ratio for sorting by momentum */
  recentChange?: number
  /** Name of the largest institutional holder */
  largestHolder?: string
  /** CIK of the largest institutional holder */
  largestHolderCik?: string
  /** Value held by the largest holder (in thousands) */
  largestHolderValue?: number
  /** Name of the entity that most recently filed on this security */
  latestFiler?: string
  /** CIK of the entity that most recently filed on this security */
  latestFilerCik?: string
}

export interface AlertStats {
  total: number
  topAlerts: Alert[]
}

// API response type aliases
export type StockOwnershipData = StockOwnership
export type FundHoldingsData = FundHoldings
export type OwnershipHistoryEntry = QuarterlyChange

// SEC EDGAR API types
export interface SECFiling {
  accessionNumber: string
  filingDate: string
  reportDate: string
  form: string
  fileUrl: string
}

export interface SECHolding {
  nameOfIssuer: string
  titleOfClass: string
  cusip: string
  value: number
  shrsOrPrnAmt: number
  putCall?: 'PUT' | 'CALL'
  investmentDiscretion: string
  otherManager?: string
  votingAuthority: {
    sole: number
    shared: number
    none: number
  }
}

export interface SECCompanyInfo {
  cik: string
  name: string
  tickers: string[]
  exchanges: string[]
}
