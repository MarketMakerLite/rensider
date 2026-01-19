'use client'

import { type ReactNode, useEffect } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { motion, AnimatePresence } from 'motion/react'
import { bottomSheet } from '@/lib/animations'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

/**
 * Mobile-optimized bottom sheet component
 * - Slides up from bottom with spring animation
 * - Includes drag handle indicator
 * - Safe area padding for notched devices
 * - Max height 85vh with overflow scroll
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  // Lock body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <Dialog static open={open} onClose={onClose} className="relative z-50 lg:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40"
            aria-hidden="true"
          />

          {/* Panel container */}
          <div className="fixed inset-x-0 bottom-0 flex items-end justify-center">
            <DialogPanel
              as={motion.div}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={bottomSheet}
              className="w-full max-h-[85vh] overflow-hidden bg-white pb-safe"
              style={{ borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="h-1 w-10 rounded-full bg-zinc-300" />
              </div>

              {/* Title (optional) */}
              {title && (
                <DialogTitle className="px-4 pb-3 text-base font-semibold text-zinc-900 border-b border-zinc-100">
                  {title}
                </DialogTitle>
              )}

              {/* Content with overflow scroll */}
              <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(85vh - 4rem)' }}>
                {children}
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  )
}
