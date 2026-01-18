'use client'

import { useState } from 'react'
import { Input } from '@/components/twc/input'

interface SearchFormProps {
  placeholder?: string
  buttonText?: string
  loadingText?: string
  isLoading?: boolean
  onSubmit: (query: string) => void
  transformValue?: (value: string) => string
  className?: string
}

export function SearchForm({
  placeholder = 'Search...',
  buttonText = 'Search',
  loadingText = 'Searching...',
  isLoading = false,
  onSubmit,
  transformValue,
  className = '',
}: SearchFormProps) {
  const [query, setQuery] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (trimmed) {
      onSubmit(trimmed)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = transformValue ? transformValue(e.target.value) : e.target.value
    setQuery(value)
  }

  return (
    <form onSubmit={handleSubmit} className={`flex gap-3 ${className}`}>
      <Input
        type="text"
        placeholder={placeholder}
        value={query}
        onChange={handleChange}
        disabled={isLoading}
        className="flex-1"
      />
      <button
        type="submit"
        disabled={isLoading || !query.trim()}
        className="border-2 border-[#4A4444] bg-green-800 px-4 py-2 text-sm font-bold uppercase tracking-wide text-white shadow-[4px_4px_0px_0px_#4A4444] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[4px] active:translate-y-[4px] disabled:bg-zinc-400"
      >
        {isLoading ? loadingText : buttonText}
      </button>
    </form>
  )
}
