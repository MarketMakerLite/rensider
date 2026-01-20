'use client'

import clsx from 'clsx'
import type React from 'react'
import { useMemo } from 'react'
import { Button } from './button'

export function Pagination({
  'aria-label': ariaLabel = 'Page navigation',
  className,
  ...props
}: React.ComponentPropsWithoutRef<'nav'>) {
  return <nav aria-label={ariaLabel} {...props} className={clsx(className, 'flex gap-x-2')} />
}

export function PaginationPrevious({
  href = null,
  className,
  children = 'Previous',
}: React.PropsWithChildren<{ href?: string | null; className?: string }>) {
  return (
    <span className={clsx(className, 'grow basis-0')}>
      <Button {...(href === null ? { disabled: true } : { href })} plain aria-label="Previous page">
        <svg className="stroke-current" data-slot="icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2.75 8H13.25M2.75 8L5.25 5.5M2.75 8L5.25 10.5"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {children}
      </Button>
    </span>
  )
}

export function PaginationNext({
  href = null,
  className,
  children = 'Next',
}: React.PropsWithChildren<{ href?: string | null; className?: string }>) {
  return (
    <span className={clsx(className, 'flex grow basis-0 justify-end')}>
      <Button {...(href === null ? { disabled: true } : { href })} plain aria-label="Next page">
        {children}
        <svg className="stroke-current" data-slot="icon" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M13.25 8L2.75 8M13.25 8L10.75 10.5M13.25 8L10.75 5.5"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </Button>
    </span>
  )
}

export function PaginationList({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) {
  return <span {...props} className={clsx(className, 'hidden items-baseline gap-x-2 sm:flex')} />
}

export function PaginationPage({
  href,
  className,
  current = false,
  children,
}: React.PropsWithChildren<{ href: string; className?: string; current?: boolean }>) {
  return (
    <Button
      href={href}
      plain
      aria-label={`Page ${children}`}
      aria-current={current ? 'page' : undefined}
      className={clsx(
        className,
        'min-w-9 before:absolute before:-inset-px before:rounded-lg',
        current && 'before:bg-zinc-950/5'
      )}
    >
      <span className="-mx-0.5">{children}</span>
    </Button>
  )
}

export function PaginationGap({
  className,
  children = <>&hellip;</>,
  ...props
}: React.ComponentPropsWithoutRef<'span'>) {
  return (
    <span
      aria-hidden="true"
      {...props}
      className={clsx(className, 'w-9 text-center text-sm/6 font-semibold text-zinc-950 select-none')}
    >
      {children}
    </span>
  )
}

// Table-specific pagination for client-side data
interface TablePaginationProps {
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
  onPageSizeChange?: (pageSize: number) => void
  pageSizeOptions?: number[]
}

// Type for page numbers including ellipsis markers
type PageItem = number | 'ellipsis';

export function TablePagination({
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 25, 50, 100],
}: TablePaginationProps) {
  if (totalItems === 0) return null

  const startItem = (page - 1) * pageSize + 1
  const endItem = Math.min(page * pageSize, totalItems)

  // Generate page numbers to show - memoized to avoid recalculation on every render
  const pageNumbers = useMemo((): PageItem[] => {
    const pages: PageItem[] = []
    const maxVisible = 5

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)
      if (page > 3) pages.push('ellipsis')

      const start = Math.max(2, page - 1)
      const end = Math.min(totalPages - 1, page + 1)
      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (page < totalPages - 2) pages.push('ellipsis')
      pages.push(totalPages)
    }
    return pages
  }, [page, totalPages])

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4 text-sm text-zinc-500">
        <span>
          {startItem}-{endItem} of {totalItems}
        </span>
        {onPageSizeChange && (
          <div className="flex items-center gap-2">
            <span>Show</span>
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="border border-zinc-200 bg-transparent py-0.5 pl-1 pr-6 text-sm"
              aria-label="Items per page"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <>
          {/* Mobile pagination - larger touch targets, simplified */}
          <div className="flex items-center justify-between gap-2 sm:hidden">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="flex h-11 min-w-[5rem] items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Previous page"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Prev
            </button>

            <span className="text-sm text-zinc-600">
              {page} / {totalPages}
            </span>

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="flex h-11 min-w-[5rem] items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Next page"
            >
              Next
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Desktop pagination - full page numbers */}
          <div className="hidden items-center gap-1 sm:flex">
            <button
              onClick={() => onPageChange(page - 1)}
              disabled={page === 1}
              className="flex h-8 w-8 items-center justify-center border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Previous page"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>

            {pageNumbers.map((pageItem, idx) =>
              pageItem === 'ellipsis' ? (
                <span key={`ellipsis-${idx}`} className="flex h-8 w-8 items-center justify-center text-zinc-400" aria-hidden="true">
                  ...
                </span>
              ) : (
                <button
                  key={pageItem}
                  onClick={() => onPageChange(pageItem)}
                  className={clsx(
                    'flex h-8 w-8 items-center justify-center border text-sm font-medium transition-colors',
                    page === pageItem
                      ? 'border-[#4A4444] bg-green-800 text-white'
                      : 'border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                  )}
                  aria-label={`Page ${pageItem}`}
                  aria-current={page === pageItem ? 'page' : undefined}
                >
                  {pageItem}
                </button>
              )
            )}

            <button
              onClick={() => onPageChange(page + 1)}
              disabled={page === totalPages}
              className="flex h-8 w-8 items-center justify-center border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
              aria-label="Next page"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  )
}
