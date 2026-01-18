// Bloomberg-style chart types and interfaces

import type { QuarterlyChange } from '@/types/ownership'

// Time range options for the selector
export type TimeRange = '1Q' | '4Q' | '2Y' | 'ALL'

// Chart style variants
export type ChartStyle = 'advanced' | 'classic'

// Data series that can be toggled on/off
export type DataSeries =
  | 'newPositions'
  | 'addedPositions'
  | 'reducedPositions'
  | 'closedPositions'
  | 'netChange'
  | 'rollingAvg'
  | 'totalValue'

// Chart margin configuration
export interface ChartMargin {
  top: number
  right: number
  bottom: number
  left: number
}

// Dimensions passed to chart components
export interface ChartDimensions {
  width: number
  height: number
  margin: ChartMargin
  innerWidth: number
  innerHeight: number
}

// Processed data point for rendering
export interface ChartDataPoint {
  quarter: string
  index: number
  // Bullish metrics
  newPositions: number
  addedPositions: number
  bullishTotal: number
  // Bearish metrics
  reducedPositions: number
  closedPositions: number
  bearishTotal: number
  // Computed metrics
  netChange: number
  totalHolders: number
  totalValue: number
  // Rolling average (computed)
  rollingAvg: number | null
  // Original data reference
  original: QuarterlyChange
}

// Statistics summary for the stats panel
export interface ChartStats {
  // Counts
  totalNewPositions: number
  totalClosedPositions: number
  avgNetChange: number
  maxBullish: number
  maxBearish: number
  // Values
  totalValueChange: number
  avgTotalValue: number
  // Trends
  trendDirection: 'up' | 'down' | 'flat'
  trendPercent: number
}

// Crosshair position state
export interface CrosshairPosition {
  x: number // Chart-area relative x (for crosshair inside Group)
  y: number // Chart-area relative y (for crosshair inside Group)
  svgX: number // SVG root x (for tooltip positioning)
  svgY: number // SVG root y (for tooltip positioning)
  dataPoint: ChartDataPoint | null
  visible: boolean
}

// Brush/zoom selection state
export interface BrushSelection {
  startIndex: number
  endIndex: number
  start: number | null
  end: number | null
  isSelecting: boolean
}

// Series visibility state
export type SeriesVisibility = Record<DataSeries, boolean>

// Animation state
export interface AnimationState {
  isInitialRender: boolean
  isAnimating: boolean
  isComplete: boolean
  progress: number // 0 to 1
}

// Chart interaction state (managed by useChartInteraction)
export interface ChartInteractionState {
  crosshair: CrosshairPosition
  brush: BrushSelection
  hoveredBar: { quarter: string; type: 'bullish' | 'bearish' } | null
  focusedIndex: number // For keyboard navigation
  isPanning: boolean
}

// Chart configuration options
export interface ChartConfig {
  // Layout
  height: number
  margin: ChartMargin
  // Style
  style: ChartStyle
  // Features
  showCrosshair: boolean
  showBrush: boolean
  showRollingAvg: boolean
  showNetChangeLine: boolean
  showDualAxis: boolean
  showGrid: boolean
  showAnimations: boolean
  // Bar enhancements
  showValueLabels: boolean
  showChangeIndicators: boolean
  showZeroLine: boolean
  // Styling
  barPadding: number
  rollingAvgPeriod: number // Number of quarters for rolling average
}

// Default chart configuration
export const defaultChartConfig: ChartConfig = {
  height: 400,
  margin: { top: 40, right: 100, bottom: 60, left: 100 },
  style: 'classic',
  showCrosshair: true,
  showBrush: true,
  showRollingAvg: true,
  showNetChangeLine: true,
  showDualAxis: true,
  showGrid: true,
  showAnimations: true,
  showValueLabels: false,
  showChangeIndicators: false,
  showZeroLine: true,
  barPadding: 0.05,
  rollingAvgPeriod: 4,
}

