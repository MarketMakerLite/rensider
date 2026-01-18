'use client'

import clsx from 'clsx'
import type React from 'react'
import { createContext, useContext, useState } from 'react'
import { Link } from './link'

const TableContext = createContext<{ bleed: boolean; dense: boolean; grid: boolean; striped: boolean }>({
  bleed: false,
  dense: false,
  grid: false,
  striped: false,
})

export function Table({
  bleed = false,
  dense = false,
  grid = false,
  striped = false,
  fixed = false,
  className,
  children,
  ...props
}: { bleed?: boolean; dense?: boolean; grid?: boolean; striped?: boolean; fixed?: boolean } & React.ComponentPropsWithoutRef<'div'>) {
  return (
    <TableContext.Provider value={{ bleed, dense, grid, striped } as React.ContextType<typeof TableContext>}>
      <div className="flow-root">
        <div
          {...props}
          className={clsx(
            className,
            '-mx-(--gutter)',
            !fixed && 'overflow-x-auto whitespace-nowrap touch-pan-x'
          )}
        >
          <div className={clsx('align-middle', !fixed && 'inline-block min-w-full', !bleed && 'sm:px-(--gutter)')}>
            <table className={clsx(
              'w-full text-left text-sm/6 text-zinc-950',
              fixed && 'table-fixed'
            )}>{children}</table>
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

export function TableHeader({ className, scope = 'col', ...props }: React.ComponentPropsWithoutRef<'th'>) {
  const { bleed, grid } = useContext(TableContext)

  return (
    <th
      scope={scope}
      {...props}
      className={clsx(
        className,
        'border-b border-b-zinc-300 px-3 py-1.5 font-medium first:pl-(--gutter,--spacing(2)) last:pr-(--gutter,--spacing(2))',
        grid && 'border-l border-l-zinc-300 first:border-l-0',
        !bleed && 'sm:first:pl-1 sm:last:pr-1'
      )}
    />
  )
}

export function TableCell({ className, children, ...props }: React.ComponentPropsWithoutRef<'td'>) {
  const { bleed, dense, grid, striped } = useContext(TableContext)
  const { href, target, title } = useContext(TableRowContext)
  const [cellRef, setCellRef] = useState<HTMLElement | null>(null)

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
        !bleed && 'sm:first:pl-1 sm:last:pr-1'
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
