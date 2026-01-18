'use client'

import * as Headless from '@headlessui/react'
import clsx from 'clsx'
import React, { forwardRef } from 'react'

/**
 * FilterInput - Input with search/filter icon
 * Used for table filtering throughout the application
 */
export const FilterInput = forwardRef(function FilterInput(
  {
    className,
    ...props
  }: {
    className?: string
  } & Omit<Headless.InputProps, 'as' | 'className'>,
  ref: React.ForwardedRef<HTMLInputElement>
) {
  return (
    <span
      data-slot="control"
      className={clsx([
        className,
        'relative block w-full',
        'border-2 border-[#4A4444] bg-white shadow-[3px_3px_0px_0px_#4A4444]',
        'transition-all focus-within:translate-x-[1px] focus-within:translate-y-[1px] focus-within:shadow-[1px_1px_0px_0px_#4A4444]',
        'has-data-disabled:opacity-50 has-data-disabled:shadow-none',
      ])}
    >
      {/* Search Icon */}
      <svg
        className="pointer-events-none absolute left-2.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-zinc-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2.5}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <Headless.Input
        ref={ref}
        {...props}
        className={clsx([
          'relative block w-full appearance-none pl-8 pr-3 py-[calc(--spacing(2)-1px)] sm:py-[calc(--spacing(1.5)-1px)]',
          'text-base/6 font-medium text-zinc-950 placeholder:text-zinc-400 sm:text-sm/6',
          'border-0 bg-transparent',
          'focus:outline-hidden',
          'data-invalid:text-red-600',
          'data-disabled:text-zinc-400',
        ])}
      />
    </span>
  )
})
