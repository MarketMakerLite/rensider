'use client'

import { useState, useEffect } from 'react'

type FontType = 'mono' | 'serif'

export function FontToggle() {
  const [font, setFont] = useState<FontType>('mono')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('font-preference') as FontType | null
    if (saved === 'serif') {
      setFont('serif')
      document.body.classList.add('font-bodoni')
    }
  }, [])

  const toggleFont = () => {
    const newFont = font === 'mono' ? 'serif' : 'mono'
    setFont(newFont)
    localStorage.setItem('font-preference', newFont)

    if (newFont === 'serif') {
      document.body.classList.add('font-bodoni')
    } else {
      document.body.classList.remove('font-bodoni')
    }
  }

  // Fixed dimensions to prevent any layout shift
  const buttonClass = "flex items-center justify-center w-[88px] h-9 gap-1.5 border border-zinc-200 text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50"
  const labelClass = "inline-flex w-6 justify-center text-sm"

  // Avoid hydration mismatch - render same dimensions while loading
  if (!mounted) {
    return (
      <button className={buttonClass} disabled aria-label="Font toggle loading">
        <span className={`${labelClass} font-mono`}>Aa</span>
        <span className="text-zinc-300">|</span>
        <span className={`${labelClass} opacity-50`} style={{ fontFamily: "'Bodoni Moda', serif" }}>Aa</span>
      </button>
    )
  }

  return (
    <button
      onClick={toggleFont}
      className={buttonClass}
      title={`Switch to ${font === 'mono' ? 'Bodoni Moda' : 'Fira Code'}`}
      aria-label={`Current font: ${font === 'mono' ? 'Fira Code' : 'Bodoni Moda'}. Click to switch.`}
    >
      <span className={`${labelClass} font-mono transition-opacity ${font === 'mono' ? 'text-zinc-900' : 'opacity-40'}`}>Aa</span>
      <span className="text-zinc-300">|</span>
      <span
        className={`${labelClass} transition-opacity ${font === 'serif' ? 'text-zinc-900' : 'opacity-40'}`}
        style={{ fontFamily: "'Bodoni Moda', serif" }}
      >
        Aa
      </span>
    </button>
  )
}
