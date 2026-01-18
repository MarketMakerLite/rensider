'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

interface UseServerActionOptions<T> {
  /** Whether to fetch immediately on mount */
  enabled?: boolean
  /** Initial data */
  initialData?: T
}

interface UseServerActionResult<T> {
  data: T | undefined
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook to call server actions with loading/error state management.
 * Replaces TanStack Query's useQuery for server action calls.
 */
export function useServerAction<T>(
  actionFn: () => Promise<T>,
  options: UseServerActionOptions<T> = {}
): UseServerActionResult<T> {
  const { enabled = true, initialData } = options
  const [data, setData] = useState<T | undefined>(initialData)
  const [isLoading, setIsLoading] = useState(enabled)
  const [error, setError] = useState<Error | null>(null)

  // Track if this is the initial mount
  const isMounted = useRef(true)
  const fetchRef = useRef(0)

  const fetchData = useCallback(async () => {
    const currentFetch = ++fetchRef.current
    setIsLoading(true)
    setError(null)

    try {
      const result = await actionFn()
      // Only update state if this is the most recent fetch and component is mounted
      if (currentFetch === fetchRef.current && isMounted.current) {
        setData(result)
      }
    } catch (err) {
      if (currentFetch === fetchRef.current && isMounted.current) {
        setError(err instanceof Error ? err : new Error('An error occurred'))
      }
    } finally {
      if (currentFetch === fetchRef.current && isMounted.current) {
        setIsLoading(false)
      }
    }
  }, [actionFn])

  useEffect(() => {
    isMounted.current = true

    if (enabled) {
      fetchData()
    }

    return () => {
      isMounted.current = false
    }
  }, [enabled, fetchData])

  const refetch = useCallback(async () => {
    await fetchData()
  }, [fetchData])

  return { data, isLoading, error, refetch }
}
