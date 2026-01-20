'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import clsx from 'clsx'

interface MobileFilterSheetProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

/**
 * Bottom sheet component for mobile filter controls
 * Features drag-to-dismiss, keyboard escape handler, and larger touch targets
 */
export function MobileFilterSheet({ isOpen, onClose, title, children }: MobileFilterSheetProps) {
  const [mounted, setMounted] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const sheetRef = useRef<HTMLDivElement>(null)
  const dragStartY = useRef(0)
  const currentY = useRef(0)

  // SSR safety - only mount portal on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Handle body scroll lock and keyboard escape
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'

      // Keyboard escape handler
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          onClose()
        }
      }
      document.addEventListener('keydown', handleKeyDown)

      return () => {
        document.body.style.overflow = ''
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  const handleClose = () => {
    setIsClosing(true)
    setTimeout(() => {
      setIsClosing(false)
      onClose()
    }, 200)
  }

  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    dragStartY.current = clientY
    currentY.current = 0
  }

  const handleDrag = (e: React.TouchEvent | React.MouseEvent) => {
    if (dragStartY.current === 0) return
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const delta = clientY - dragStartY.current
    if (delta > 0 && sheetRef.current) {
      currentY.current = delta
      sheetRef.current.style.transform = `translateY(${delta}px)`
    }
  }

  const handleDragEnd = () => {
    if (currentY.current > 100) {
      handleClose()
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = ''
    }
    dragStartY.current = 0
    currentY.current = 0
  }

  // SSR safety: ensure document.body exists before rendering portal
  if (!mounted || !isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-labelledby="filter-sheet-title">
      {/* Backdrop */}
      <div
        className={clsx(
          'absolute inset-0 bg-black/50 transition-opacity duration-200',
          isClosing ? 'opacity-0' : 'opacity-100'
        )}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={clsx(
          'absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white shadow-2xl transition-transform duration-200',
          isClosing ? 'translate-y-full' : 'translate-y-0'
        )}
        style={{ maxHeight: '85vh' }}
      >
        {/* Drag Handle */}
        <div
          className="flex h-8 cursor-grab items-center justify-center active:cursor-grabbing"
          onTouchStart={handleDragStart}
          onTouchMove={handleDrag}
          onTouchEnd={handleDragEnd}
          onMouseDown={handleDragStart}
          onMouseMove={handleDrag}
          onMouseUp={handleDragEnd}
          onMouseLeave={handleDragEnd}
          role="button"
          aria-label="Drag to dismiss"
          tabIndex={0}
        >
          <div className="h-1 w-10 rounded-full bg-zinc-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-4 pb-3">
          <h2 id="filter-sheet-title" className="text-lg font-semibold text-zinc-900">{title}</h2>
          <button
            onClick={handleClose}
            aria-label="Close filters"
            className="flex h-10 w-10 items-center justify-center rounded-full text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto p-4" style={{ maxHeight: 'calc(85vh - 5rem)' }}>
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}

interface FilterSelectProps {
  label: string
  value: string | number
  options: ReadonlyArray<{ readonly value: string | number; readonly label: string }>
  onChange: (value: string | number) => void
}

/**
 * Mobile-optimized select for filter sheets
 * Uses 48px height and 16px font size (prevents iOS zoom)
 */
export function FilterSelect({ label, value, options, onChange }: FilterSelectProps) {
  return (
    <div className="mb-4">
      <label className="mb-2 block text-sm font-medium text-zinc-700">{label}</label>
      <select
        value={value}
        onChange={(e) => {
          const newValue = e.target.value
          // Try to parse as number, otherwise use string
          const numValue = Number(newValue)
          onChange(isNaN(numValue) ? newValue : numValue)
        }}
        className="h-12 w-full rounded-lg border border-zinc-300 bg-white px-4 text-base text-zinc-900 shadow-sm focus:border-green-600 focus:outline-none focus:ring-2 focus:ring-green-600/20"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
}

interface FilterCheckboxProps {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}

/**
 * Mobile-optimized checkbox for filter sheets
 */
export function FilterCheckbox({ label, checked, onChange }: FilterCheckboxProps) {
  return (
    <label className="flex min-h-[48px] cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 rounded border-zinc-300 text-green-600 focus:ring-green-600"
      />
      <span className="text-base text-zinc-700">{label}</span>
    </label>
  )
}
