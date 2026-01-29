'use client'

import { useState, useEffect } from 'react'

type FontType = 'mono' | 'sans' | 'serif'

const fontClasses: Record<FontType, string | null> = {
  mono: null,
  sans: 'font-noto-sans',
  serif: 'font-noto-serif',
}

const fontLabels: Record<FontType, string> = {
  mono: 'Fira Code',
  sans: 'Noto Sans',
  serif: 'Noto Serif',
}

const fontCycle: FontType[] = ['mono', 'sans', 'serif']

export function FontToggle() {
  const [font, setFont] = useState<FontType>('mono')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true) // eslint-disable-line react-hooks/set-state-in-effect -- hydration guard
    const saved = localStorage.getItem('font-preference') as FontType | null
    if (saved && fontCycle.includes(saved)) {
      setFont(saved)
      const fontClass = fontClasses[saved]
      if (fontClass) {
        document.body.classList.add(fontClass)
      }
    }
  }, [])

  const cycleFont = () => {
    const currentIndex = fontCycle.indexOf(font)
    const nextIndex = (currentIndex + 1) % fontCycle.length
    const newFont = fontCycle[nextIndex]

    // Remove current font class
    const currentClass = fontClasses[font]
    if (currentClass) {
      document.body.classList.remove(currentClass)
    }

    // Add new font class
    const newClass = fontClasses[newFont]
    if (newClass) {
      document.body.classList.add(newClass)
    }

    setFont(newFont)
    localStorage.setItem('font-preference', newFont)
  }

  // Fixed dimensions to prevent any layout shift
  const buttonClass = "flex items-center justify-center w-[120px] h-9 gap-1 border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
  const labelClass = "inline-flex w-6 justify-center text-sm"

  // Avoid hydration mismatch - render same dimensions while loading
  if (!mounted) {
    return (
      <button className={buttonClass} disabled aria-label="Font toggle loading">
        <span className={`${labelClass} font-mono`}>Aa</span>
        <span className="text-zinc-300">|</span>
        <span className={`${labelClass} opacity-50`} style={{ fontFamily: "'Noto Sans', sans-serif" }}>Aa</span>
        <span className="text-zinc-300">|</span>
        <span className={`${labelClass} opacity-50`} style={{ fontFamily: "'Noto Serif', serif" }}>Aa</span>
      </button>
    )
  }

  const nextFont = fontCycle[(fontCycle.indexOf(font) + 1) % fontCycle.length]

  return (
    <button
      onClick={cycleFont}
      className={buttonClass}
      title={`Switch to ${fontLabels[nextFont]}`}
      aria-label={`Current font: ${fontLabels[font]}. Click to switch to ${fontLabels[nextFont]}.`}
    >
      <span className={`${labelClass} font-mono transition-opacity ${font === 'mono' ? 'text-zinc-900' : 'opacity-40'}`}>Aa</span>
      <span className="text-zinc-300">|</span>
      <span
        className={`${labelClass} transition-opacity ${font === 'sans' ? 'text-zinc-900' : 'opacity-40'}`}
        style={{ fontFamily: "'Noto Sans', sans-serif" }}
      >
        Aa
      </span>
      <span className="text-zinc-300">|</span>
      <span
        className={`${labelClass} transition-opacity ${font === 'serif' ? 'text-zinc-900' : 'opacity-40'}`}
        style={{ fontFamily: "'Noto Serif', serif" }}
      >
        Aa
      </span>
    </button>
  )
}
