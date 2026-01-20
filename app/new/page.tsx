import type { Metadata } from 'next'
import Link from 'next/link'
import { getNewFilings } from '@/actions/filings'
import { getRecentInsiderTransactions } from '@/actions/insider-sales'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading, Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { FilingsTable } from '@/components/ownership/FilingsTable'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/twc/table'
import { formatDate, formatLargeNumber, formatCurrency, decodeHtmlEntities } from '@/lib/format'
import type { InsiderTransaction, TransactionCode } from '@/types/insider-sales'

// Force dynamic rendering to ensure DuckDB tables are loaded
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Latest SEC Filings | Rensider',
  description: 'Fresh institutional holdings and insider trades from SEC filings, updated daily. Track 13F institutional disclosures and Form 4 insider transactions.',
  alternates: {
    canonical: 'https://renbot.app/new',
  },
  openGraph: {
    title: 'Latest SEC Filings | Rensider',
    description: 'Fresh institutional holdings and insider trades, updated daily',
    images: ['/api/og/home'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Latest SEC Filings | Rensider',
    description: 'Fresh institutional holdings and insider trades, updated daily',
    images: ['/api/og/home'],
  },
}

export default async function NewFilingsPage() {
  const [filings, insiderData] = await Promise.all([
    getNewFilings({ days: 365, limit: 100 }),
    getRecentInsiderTransactions({ limit: 20 }),
  ])

  return (
    <ApplicationLayout>
      <div className="max-w-7xl">
        {/* Header */}
        <div>
          <Heading>Latest SEC Filings</Heading>
          <Text className="mt-1 text-zinc-600">
            Fresh institutional holdings and insider trades, updated daily
          </Text>
        </div>

        {/* 13F Filings Section */}
        <div className="mt-8">
          <div className="flex items-center gap-3">
            <Subheading level={2}>13F Institutional Holdings</Subheading>
            <Badge color="blue">Form 13F</Badge>
          </div>
          <FilingsTable filings={filings || []} />
        </div>

        {/* Insider Transactions Section */}
        {insiderData.transactions.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Subheading level={2}>Recent Insider Transactions</Subheading>
                <Badge color="amber">Form 4</Badge>
              </div>
              <Link href="/insiders" className="text-sm text-blue-600 hover:underline">
                View all &rarr;
              </Link>
            </div>
            <Table className="mt-4" striped>
              <TableHead>
                <TableRow>
                  <TableHeader>Date</TableHeader>
                  <TableHeader>Insider</TableHeader>
                  <TableHeader>Company</TableHeader>
                  <TableHeader>Type</TableHeader>
                  <TableHeader className="text-right">Shares</TableHeader>
                  <TableHeader className="text-right">Value</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {insiderData.transactions.slice(0, 10).map((transaction, index) => (
                  <InsiderTransactionRow key={`${transaction.accessionNumber}-${index}`} transaction={transaction} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Info */}
        <div className="mt-8 border-t border-zinc-200 pt-4">
          <Text className="text-sm text-zinc-500">
            13F filings report quarter-end holdings (45-day delay). Insider trades appear within 2 business days.
          </Text>
        </div>
      </div>
    </ApplicationLayout>
  )
}

function InsiderTransactionRow({ transaction }: { transaction: InsiderTransaction }) {
  const isSale = transaction.acquiredDisposed === 'D'

  const labels: Record<TransactionCode, string> = {
    'P': 'Buy',
    'S': 'Sale',
    'A': 'Award',
    'D': 'Sale',
    'F': 'Tax',
    'I': 'Disc',
    'M': 'Exercise',
    'C': 'Conv',
    'E': 'Exp',
    'H': 'Exp',
    'O': 'Exercise',
    'X': 'Exercise',
    'G': 'Gift',
    'L': 'Acq',
    'W': 'Inherit',
    'Z': 'Trust',
    'J': 'Other',
    'K': 'Swap',
    'U': 'Tender',
    'V': 'Vol',
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap max-w-xs truncate text-zinc-500">
        {formatDate(transaction.transactionDate || transaction.filingDate)}
      </TableCell>
      <TableCell className="max-w-xs truncate">
        <Link
          href={`/insider/${transaction.insiderCik}`}
          prefetch={false}
          className="font-medium text-zinc-900 hover:text-blue-600"
        >
          {decodeHtmlEntities(transaction.insiderName)}
        </Link>
      </TableCell>
      <TableCell className="max-w-xs">
        {transaction.ticker ? (
          <Link
            href={`/stock/${transaction.ticker}#insiders`}
            prefetch={false}
            className="font-medium text-blue-600 hover:underline"
          >
            {transaction.ticker}
          </Link>
        ) : (
          <span className="text-zinc-400">-</span>
        )}
        {transaction.issuerName && (
          <div className="truncate text-xs text-zinc-500">
            {decodeHtmlEntities(transaction.issuerName)}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Badge color={isSale ? 'red' : 'green'}>
          {labels[transaction.transactionCode] || transaction.transactionCode}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono">
        <span className={isSale ? 'text-red-600' : 'text-green-600'}>
          {isSale ? '-' : '+'}
          {formatLargeNumber(transaction.shares)}
        </span>
      </TableCell>
      <TableCell className="text-right font-mono">
        {transaction.totalValue ? (
          <span className={isSale ? 'text-red-600' : 'text-green-600'}>
            {formatCurrency(transaction.totalValue)}
          </span>
        ) : (
          <span className="text-zinc-400">-</span>
        )}
      </TableCell>
    </TableRow>
  )
}
