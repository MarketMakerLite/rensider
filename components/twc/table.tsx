'use client'

import clsx from 'clsx'
import type React from 'react'
import { createContext, useContext, useState, useRef, useEffect } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Link } from './link'

// Extended table context with new features
const TableContext = createContext<{
  bleed: boolean
  dense: boolean
  grid: boolean
  striped: boolean
  stickyFirstColumn: boolean
}>({
  bleed: false,
  dense: false,
  grid: false,
  striped: false,
  stickyFirstColumn: false,
})

export function Table({
  bleed = false,
  dense = false,
  grid = false,
  striped = false,
  fixed = false,
  stickyFirstColumn = false,
  showScrollIndicators = false,
  caption,
  className,
  children,
  ...props
}: {
  bleed?: boolean
  dense?: boolean
  grid?: boolean
  striped?: boolean
  fixed?: boolean
  stickyFirstColumn?: boolean
  showScrollIndicators?: boolean
  caption?: string
} & React.ComponentPropsWithoutRef<'div'>) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  // Update scroll indicators on scroll and resize
  useEffect(() => {
    if (!showScrollIndicators) return

    const container = scrollContainerRef.current
    if (!container) return

    const updateScrollIndicators = () => {
      const { scrollLeft, scrollWidth, clientWidth } = container
      setCanScrollLeft(scrollLeft > 0)
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 1)
    }

    updateScrollIndicators()
    container.addEventListener('scroll', updateScrollIndicators)
    window.addEventListener('resize', updateScrollIndicators)

    return () => {
      container.removeEventListener('scroll', updateScrollIndicators)
      window.removeEventListener('resize', updateScrollIndicators)
    }
  }, [showScrollIndicators])

  return (
    <TableContext.Provider
      value={{ bleed, dense, grid, striped, stickyFirstColumn } as React.ContextType<typeof TableContext>}
    >
      <div className="flow-root">
        <div className="relative">
          {/* Left scroll indicator */}
          {showScrollIndicators && canScrollLeft && (
            <div
              className="pointer-events-none absolute bottom-0 left-0 top-0 z-30 w-8 bg-gradient-to-r from-white to-transparent"
              aria-hidden="true"
            />
          )}

          {/* Right scroll indicator */}
          {showScrollIndicators && canScrollRight && (
            <div
              className="pointer-events-none absolute bottom-0 right-0 top-0 z-30 w-8 bg-gradient-to-l from-white to-transparent"
              aria-hidden="true"
            />
          )}

          <div
            ref={scrollContainerRef}
            {...props}
            className={clsx(
              className,
              '-mx-(--gutter)',
              !fixed && 'overflow-x-auto whitespace-nowrap touch-pan-x'
            )}
          >
            <div
              className={clsx('align-middle', !fixed && 'inline-block min-w-full', !bleed && 'sm:px-(--gutter)')}
            >
              <table
                className={clsx('w-full text-left text-sm/6 text-zinc-950', fixed && 'table-fixed')}
              >
                {caption && <caption className="sr-only">{caption}</caption>}
                {children}
              </table>
            </div>
          </div>
        </div>
      </div>
    </TableContext.Provider>
  )
}

export function TableHead({ className, ...props }: React.ComponentPropsWithoutRef<'thead'>) {
  return <thead {...props} className={clsx(className, 'text-zinc-600 sticky top-0 bg-zinc-100 z-10')} />
}

export function TableBody(props: React.ComponentPropsWithoutRef<'tbody'>) {
  return <tbody {...props} />
}

const TableRowContext = createContext<{ href?: string; target?: string; title?: string }>({
  href: undefined,
  target: undefined,
  title: undefined,
})

export function TableRow({
  href,
  target,
  title,
  className,
  ...props
}: { href?: string; target?: string; title?: string } & React.ComponentPropsWithoutRef<'tr'>) {
  const { striped } = useContext(TableContext)

  return (
    <TableRowContext.Provider value={{ href, target, title } as React.ContextType<typeof TableRowContext>}>
      <tr
        {...props}
        className={clsx(
          className,
          'transition-colors duration-150',
          href &&
            'has-[[data-row-link][data-focus]]:outline-2 has-[[data-row-link][data-focus]]:-outline-offset-2 has-[[data-row-link][data-focus]]:outline-blue-500',
          striped && 'even:bg-zinc-950/2.5',
          href && striped && 'hover:bg-zinc-950/5',
          href && !striped && 'hover:bg-zinc-950/2.5',
          !href && 'hover:bg-zinc-950/[0.02]'
        )}
      />
    </TableRowContext.Provider>
  )
}

