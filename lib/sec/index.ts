// SEC Data Module
// Provides access to SEC EDGAR data including Form 13F institutional holdings
// and Schedule 13D/13G beneficial ownership filings.

export * from './client';
export * from './download';
export * from './sync-state';

// Export db utilities (for Parquet file handling)
export {
  getParquetPath,
  getParquetGlob,
  convertTsvToParquet,
  readParquetFile,
  SUBMISSION_SCHEMA,
  COVERPAGE_SCHEMA,
  INFOTABLE_SCHEMA,
} from './db';

// Export query functions (preferred for data access)
export {
  getFilerHoldings,
  getSecurityHolders,
  getPositionChanges,
  getTopFilersByAUM,
  getRecentFilings,
  getSchedule13Activity,
  getRecentActivistActivity,
} from './queries';

export * from './schedule13-parser';
export * from './openfigi';
