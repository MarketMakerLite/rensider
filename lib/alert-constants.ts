/**
 * Shared alert detection constants
 * Used by database queries, server functions, and UI components
 */

/** Default minimum change multiple for ownership accumulation detection (e.g., 3 = 300% increase) */
export const DEFAULT_MIN_CHANGE = 3

/** Default maximum change multiple to filter out erroneous data */
export const DEFAULT_MAX_CHANGE = 10

/** Default minimum starting value in thousands (e.g., 10000 = $10M) */
export const DEFAULT_MIN_START_VALUE = 10000

/** Default lookback period in months for detecting ownership changes */
export const DEFAULT_LOOKBACK_MONTHS = 12

/** Preset minimum change options for the UI */
export const MIN_CHANGE_OPTIONS = [
  { value: 2, label: '2x' },
  { value: 3, label: '3x' },
  { value: 5, label: '5x' },
  { value: 10, label: '10x' },
] as const

/** Preset maximum change options for the UI */
export const MAX_CHANGE_OPTIONS = [
  { value: 5, label: '5x' },
  { value: 10, label: '10x' },
  { value: 25, label: '25x' },
  { value: 50, label: '50x' },
  { value: 100, label: '100x' },
] as const

/** Preset minimum starting value options for the UI (in thousands) */
export const MIN_START_VALUE_OPTIONS = [
  { value: 1000, label: '$1M' },
  { value: 5000, label: '$5M' },
  { value: 10000, label: '$10M' },
  { value: 25000, label: '$25M' },
  { value: 50000, label: '$50M' },
] as const

/** Preset lookback period options for the UI */
export const LOOKBACK_OPTIONS = [
  { value: 12, label: '12 months' },
  { value: 18, label: '18 months' },
  { value: 24, label: '24 months' },
  { value: 36, label: '36 months' },
] as const

// Legacy exports for backwards compatibility
/** @deprecated Use DEFAULT_MIN_CHANGE instead */
export const DEFAULT_THRESHOLD = DEFAULT_MIN_CHANGE
/** @deprecated Use MIN_CHANGE_OPTIONS instead */
export const THRESHOLD_OPTIONS = MIN_CHANGE_OPTIONS
/** @deprecated Use DEFAULT_MAX_CHANGE instead */
export const MAX_CHANGE_MULTIPLE = DEFAULT_MAX_CHANGE