export function TableHeader({
  className,
  scope = 'col',
  sticky = false,
  ...props
}: React.ComponentPropsWithoutRef<'th'> & { sticky?: boolean }) {
  const { bleed, grid, stickyFirstColumn } = useContext(TableContext)

  // Use sticky if explicitly set or if stickyFirstColumn is enabled (for first column)
  const isSticky = sticky || stickyFirstColumn

  return (
    <th
      scope={scope}
      {...props}
      className={clsx(
        className,
        'border-b border-b-zinc-300 px-3 py-1.5 font-medium first:pl-(--gutter,--spacing(2)) last:pr-(--gutter,--spacing(2))',
        grid && 'border-l border-l-zinc-300 first:border-l-0',
        !bleed && 'sm:first:pl-1 sm:last:pr-1',
        // Sticky first column support
        isSticky && 'first:sticky first:left-0 first:z-20 first:bg-zinc-100 first:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
      )}
    />
  )
}

export function TableCell({
  className,
  children,
  sticky = false,
  ...props
}: React.ComponentPropsWithoutRef<'td'> & { sticky?: boolean }) {
  const { bleed, dense, grid, striped, stickyFirstColumn } = useContext(TableContext)
  const { href, target, title } = useContext(TableRowContext)
  const [cellRef, setCellRef] = useState<HTMLElement | null>(null)

  // Use sticky if explicitly set or if stickyFirstColumn is enabled (for first column)
  const isSticky = sticky || stickyFirstColumn

  return (
    <td
      ref={href ? setCellRef : undefined}
      {...props}
      className={clsx(
        className,
        'relative px-3 first:pl-(--gutter,--spacing(2)) last:pr-(--gutter,--spacing(2))',
        'overflow-hidden text-ellipsis',
        !striped && 'border-b border-zinc-950/5',
        grid && 'border-l border-l-zinc-950/5 first:border-l-0',
        dense ? 'py-2.5 sm:py-2' : 'py-3.5 sm:py-3',
        !bleed && 'sm:first:pl-1 sm:last:pr-1',
        // Sticky first column support
        isSticky && 'first:sticky first:left-0 first:z-10 first:bg-white first:shadow-[2px_0_4px_-2px_rgba(0,0,0,0.1)]'
      )}
    >
      {href && (
        <Link
          data-row-link
          href={href}
          target={target}
          aria-label={title}
          tabIndex={cellRef?.previousElementSibling === null ? 0 : -1}
          className="absolute inset-0 focus:outline-hidden"
        />
      )}
      {children}
    </td>
  )
}

/**
 * Expandable table row component for progressive disclosure
 * Wraps TableRow with expand/collapse functionality
 */
interface TableRowExpandableProps {
  children: React.ReactNode
  expandedContent: React.ReactNode
  isExpanded?: boolean
  onToggle?: () => void
  className?: string
}

export function TableRowExpandable({
  children,
  expandedContent,
  isExpanded = false,
  onToggle,
  className,
}: TableRowExpandableProps) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const expanded = onToggle ? isExpanded : internalExpanded
  const toggle = onToggle ?? (() => setInternalExpanded((prev) => !prev))

  return (
    <>
      <TableRow className={clsx(className, 'cursor-pointer')} onClick={toggle}>
        {children}
        <TableCell className="w-10">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              toggle()
            }}
            className="flex h-11 w-11 items-center justify-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse row' : 'Expand row'}
          >
            <motion.svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </motion.svg>
          </button>
        </TableCell>
      </TableRow>
      <AnimatePresence>
        {expanded && (
          <tr>
            <td colSpan={100}>
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="border-b border-zinc-100 bg-zinc-50/50 px-4 py-3">{expandedContent}</div>
              </motion.div>
            </td>
          </tr>
        )}
      </AnimatePresence>
    </>
  )
}
