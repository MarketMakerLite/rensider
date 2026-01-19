'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { Badge } from '@/components/twc/badge'
import { dropdown, staggerContainer, staggerItem } from '@/lib/animations'
import { searchAll, type SearchResult } from '@/actions/search'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useIsMobile } from '@/hooks/useIsMobile'

export type { SearchResult }

/**
 * Highlights matching portions of text with a yellow background
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text

  const regex = new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
  const parts = text.split(regex)

  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-yellow-200 text-inherit rounded-sm px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'TSLA'] as const

interface SearchAutocompleteProps {
  placeholder?: string
  className?: string
}

/**
 * Custom hook for debounced search with loading state
 * Loading state is derived to avoid synchronous setState within effects
 */
function useDebouncedSearch(query: string, delay: number = 200) {
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [resultQuery, setResultQuery] = useState('') // Track which query the results are for
  const fetchRef = useRef(0)

  // Debounce the query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query)
    }, delay)
    return () => clearTimeout(timer)
  }, [query, delay])

  // Fetch results when debounced query changes
  useEffect(() => {
    if (debouncedQuery.length < 1) {
      return
    }

    const controller = new AbortController()
    const currentFetch = ++fetchRef.current

    searchAll(debouncedQuery, 8)
      .then((data) => {
        // Only update if this is still the most recent fetch and not aborted
        if (currentFetch === fetchRef.current && !controller.signal.aborted) {
          setResults(data)
          setResultQuery(debouncedQuery)
        }
      })
      .catch((error) => {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') return
        if (currentFetch === fetchRef.current && !controller.signal.aborted) {
          setResults([])
          setResultQuery(debouncedQuery)
        }
      })

    return () => controller.abort()
  }, [debouncedQuery])

  // Derive loading and results at return time
  const hasQuery = debouncedQuery.length >= 1
  const isLoading = hasQuery && debouncedQuery !== resultQuery
  return {
    results: hasQuery ? results : [],
    isLoading
  }
}

