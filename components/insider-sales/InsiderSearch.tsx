'use client'

import { useRouter } from 'next/navigation'
import { SearchForm } from '@/components/ui/SearchForm'

export function InsiderSearch() {
  const router = useRouter()

  const handleSubmit = (query: string) => {
    const upper = query.toUpperCase()
    // If it looks like a ticker (1-5 letters), go to ticker page
    if (/^[A-Z]{1,5}$/.test(upper)) {
      router.push(`/insiders/${upper}`)
    } else {
      // Otherwise, treat as insider name search
      router.push(`/insiders?search=${encodeURIComponent(query)}`)
    }
  }

  return (
    <SearchForm
      placeholder="Search by ticker (e.g., AAPL) or insider name..."
      onSubmit={handleSubmit}
    />
  )
}
