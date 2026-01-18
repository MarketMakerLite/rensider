'use client'

import { useState, useMemo, useCallback } from 'react'

export type SortDirection = 'asc' | 'desc' | null

export interface SortState<T extends string> {
  column: T | null
  direction: SortDirection
}

export interface SecondarySortConfig<K extends string> {
  column: K
  direction: 'asc' | 'desc'
}

function compareValues(
  aVal: unknown,
  bVal: unknown,
  direction: 'asc' | 'desc'
): number {
  // Handle null/undefined
  if (aVal == null && bVal == null) return 0
  if (aVal == null) return direction === 'asc' ? -1 : 1
  if (bVal == null) return direction === 'asc' ? 1 : -1

  // Handle numbers
  if (typeof aVal === 'number' && typeof bVal === 'number') {
    return direction === 'asc' ? aVal - bVal : bVal - aVal
  }

  // Handle strings
  const aStr = String(aVal).toLowerCase()
  const bStr = String(bVal).toLowerCase()
  const comparison = aStr.localeCompare(bStr)
  return direction === 'asc' ? comparison : -comparison
}

export function useTableSort<T extends object, K extends keyof T & string>(
  data: T[],
  defaultColumn?: K,
  defaultDirection: SortDirection = 'desc',
  secondarySort?: SecondarySortConfig<K>
) {
  const [sortState, setSortState] = useState<SortState<K>>({
    column: defaultColumn ?? null,
    direction: defaultColumn ? defaultDirection : null,
  })

  const toggleSort = useCallback((column: K) => {
    setSortState((prev) => {
      if (prev.column !== column) {
        return { column, direction: 'desc' }
      }
      if (prev.direction === 'desc') {
        return { column, direction: 'asc' }
      }
      return { column: null, direction: null }
    })
  }, [])

  // Memoize secondary sort config
  const secondaryColumn = secondarySort?.column
  const secondaryDirection = secondarySort?.direction

  const sortedData = useMemo(() => {
    // Early return for small datasets - no sorting needed
    if (data.length <= 1) {
      return data
    }

    if (!sortState.column || !sortState.direction) {
      // If no primary sort but secondary exists, use secondary only
      if (secondaryColumn && secondaryDirection) {
        return [...data].sort((a, b) => {
          return compareValues(
            a[secondaryColumn],
            b[secondaryColumn],
            secondaryDirection
          )
        })
      }
      return data
    }

    return [...data].sort((a, b) => {
      const primaryResult = compareValues(
        a[sortState.column!],
        b[sortState.column!],
        sortState.direction!
      )

      // If primary sort is equal and secondary sort exists, use secondary
      if (primaryResult === 0 && secondaryColumn && secondaryDirection) {
        return compareValues(
          a[secondaryColumn],
          b[secondaryColumn],
          secondaryDirection
        )
      }

      return primaryResult
    })
  }, [data, sortState.column, sortState.direction, secondaryColumn, secondaryDirection])

  return {
    sortedData,
    sortState,
    toggleSort,
  }
}

export function useTableFilter<T extends object>(
  data: T[],
  filterKeys: (keyof T)[]
) {
  const [filterValue, setFilterValue] = useState('')

  const filteredData = useMemo(() => {
    if (!filterValue.trim()) {
      return data
    }

    const searchLower = filterValue.toLowerCase().trim()

    return data.filter((item) =>
      filterKeys.some((key) => {
        const value = item[key]
        if (value == null) return false
        return String(value).toLowerCase().includes(searchLower)
      })
    )
  }, [data, filterValue, filterKeys])

  return {
    filteredData,
    filterValue,
    setFilterValue,
  }
}

export interface PaginationState {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
}

export function usePagination<T>(
  data: T[],
  defaultPageSize: number = 25
) {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(defaultPageSize)
  const [prevDataLength, setPrevDataLength] = useState(data.length)

  // Reset to page 1 when data length changes (e.g., after filtering)
  // Using derived state pattern instead of useEffect to avoid extra render
  if (data.length !== prevDataLength) {
    setPrevDataLength(data.length)
    if (page !== 1) {
      setPage(1)
    }
  }

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize))

  // Ensure page is within bounds
  const currentPage = Math.min(Math.max(1, page), totalPages)

  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    const end = start + pageSize
    return data.slice(start, end)
  }, [data, currentPage, pageSize])

  const goToPage = useCallback((newPage: number) => {
    setPage(Math.min(Math.max(1, newPage), totalPages))
  }, [totalPages])

  const nextPage = useCallback(() => {
    setPage((p) => Math.min(p + 1, totalPages))
  }, [totalPages])

  const prevPage = useCallback(() => {
    setPage((p) => Math.max(p - 1, 1))
  }, [])

  const changePageSize = useCallback((newSize: number) => {
    setPageSize(newSize)
    setPage(1)
  }, [])

  return {
    paginatedData,
    pagination: {
      page: currentPage,
      pageSize,
      totalItems: data.length,
      totalPages,
    },
    goToPage,
    nextPage,
    prevPage,
    changePageSize,
  }
}
