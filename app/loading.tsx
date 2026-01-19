'use client'

import { motion, AnimatePresence } from 'motion/react'
import { RingSpinner, RotatingLoadingMessage } from '@/components/ui/Spinner'
import { duration, easing } from '@/lib/animations'

export default function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: duration.normal, ease: easing.smooth }}
        className="flex flex-col items-center gap-5"
      >
        <RingSpinner size="xl" className="text-zinc-800" />
        <AnimatePresence mode="wait">
          <RotatingLoadingMessage className="text-base" />
        </AnimatePresence>
      </motion.div>
    </div>
  )
}
