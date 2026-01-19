'use client'

import { memo } from 'react'
import Link from 'next/link'
import { Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableHeader,
  TableCell,
} from '@/components/twc/table'
import { formatDate, formatCurrency, formatNumber, decodeHtmlEntities } from '@/lib/format'
import type { RecentFiler } from '@/types/ownership'

interface RecentFilersProps {
  filers: RecentFiler[]
}

function getChangeColor(
  changeType: RecentFiler['changeType']
): 'green' | 'blue' | 'yellow' | 'red' | 'zinc' {
  switch (changeType) {
    case 'NEW':
      return 'green'
    case 'ADDED':
      return 'blue'
    case 'REDUCED':
      return 'yellow'
    case 'CLOSED':
      return 'red'
    default:
      return 'zinc'
  }
}

export const RecentFilers = memo(function RecentFilers({ filers }: RecentFilersProps) {
  if (filers.length === 0) {
    return null
  }

  return (
    <div className="mt-8">
      <Subheading level={2}>Recent Filers</Subheading>
      <Text className="mt-1 text-sm text-zinc-500">
        Institutions with the most recent 13F filings for this stock
      </Text>

      <Table className="mt-4" striped>
        <TableHead>
          <TableRow>
            <TableHeader>Institution</TableHeader>
            <TableHeader>Filing Date</TableHeader>
            <TableHeader className="text-right">Shares</TableHeader>
            <TableHeader className="text-right">Value</TableHeader>
            <TableHeader>Position</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {filers.map((filer) => (
            <TableRow key={`${filer.cik}-${filer.filingDate}`}>
              <TableCell>
                <Link
                  href={`/fund/${filer.cik}`}
                  prefetch={false}
                  className="text-blue-600 hover:underline"
                >
                  {decodeHtmlEntities(filer.institutionName)}
                </Link>
              </TableCell>
              <TableCell className="text-zinc-500">
                {formatDate(filer.filingDate)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatNumber(filer.shares)}
              </TableCell>
              <TableCell className="text-right font-mono">
                {formatCurrency(filer.value * 1000)}
              </TableCell>
              <TableCell>
                {filer.changeType && (
                  <Badge color={getChangeColor(filer.changeType)}>
                    {filer.changeType}
                  </Badge>
                )}
                {filer.changePercent !== null && (
                  <span
                    className={`ml-2 text-sm ${filer.changePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {filer.changePercent >= 0 ? '+' : ''}
                    {filer.changePercent.toFixed(1)}%
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
})
