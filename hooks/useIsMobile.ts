'use client'

import { useState, useEffect } from 'react'

/**
 * Hook to detect if viewport is below a given breakpoint
 * @param breakpoint - Width in pixels (default: 1024 for lg breakpoint)
 * @returns true when viewport width < breakpoint, undefined during SSR/initial render
 */
export function useIsMobile(breakpoint = 1024): boolean | undefined {
  const [isMobile, setIsMobile] = useState<boolean | undefined>(undefined)

  useEffect(() => {
    // Check initial value
    const checkMobile = () => {
      setIsMobile(window.innerWidth < breakpoint)
    }

    // Run initial check
    checkMobile()

    // Listen for resize events
    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches)
    }

    // Modern approach with addEventListener
    mediaQuery.addEventListener('change', handleChange)

    return () => {
      mediaQuery.removeEventListener('change', handleChange)
    }
  }, [breakpoint])

  return isMobile
}