// Default series visibility
export const defaultSeriesVisibility: SeriesVisibility = {
  newPositions: true,
  addedPositions: true,
  reducedPositions: true,
  closedPositions: true,
  netChange: true,
  rollingAvg: true,
  totalValue: true,
}

// Color palette for chart elements
export interface ChartColors {
  // Bullish colors
  bullishPrimary: string
  bullishSecondary: string
  bullishGradientStart: string
  bullishGradientEnd: string
  // Bearish colors
  bearishPrimary: string
  bearishSecondary: string
  bearishGradientStart: string
  bearishGradientEnd: string
  // Shadow colors for pseudo-3D effect (classic style)
  bullishShadow: string
  bearishShadow: string
  // Line colors
  netChangeLine: string
  rollingAvgLine: string
  valueLine: string
  // UI colors
  crosshair: string
  grid: string
  axis: string
  axisLabel: string
  brushSelection: string
  background: string
  // Text colors
  text: string
  textSecondary: string
  // Selection colors
  selection: string
}

// Light mode colors (Bloomberg style)
export const lightColors: ChartColors = {
  bullishPrimary: '#16a34a',
  bullishSecondary: '#4ade80',
  bullishGradientStart: '#22c55e',
  bullishGradientEnd: '#86efac',
  bearishPrimary: '#dc2626',
  bearishSecondary: '#f87171',
  bearishGradientStart: '#ef4444',
  bearishGradientEnd: '#fca5a5',
  bullishShadow: '#a3cfbb',
  bearishShadow: '#f5a3a3',
  netChangeLine: '#3b82f6',
  rollingAvgLine: '#8b5cf6',
  valueLine: '#f59e0b',
  crosshair: '#71717a',
  grid: '#e4e4e7',
  axis: '#a1a1aa',
  axisLabel: '#52525b',
  brushSelection: 'rgba(59, 130, 246, 0.2)',
  background: '#ffffff',
  text: '#18181b',
  textSecondary: '#52525b',
  selection: '#3b82f6',
}

// Classic colors (retro pseudo-3D with shadow bars)
export const classicColors: ChartColors = {
  // Dark forest green for bullish (matching retro financial chart style)
  bullishPrimary: '#1B3E26',
  bullishSecondary: '#2d5a3d',
  bullishGradientStart: '#1B3E26', // Same as primary for solid fill
  bullishGradientEnd: '#1B3E26',
  // Muted red for bearish
  bearishPrimary: '#7a2c2c',
  bearishSecondary: '#a85454',
  bearishGradientStart: '#7a2c2c',
  bearishGradientEnd: '#7a2c2c',
  // Shadow colors for pseudo-3D effect (lighter, desaturated)
  bullishShadow: '#5F7363',
  bearishShadow: '#a87070',
  // Line colors
  netChangeLine: '#2563eb',
  rollingAvgLine: '#7c3aed',
  valueLine: '#d97706',
  // UI colors - more classic/muted
  crosshair: '#6b7280',
  grid: '#e0e0e0',
  axis: '#333333',
  axisLabel: '#333333',
  brushSelection: 'rgba(37, 99, 235, 0.15)',
  background: '#ffffff',
  text: '#111827',
  textSecondary: '#4b5563',
  selection: '#2563eb',
}


// Keyboard navigation keys
export const CHART_KEYS = {
  LEFT: 'ArrowLeft',
  RIGHT: 'ArrowRight',
  UP: 'ArrowUp',
  DOWN: 'ArrowDown',
  HOME: 'Home',
  END: 'End',
  ESCAPE: 'Escape',
  ENTER: 'Enter',
  SPACE: ' ',
} as const

// Tooltip data structure
export interface TooltipData {
  dataPoint: ChartDataPoint
  position: { x: number; y: number }
  anchor: 'left' | 'right'
}

// Export button formats
export type ExportFormat = 'png' | 'svg'
