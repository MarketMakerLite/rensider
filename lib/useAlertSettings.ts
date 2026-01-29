'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  DEFAULT_MIN_CHANGE,
  DEFAULT_MAX_CHANGE,
  DEFAULT_MIN_START_VALUE,
  DEFAULT_LOOKBACK_MONTHS,
  MIN_CHANGE_OPTIONS,
  MAX_CHANGE_OPTIONS,
  MIN_START_VALUE_OPTIONS,
  LOOKBACK_OPTIONS,
} from './alert-constants'

// Re-export constants for convenience
export {
  DEFAULT_MIN_CHANGE,
  DEFAULT_MAX_CHANGE,
  DEFAULT_MIN_START_VALUE,
  DEFAULT_LOOKBACK_MONTHS,
  MIN_CHANGE_OPTIONS,
  MAX_CHANGE_OPTIONS,
  MIN_START_VALUE_OPTIONS,
  LOOKBACK_OPTIONS,
}

export interface AlertSettings {
  minChange: number // Minimum change multiple for accumulation detection (e.g., 3 = 300% increase)
  maxChange: number // Maximum change multiple to filter outliers
  minStartValue: number // Minimum starting value in thousands (e.g., 10000 = $10M)
  lookbackMonths: number // How far back to look for the comparison (e.g., 24 months)
  onlyMappedAssets: boolean // Only show alerts for assets with known ticker mappings
}

const STORAGE_KEY = 'renbot-alert-settings'

export const DEFAULT_SETTINGS: AlertSettings = {
  minChange: DEFAULT_MIN_CHANGE,
  maxChange: DEFAULT_MAX_CHANGE,
  minStartValue: DEFAULT_MIN_START_VALUE,
  lookbackMonths: DEFAULT_LOOKBACK_MONTHS,
  onlyMappedAssets: true, // Default to only showing known assets
}

function loadSettings(): AlertSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<AlertSettings>
      return {
        // Support legacy 'threshold' field
        minChange: parsed.minChange ?? (parsed as { threshold?: number }).threshold ?? DEFAULT_SETTINGS.minChange,
        maxChange: parsed.maxChange ?? DEFAULT_SETTINGS.maxChange,
        minStartValue: parsed.minStartValue ?? DEFAULT_SETTINGS.minStartValue,
        lookbackMonths: parsed.lookbackMonths ?? DEFAULT_SETTINGS.lookbackMonths,
        onlyMappedAssets: parsed.onlyMappedAssets ?? DEFAULT_SETTINGS.onlyMappedAssets,
      }
    }
  } catch {
    // Ignore parse errors, use defaults
  }

  return DEFAULT_SETTINGS
}

function saveSettings(settings: AlertSettings): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // Ignore storage errors (e.g., quota exceeded)
  }
}

export function useAlertSettings() {
  // Always initialize with defaults to avoid hydration mismatch
  const [settings, setSettingsState] = useState<AlertSettings>(DEFAULT_SETTINGS)
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage after hydration
  useEffect(() => {
    const storedSettings = loadSettings()
    setSettingsState(storedSettings) // eslint-disable-line react-hooks/set-state-in-effect -- load from localStorage
    setIsLoaded(true)
  }, [])

  const setSettings = useCallback((newSettings: AlertSettings) => {
    setSettingsState(newSettings)
    saveSettings(newSettings)
  }, [])

  const updateMinChange = useCallback((minChange: number) => {
    setSettingsState((prev) => {
      const newSettings = { ...prev, minChange }
      saveSettings(newSettings)
      return newSettings
    })
  }, [])

  const updateMaxChange = useCallback((maxChange: number) => {
    setSettingsState((prev) => {
      const newSettings = { ...prev, maxChange }
      saveSettings(newSettings)
      return newSettings
    })
  }, [])

  const updateMinStartValue = useCallback((minStartValue: number) => {
    setSettingsState((prev) => {
      const newSettings = { ...prev, minStartValue }
      saveSettings(newSettings)
      return newSettings
    })
  }, [])

  const updateLookbackMonths = useCallback((lookbackMonths: number) => {
    setSettingsState((prev) => {
      const newSettings = { ...prev, lookbackMonths }
      saveSettings(newSettings)
      return newSettings
    })
  }, [])

  const updateOnlyMappedAssets = useCallback((onlyMappedAssets: boolean) => {
    setSettingsState((prev) => {
      const newSettings = { ...prev, onlyMappedAssets }
      saveSettings(newSettings)
      return newSettings
    })
  }, [])

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS)
  }, [setSettings])

  return {
    settings,
    isLoaded,
    setSettings,
    updateMinChange,
    updateMaxChange,
    updateMinStartValue,
    updateLookbackMonths,
    updateOnlyMappedAssets,
    resetToDefaults,
  }
}
