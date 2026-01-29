'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ChevronLeftIcon } from '@heroicons/react/20/solid'

const STORAGE_KEY = 'nav-history'
const MAX_HISTORY_LENGTH = 20

function getStoredHistory(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function setStoredHistory(history: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  } catch {
    // Storage full or unavailable
  }
}

export function BackButton() {
  const pathname = usePathname()
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  // Initialize on mount
  useEffect(() => {
    setMounted(true) // eslint-disable-line react-hooks/set-state-in-effect -- hydration guard
    setHistory(getStoredHistory())
  }, [])

  // Track navigation - add current page to history when leaving
  useEffect(() => {
    if (!mounted) return

    // When on index, clear history
    if (pathname === '/') {
      setHistory([]) // eslint-disable-line react-hooks/set-state-in-effect -- clear on navigation
      setStoredHistory([])
      return
    }

    // Add to history if not already the last entry
    setHistory(prev => {
      if (prev[prev.length - 1] === pathname) {
        return prev
      }
      const newHistory = [...prev, pathname].slice(-MAX_HISTORY_LENGTH)
      setStoredHistory(newHistory)
      return newHistory
    })
  }, [pathname, mounted])

  const handleBack = useCallback(() => {
    if (pathname === '/') return

    // Remove current page from history
    const newHistory = history.filter(p => p !== pathname)

    // Go to previous page in history, or index if none
    const previousPage = newHistory.length > 0 ? newHistory[newHistory.length - 1] : '/'

    // Update history (remove current and the page we're going to if it's the last one)
    const updatedHistory = previousPage === '/' ? [] : newHistory.slice(0, -1)
    setHistory(updatedHistory)
    setStoredHistory(updatedHistory)

    router.push(previousPage)
  }, [pathname, history, router])

  // Show back button on any page except index
  const showButton = pathname !== '/'

  const buttonClass = "flex items-center justify-center h-9 px-3 gap-1 border border-zinc-200 bg-white text-zinc-600 transition-all hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <button className={`${buttonClass} opacity-0`} disabled aria-label="Back button loading">
        <ChevronLeftIcon className="h-4 w-4" />
        <span className="text-sm">Back</span>
      </button>
    )
  }

  if (!showButton) {
    return null
  }

  return (
    <button
      onClick={handleBack}
      className={buttonClass}
      title="Go back"
      aria-label="Go back to previous page"
    >
      <ChevronLeftIcon className="h-4 w-4" />
      <span className="text-sm">Back</span>
    </button>
  )
}
