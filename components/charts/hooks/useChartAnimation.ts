'use client'

import { useState, useEffect, useCallback } from 'react'
import type { AnimationState } from '../types'

interface UseChartAnimationProps {
  enabled: boolean
  duration?: number
  delay?: number
}

interface UseChartAnimationReturn {
  state: AnimationState
  getAnimatedValue: (targetValue: number, startValue?: number) => number
  triggerAnimation: () => void
}

/**
 * Hook to manage chart animation state and provide animated values
 */
export function useChartAnimation({
  enabled,
  duration = 800,
  delay = 100,
}: UseChartAnimationProps): UseChartAnimationReturn {
  const [state, setState] = useState<AnimationState>({
    isInitialRender: true,
    isAnimating: false,
    isComplete: false,
    progress: 0,
  })

  // Trigger initial animation after mount
  useEffect(() => {
    if (!enabled) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing animation state on mount
      setState({
        isInitialRender: false,
        isAnimating: false,
        isComplete: true,
        progress: 1,
      })
      return
    }

    const delayTimer = setTimeout(() => {
      setState((prev) => ({
        ...prev,
        isAnimating: true,
      }))

      const startTime = Date.now()

      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)

        // Easing function (ease-out-cubic)
        const easedProgress = 1 - Math.pow(1 - progress, 3)

        setState({
          isInitialRender: false,
          isAnimating: progress < 1,
          isComplete: progress >= 1,
          progress: easedProgress,
        })

        if (progress < 1) {
          requestAnimationFrame(animate)
        }
      }

      requestAnimationFrame(animate)
    }, delay)

    return () => clearTimeout(delayTimer)
  }, [enabled, duration, delay])

  // Get animated value based on progress
  const getAnimatedValue = useCallback(
    (targetValue: number, startValue = 0): number => {
      if (!enabled || state.progress >= 1) {
        return targetValue
      }
      return startValue + (targetValue - startValue) * state.progress
    },
    [enabled, state.progress]
  )

  // Trigger a new animation (for data updates)
  const triggerAnimation = useCallback(() => {
    if (!enabled) return

    setState((prev) => ({
      ...prev,
      isAnimating: true,
      isComplete: false,
      progress: 0,
    }))

    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const easedProgress = 1 - Math.pow(1 - progress, 3)

      setState((prev) => ({
        ...prev,
        isAnimating: progress < 1,
        isComplete: progress >= 1,
        progress: easedProgress,
      }))

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    requestAnimationFrame(animate)
  }, [enabled, duration])

  return {
    state,
    getAnimatedValue,
    triggerAnimation,
  }
}
