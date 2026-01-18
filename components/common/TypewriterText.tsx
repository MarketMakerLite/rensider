'use client'

import { useState, useEffect, useRef } from 'react'
import { motion } from 'motion/react'

interface TypewriterTextProps {
  text: string
  className?: string
  /** Delay before starting (ms) */
  startDelay?: number
  /** Time per character (ms) */
  charDelay?: number
  /** Storage key to track if animation has played */
  storageKey?: string
  /** Callback when typing completes */
  onComplete?: () => void
}

export function TypewriterText({
  text,
  className = '',
  startDelay = 300,
  charDelay = 25,
  storageKey = 'typewriter-played',
  onComplete,
}: TypewriterTextProps) {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)
  const [shouldAnimate, setShouldAnimate] = useState(false)
  const hasStarted = useRef(false)

  // Check if we should animate (only on first visit)
  useEffect(() => {
    if (typeof window === 'undefined') return

    const hasPlayed = sessionStorage.getItem(storageKey)
    if (hasPlayed) {
      // Skip animation, show full text immediately
      setDisplayedText(text)
      setIsComplete(true)
    } else {
      setShouldAnimate(true)
    }
  }, [text, storageKey])

  // Run typewriter animation
  useEffect(() => {
    if (!shouldAnimate || hasStarted.current) return
    hasStarted.current = true

    let currentIndex = 0
    let timeoutId: NodeJS.Timeout

    const startTyping = () => {
      const typeNextChar = () => {
        if (currentIndex < text.length) {
          currentIndex++
          setDisplayedText(text.slice(0, currentIndex))
          timeoutId = setTimeout(typeNextChar, charDelay)
        } else {
          setIsComplete(true)
          sessionStorage.setItem(storageKey, 'true')
          onComplete?.()
        }
      }

      timeoutId = setTimeout(typeNextChar, startDelay)
    }

    startTyping()

    return () => {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [shouldAnimate, text, startDelay, charDelay, storageKey, onComplete])

  return (
    <span className={className}>
      {displayedText}
      {!isComplete && shouldAnimate && (
        <motion.span
          className="inline-block w-0.5 h-[1.1em] bg-zinc-400 ml-0.5 align-middle"
          animate={{ opacity: [1, 0] }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            repeatType: 'reverse',
          }}
        />
      )}
    </span>
  )
}
