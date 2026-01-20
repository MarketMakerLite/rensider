'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { FilterInput } from '@/components/twc/filter-input'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/twc/table'
import { SortableHeader } from '@/components/twc/sortable-header'
import { TablePagination } from '@/components/twc/pagination'
import { useTableSort, useTableFilter, usePagination } from '@/lib/useTableSort'
import { formatDate, formatLargeNumber, formatCurrency, getSecFilingUrl, decodeHtmlEntities } from '@/lib/format'
import type { InsiderTransaction, TransactionCode } from '@/types/insider-sales'

type TransactionSortKey = 'transactionDate' | 'insiderName' | 'ticker' | 'shares' | 'totalValue'

interface InsiderTransactionsTableProps {
  transactions: InsiderTransaction[]
  title?: string
  showCompany?: boolean
  showPrice?: boolean
}

export function InsiderTransactionsTable({
  transactions,
  title = 'Recent Transactions',
  showCompany = true,
  showPrice = false,
}: InsiderTransactionsTableProps) {
  const { filteredData, filterValue, setFilterValue } = useTableFilter(
    transactions,
    ['insiderName', 'ticker', 'issuerName']
  )

  const { sortedData, sortState, toggleSort } = useTableSort<InsiderTransaction, TransactionSortKey>(
    filteredData,
    'transactionDate',
    'desc',
    { column: 'totalValue', direction: 'desc' }
  )

  const { paginatedData, pagination, goToPage, changePageSize } = usePagination(sortedData, 25)

  if (transactions.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50/50 p-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-400">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <Text className="text-zinc-500">No insider transactions found</Text>
      </div>
    )
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Subheading level={2}>{title}</Subheading>
        <FilterInput
          type="text"
          placeholder="Filter transactions..."
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
          className="w-56"
          aria-label="Filter transactions"
        />
      </div>

      {/* Mobile Card View with Expandable Details */}
      <MobileTransactionCards
        transactions={paginatedData}
        showCompany={showCompany}
      />

      {/* Desktop Table View */}
      <Table className="mt-4 hidden md:block" striped>
        <TableHead>
          <TableRow>
            <TableHeader>
              <SortableHeader
                column="insiderName"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as TransactionSortKey)}
              >
                Insider
              </SortableHeader>
            </TableHeader>
            <TableHeader>
              <SortableHeader
                column="transactionDate"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as TransactionSortKey)}
              >
                Date
              </SortableHeader>
            </TableHeader>
            {showCompany && (
              <TableHeader>
                <SortableHeader
                  column="ticker"
                  currentColumn={sortState.column}
                  direction={sortState.direction}
                  onSort={(col) => toggleSort(col as TransactionSortKey)}
                >
                  Company
                </SortableHeader>
              </TableHeader>
            )}
            <TableHeader>Type</TableHeader>
            <TableHeader className="text-right">
              <SortableHeader
                column="shares"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as TransactionSortKey)}
                className="justify-end"
              >
                Shares
              </SortableHeader>
            </TableHeader>
            {showPrice && <TableHeader className="text-right">Price</TableHeader>}
            <TableHeader className="text-right">
              <SortableHeader
                column="totalValue"
                currentColumn={sortState.column}
                direction={sortState.direction}
                onSort={(col) => toggleSort(col as TransactionSortKey)}
                className="justify-end"
              >
                Value
              </SortableHeader>
            </TableHeader>
            <TableHeader>Filing</TableHeader>
          </TableRow>
        </TableHead>
        <TableBody>
          {paginatedData.map((transaction, index) => {
            const isSale = transaction.acquiredDisposed === 'D'
            return (
              <TableRow key={`${transaction.accessionNumber}-${index}`}>
                <TableCell className="max-w-xs">
                  <Link
                    href={`/insider/${transaction.insiderCik}`}
                    prefetch={false}
                    className="font-medium text-zinc-900 hover:text-blue-600 hover:underline"
                  >
                    {decodeHtmlEntities(transaction.insiderName)}
                  </Link>
                  {transaction.insiderTitle && (
                    <div className="text-xs text-zinc-500">{transaction.insiderTitle}</div>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap text-zinc-500">
                  {formatDate(transaction.transactionDate || transaction.filingDate)}
                </TableCell>
                {showCompany && (
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
                )}
                <TableCell>
                  <TransactionBadge code={transaction.transactionCode} isAcquired={!isSale} />
                </TableCell>
                <TableCell className="text-right font-mono">
                  <span className={isSale ? 'text-red-600' : 'text-green-600'}>
                    {isSale ? '-' : '+'}
                    {formatLargeNumber(transaction.shares)}
                  </span>
                </TableCell>
                {showPrice && (
                  <TableCell className="text-right font-mono">
                    {transaction.pricePerShare ? (
                      `$${transaction.pricePerShare.toFixed(2)}`
                    ) : (
                      <span className="text-zinc-400">-</span>
                    )}
                  </TableCell>
                )}
                <TableCell className="text-right font-mono">
                  {transaction.totalValue ? (
                    <span className={isSale ? 'text-red-600' : 'text-green-600'}>
                      {formatCurrency(transaction.totalValue)}
                    </span>
                  ) : (
                    <span className="text-zinc-400">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <a
                    href={getSecFilingUrl(transaction.accessionNumber)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    View
                  </a>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>

      <div className="mt-4">
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          totalItems={pagination.totalItems}
          totalPages={pagination.totalPages}
          onPageChange={goToPage}
          onPageSizeChange={changePageSize}
        />
      </div>
    </div>
  )
}

function TransactionBadge({ code, isAcquired }: { code: TransactionCode; isAcquired: boolean }) {
  const labels: Record<TransactionCode, string> = {
    'P': 'Buy',
    'S': 'Sale',
    'A': 'Award',
    'D': 'Sale to Issuer',
    'F': 'Tax Payment',
    'I': 'Discretionary',
    'M': 'Exercise',
    'C': 'Conversion',
    'E': 'Expiration',
    'H': 'Expiration',
    'O': 'Exercise',
    'X': 'Exercise',
    'G': 'Gift',
    'L': 'Small Acq',
    'W': 'Inheritance',
    'Z': 'Trust',
    'J': 'Other',
    'K': 'Swap',
    'U': 'Tender',
    'V': 'Voluntary',
  }

  const color = isAcquired ? 'green' : 'red'

  return (
    <Badge color={color}>
      {labels[code] || code}
    </Badge>
  )
}

/**
 * Transaction type icons for mobile cards
 */
function TransactionIcon({ code }: { code: TransactionCode }) {
  const icons: Partial<Record<TransactionCode, React.ReactNode>> = {
    'P': ( // Buy - arrow up
      <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
      </svg>
    ),
    'S': ( // Sale - arrow down
      <svg className="h-4 w-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
      </svg>
    ),
    'M': ( // Exercise - circular arrows
      <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    'X': ( // Exercise - circular arrows
      <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    'O': ( // Exercise - circular arrows
      <svg className="h-4 w-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    'G': ( // Gift - gift box
      <svg className="h-4 w-4 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
      </svg>
    ),
    'A': ( // Award - star
      <svg className="h-4 w-4 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
      </svg>
    ),
  }

  return icons[code] || null
}

/**
 * Mobile transaction cards with expandable details
 */
function MobileTransactionCards({
  transactions,
  showCompany,
}: {
  transactions: InsiderTransaction[]
  showCompany: boolean
}) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)

  return (
    <div className="mt-4 space-y-3 md:hidden">
      {transactions.map((transaction, index) => {
        const isSale = transaction.acquiredDisposed === 'D'
        const isExpanded = expandedIndex === index

        return (
          <div
            key={`mobile-${transaction.accessionNumber}-${index}`}
            className="rounded-lg border border-zinc-200 bg-white shadow-sm overflow-hidden active:scale-[0.98] transition-transform"
          >
            {/* Always visible section */}
            <button
              type="button"
              onClick={() => setExpandedIndex(isExpanded ? null : index)}
              className="w-full p-4 text-left"
              aria-expanded={isExpanded}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <TransactionIcon code={transaction.transactionCode} />
                    <Link
                      href={`/insider/${transaction.insiderCik}`}
                      prefetch={false}
                      onClick={(e) => e.stopPropagation()}
                      className="font-medium text-zinc-900 hover:text-blue-600"
                    >
                      {decodeHtmlEntities(transaction.insiderName)}
                    </Link>
                  </div>
                  {showCompany && transaction.ticker && (
                    <div className="mt-1">
                      <Link
                        href={`/stock/${transaction.ticker}#insiders`}
                        prefetch={false}
                        onClick={(e) => e.stopPropagation()}
                        className="text-sm font-medium text-blue-600 hover:underline"
                      >
                        {transaction.ticker}
                      </Link>
                    </div>
                  )}
                </div>
                <TransactionBadge code={transaction.transactionCode} isAcquired={!isSale} />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-zinc-500">
                  {formatDate(transaction.transactionDate || transaction.filingDate)}
                </div>
                <div className={`font-mono text-sm font-medium ${isSale ? 'text-red-600' : 'text-green-600'}`}>
                  {isSale ? '-' : '+'}
                  {formatLargeNumber(transaction.shares)} shares
                </div>
              </div>

              {/* Expand indicator */}
              <div className="mt-2 flex items-center justify-center">
                <motion.svg
                  className="h-4 w-4 text-zinc-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  animate={{ rotate: isExpanded ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </motion.svg>
              </div>
            </button>

            {/* Expandable details */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className="border-t border-zinc-100 bg-zinc-50/50 px-4 py-3 space-y-2">
                    {/* Title */}
                    {transaction.insiderTitle && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Title</span>
                        <span className="text-sm text-zinc-700">{transaction.insiderTitle}</span>
                      </div>
                    )}

                    {/* Issuer */}
                    {transaction.issuerName && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Issuer</span>
                        <span className="text-sm text-zinc-700 truncate max-w-[60%] text-right">
                          {decodeHtmlEntities(transaction.issuerName)}
                        </span>
                      </div>
                    )}

                    {/* Value */}
                    {transaction.totalValue && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Value</span>
                        <span className={`font-mono text-sm font-medium ${isSale ? 'text-red-600' : 'text-green-600'}`}>
                          {formatCurrency(transaction.totalValue)}
                        </span>
                      </div>
                    )}

                    {/* Price */}
                    {transaction.pricePerShare && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-zinc-500">Price/Share</span>
                        <span className="font-mono text-sm">${transaction.pricePerShare.toFixed(2)}</span>
                      </div>
                    )}

                    {/* Filing link */}
                    <a
                      href={getSecFilingUrl(transaction.accessionNumber)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 mt-2 py-2 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      View SEC Filing
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