export function SearchAutocomplete({ placeholder = 'Search by ticker or institution...', className }: SearchAutocompleteProps) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const mobileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const isMobile = useIsMobile()

  // Global keyboard shortcut (Cmd+K or Ctrl+K)
  useEffect(() => {
    function handleGlobalKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [])

  // Use custom debounced search hook
  const { results, isLoading } = useDebouncedSearch(query)

  // Handle click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus mobile input when bottom sheet opens (with delay for animation)
  useEffect(() => {
    if (isMobile && isOpen) {
      const timer = setTimeout(() => {
        mobileInputRef.current?.focus()
      }, 100) // Wait for animation
      return () => clearTimeout(timer)
    }
  }, [isMobile, isOpen])

  // Navigate to selected result
  const navigateToResult = useCallback((result: SearchResult) => {
    setIsOpen(false)
    setQuery('')

    if (result.type === 'stock') {
      router.push(`/stock/${result.id}`)
    } else {
      router.push(`/fund/${result.id}`)
    }
  }, [router])

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Enter' && query.trim()) {
        // Direct navigation if no results shown
        const isCIK = /^\d+$/.test(query.trim())
        if (isCIK) {
          router.push(`/fund/${query.trim()}`)
        } else {
          router.push(`/stock/${query.trim().toUpperCase()}`)
        }
        setQuery('')
      }
      return
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : prev))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : prev))
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && results[selectedIndex]) {
          navigateToResult(results[selectedIndex])
        } else if (results.length > 0) {
          navigateToResult(results[0])
        }
        break
      case 'Escape':
        setIsOpen(false)
        setSelectedIndex(-1)
        break
    }
  }, [isOpen, results, selectedIndex, navigateToResult, query, router])

  // Search results content - reusable for both desktop dropdown and mobile bottom sheet
  const renderSearchResults = (forMobile = false) => {
    if (isLoading) {
      return (
        <div className="py-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 ${forMobile ? 'py-3' : 'py-2'}`}
            >
              {/* Badge skeleton */}
              <div className="h-5 w-12 animate-pulse rounded bg-zinc-200" />
              <div className="flex-1 space-y-1.5">
                {/* Title skeleton */}
                <div className="h-4 w-24 animate-pulse rounded bg-zinc-200" />
                {/* Subtitle skeleton */}
                <div className="h-3 w-32 animate-pulse rounded bg-zinc-100" />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (results.length > 0) {
      return (
        <motion.ul
          id="search-results"
          role="listbox"
          className="max-h-80 overflow-y-auto"
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
        >
          {results.map((result, index) => (
            <motion.li
              key={`${result.type}-${result.id}`}
              id={`search-result-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              variants={staggerItem}
            >
              <button
                type="button"
                className={`flex w-full items-center justify-between px-3 text-left transition-colors touch-target ${
                  forMobile ? 'min-h-[48px] py-3' : 'py-2'
                } ${
                  index === selectedIndex
                    ? 'bg-zinc-100 outline outline-2 outline-offset-[-2px] outline-zinc-400'
                    : 'hover:bg-zinc-50'
                }`}
                onClick={() => navigateToResult(result)}
                onMouseEnter={() => !forMobile && setSelectedIndex(index)}
              >
                <div className="flex items-center gap-2">
                  <Badge
                    color={result.type === 'stock' ? 'blue' : 'green'}
                    className="w-12 justify-center text-[10px]"
                  >
                    {result.type === 'stock' ? 'Stock' : 'Fund'}
                  </Badge>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-zinc-900">
                      {highlightMatch(result.type === 'stock' ? (result.ticker ?? result.name) : result.name, query)}
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {result.type === 'stock' ? highlightMatch(result.name, query) : `CIK: ${result.cik}`}
                    </div>
                  </div>
                </div>
                <svg className="h-3 w-3 flex-shrink-0 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </motion.li>
          ))}
        </motion.ul>
      )
    }

    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`px-4 text-center ${forMobile ? 'py-8' : 'py-4'}`}
      >
        <svg className="mx-auto h-6 w-6 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="mt-1.5 text-xs text-zinc-500">
          No results for &ldquo;{query}&rdquo;
        </p>
        <p className="mt-1 text-xs text-zinc-400">
          Press Enter to search directly
        </p>
      </motion.div>
    )
  }

  // Popular suggestions when dropdown is open but query is empty
  const renderPopularSuggestions = (forMobile = false) => (
    <div className={`${forMobile ? 'py-4' : 'py-3'} px-3`}>
      <p className="mb-2 text-xs font-medium text-zinc-500">Popular searches</p>
      <div className="flex flex-wrap gap-2">
        {POPULAR_TICKERS.map((ticker) => (
          <button
            key={ticker}
            type="button"
            onClick={() => {
              setQuery(ticker)
              setIsOpen(true)
            }}
            className={`rounded-full border border-zinc-200 bg-zinc-50 px-3 text-sm font-medium text-zinc-700 transition-colors hover:border-zinc-300 hover:bg-zinc-100 ${
              forMobile ? 'py-2' : 'py-1.5'
            }`}
          >
            {ticker}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Search Input */}
      <div className="relative border-2 border-[#4A4444] bg-white shadow-[4px_4px_0px_0px_#4A4444] transition-all duration-200 focus-within:translate-x-[2px] focus-within:translate-y-[2px] focus-within:shadow-none">
        {/* Search icon */}
        <svg
          className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            setSelectedIndex(-1)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          className="w-full bg-transparent py-2.5 pl-10 pr-3 text-sm font-medium text-zinc-950 placeholder:text-zinc-400 focus:outline-none"
          role="combobox"
          aria-expanded={isOpen && query.length >= 1}
          aria-haspopup="listbox"
          aria-controls="search-results"
          aria-autocomplete="list"
          aria-activedescendant={selectedIndex >= 0 ? `search-result-${selectedIndex}` : undefined}
        />
        {query ? (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setIsOpen(false)
              inputRef.current?.focus()
            }}
            className="absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-zinc-400 hover:text-zinc-600"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : (
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 flex items-center pr-3">
            <kbd className="hidden items-center gap-0.5 text-xs font-medium text-zinc-400 sm:inline-flex">
              <span>⌘</span>K
            </kbd>
          </div>
        )}
      </div>

      {/* Desktop Dropdown */}
      <AnimatePresence>
        {isMobile === false && isOpen && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={dropdown}
            className="absolute z-50 mt-2 w-full overflow-hidden border-2 border-[#4A4444] bg-white shadow-[4px_4px_0px_0px_#4A4444]"
          >
            {query.length >= 1 ? renderSearchResults(false) : renderPopularSuggestions(false)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Sheet */}
      <BottomSheet
        open={isMobile === true && isOpen}
        onClose={() => setIsOpen(false)}
        title={query.length === 0 ? 'Search' : isLoading ? 'Searching...' : results.length > 0 ? `${results.length} Results` : 'Search'}
      >
        {/* Search input inside sheet */}
        <div className="border-b border-zinc-100 px-4 pb-3">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              ref={mobileInputRef}
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setSelectedIndex(-1)
              }}
              onKeyDown={handleKeyDown}
              className="w-full bg-zinc-50 py-3 pl-10 pr-10 text-[16px] font-medium text-zinc-950 placeholder:text-zinc-400 focus:outline-none"
              style={{ borderRadius: '8px' }}
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('')
                  mobileInputRef.current?.focus()
                }}
                className="absolute inset-y-0 right-0 z-10 flex items-center pr-3 text-zinc-400"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Results or Popular Suggestions */}
        {query.length >= 1 ? renderSearchResults(true) : renderPopularSuggestions(true)}
      </BottomSheet>
    </div>
  )
}
