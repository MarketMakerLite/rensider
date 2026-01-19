'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'motion/react'
import { Badge } from '@/components/twc/badge'
import { dropdown, staggerContainer, staggerItem } from '@/lib/animations'
import { searchAll, type SearchResult } from '@/actions/search'
import { SearchLoadingMessage } from '@/components/ui/Spinner'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useIsMobile } from '@/hooks/useIsMobile'

export type { SearchResult }

interface SearchAutocompleteProps {
  placeholder?: string
  className?: string
}

/**
 * Custom hook for debounced search with loading state
 */
function useDebouncedSearch(query: string, delay: number = 200) {
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
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
      setResults([])
      setIsLoading(false)
      return
    }

    const controller = new AbortController()
    const currentFetch = ++fetchRef.current
    setIsLoading(true)

    searchAll(debouncedQuery, 8)
      .then((data) => {
        // Only update if this is still the most recent fetch and not aborted
        if (currentFetch === fetchRef.current && !controller.signal.aborted) {
          setResults(data)
        }
      })
      .catch((error) => {
        // Ignore abort errors
        if (error instanceof Error && error.name === 'AbortError') return
        if (currentFetch === fetchRef.current && !controller.signal.aborted) {
          setResults([])
        }
      })
      .finally(() => {
        if (currentFetch === fetchRef.current && !controller.signal.aborted) {
          setIsLoading(false)
        }
      })

    return () => controller.abort()
  }, [debouncedQuery])

  return { results, isLoading }
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
    if (isMobile && isOpen && query.length >= 1) {
      const timer = setTimeout(() => {
        mobileInputRef.current?.focus()
      }, 100) // Wait for animation
      return () => clearTimeout(timer)
    }
  }, [isMobile, isOpen, query.length])

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
        <div className={`flex items-center gap-2 px-3 font-sans text-xs text-zinc-500 ${forMobile ? 'py-4' : 'py-2.5'}`}>
          <svg className="h-3 w-3 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <SearchLoadingMessage className="text-zinc-500" />
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
                    ? 'bg-zinc-100'
                    : 'hover:bg-zinc-50'
                }`}
                onClick={() => navigateToResult(result)}
                onMouseEnter={() => !forMobile && setSelectedIndex(index)}
              >
                <div className="flex items-center gap-2">
                  <Badge
                    color={result.type === 'stock' ? 'blue' : 'green'}
                    className="w-10 justify-center text-[9px]"
                  >
                    {result.type === 'stock' ? 'Stock' : 'Fund'}
                  </Badge>
                  <div className="min-w-0 font-sans">
                    <div className="truncate text-sm font-medium text-zinc-900">
                      {result.type === 'stock' ? result.ticker : result.name}
                    </div>
                    <div className="truncate text-xs text-zinc-500">
                      {result.type === 'stock' ? result.name : `CIK: ${result.cik}`}
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
        className={`px-4 text-center font-sans ${forMobile ? 'py-8' : 'py-4'}`}
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
          className="w-full bg-transparent py-2.5 pl-10 pr-3 font-sans text-sm font-medium text-zinc-950 placeholder:text-zinc-400 focus:outline-none"
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
        {isMobile === false && isOpen && query.length >= 1 && (
          <motion.div
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={dropdown}
            className="absolute z-50 mt-2 w-full overflow-hidden border-2 border-[#4A4444] bg-white shadow-[4px_4px_0px_0px_#4A4444]"
          >
            {renderSearchResults(false)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Bottom Sheet */}
      <BottomSheet
        open={isMobile === true && isOpen && query.length >= 1}
        onClose={() => setIsOpen(false)}
        title="Search Results"
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
              className="w-full bg-zinc-50 py-3 pl-10 pr-10 font-sans text-base font-medium text-zinc-950 placeholder:text-zinc-400 focus:outline-none"
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

        {/* Results */}
        {renderSearchResults(true)}
      </BottomSheet>
    </div>
  )
}
