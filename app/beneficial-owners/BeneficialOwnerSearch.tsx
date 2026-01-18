'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { SearchForm } from '@/components/ui/SearchForm'
import { getBeneficialOwnership } from '@/actions/beneficial-ownership'
import { formatDate, formatLargeNumber, getSecFilingUrl, decodeHtmlEntities } from '@/lib/format'
import type { TickerBeneficialOwnership } from '@/types/beneficial-ownership'

export function BeneficialOwnerSearch() {
  const [isLoading, setIsLoading] = useState(false)
  const [result, setResult] = useState<TickerBeneficialOwnership | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = useCallback(async (query: string) => {
    setIsLoading(true)
    setError(null)
    setResult(null)

    try {
      const data = await getBeneficialOwnership({ ticker: query.toUpperCase() })
      if (data) {
        setResult(data)
      } else {
        setError('No beneficial ownership filings found for this ticker')
      }
    } catch (err) {
      setError('Failed to fetch beneficial ownership data')
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  return (
    <div>
      <SearchForm
        placeholder="Enter ticker symbol (e.g., AAPL)"
        onSubmit={handleSearch}
        isLoading={isLoading}
        transformValue={(v) => v.toUpperCase()}
      />

      {error && (
        <div className="mt-4 border-2 border-red-600 bg-red-50 p-3">
          <Text className="text-sm text-red-700">{error}</Text>
        </div>
      )}

      {result && (
        <div className="mt-4 border-2 border-[#4A4444] bg-white p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/stock/${result.ticker}`}
                className="text-lg font-semibold text-green-800 hover:underline"
              >
                {result.ticker}
              </Link>
              {result.issuerName && (
                <Text className="text-zinc-500">{decodeHtmlEntities(result.issuerName)}</Text>
              )}
            </div>
            <Link
              href={`/stock/${result.ticker}`}
              className="text-sm text-green-800 hover:underline"
            >
              View full ownership →
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
            <div>
              <Text className="text-xs text-zinc-500">Major Holders</Text>
              <Text className="text-xl font-semibold">{result.stats.totalMajorHolders}</Text>
            </div>
            <div>
              <Text className="text-xs text-zinc-500">Activist Filers</Text>
              <Text className="text-xl font-semibold">{result.stats.activistCount}</Text>
            </div>
            <div>
              <Text className="text-xs text-zinc-500">Combined Ownership</Text>
              <Text className="text-xl font-semibold">
                {result.stats.totalBeneficialOwnership.toFixed(1)}%
              </Text>
            </div>
            <div>
              <Text className="text-xs text-zinc-500">Latest Filing</Text>
              <Text className="text-xl font-semibold">
                {result.stats.latestFilingDate
                  ? formatDate(result.stats.latestFilingDate)
                  : '-'}
              </Text>
            </div>
          </div>

          {/* Holders List */}
          {result.majorHolders.length > 0 && (
            <div className="mt-4 space-y-2">
              <Text className="text-sm font-medium text-zinc-700">5%+ Holders</Text>
              {result.majorHolders.slice(0, 5).map((holder, idx) => (
                <div
                  key={`${holder.ownerName}-${idx}`}
                  className="flex items-center justify-between border-b border-zinc-100 py-2 last:border-0"
                >
                  <div className="flex items-center gap-2">
                    <Text className="font-medium">{decodeHtmlEntities(holder.ownerName)}</Text>
                    <Badge
                      color={holder.latestFilingType === '13D' ? 'red' : 'blue'}
                    >
                      {holder.latestFilingType}
                    </Badge>
                    {holder.intentCategory && holder.intentCategory !== 'passive' && (
                      <Badge color="orange">{holder.intentCategory}</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <Text className="font-mono font-medium">
                        {holder.percentOfClass.toFixed(1)}%
                      </Text>
                      <Text className="text-xs text-zinc-500">
                        {formatLargeNumber(holder.shares)} shares
                      </Text>
                    </div>
                    <a
                      href={getSecFilingUrl(holder.latestAccession)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-green-800 hover:underline"
                    >
                      Filing
                    </a>
                  </div>
                </div>
              ))}
              {result.majorHolders.length > 5 && (
                <Text className="text-sm text-zinc-500">
                  +{result.majorHolders.length - 5} more holders
                </Text>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
