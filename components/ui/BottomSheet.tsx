'use client'

import { type ReactNode, useEffect } from 'react'
import { Dialog, DialogPanel, DialogTitle } from '@headlessui/react'
import { motion, AnimatePresence, useDragControls, useMotionValue, type PanInfo } from 'motion/react'
import { bottomSheet } from '@/lib/animations'

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

const DISMISS_THRESHOLD = 100

/**
 * Mobile-optimized bottom sheet component
 * - Slides up from bottom with spring animation
 * - Includes drag handle indicator
 * - Safe area padding for notched devices
 * - Max height 85vh with overflow scroll
 * - Swipe down to dismiss
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const dragControls = useDragControls()
  const dragY = useMotionValue(0)

  // Lock body scroll when sheet is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      // Reset drag position when sheet opens
      dragY.set(0)
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open, dragY])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > DISMISS_THRESHOLD || info.velocity.y > 500) {
      onClose()
    } else {
      // Animate back to origin
      dragY.set(0)
    }
  }

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
              drag="y"
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0, bottom: 0.5 }}
              onDragEnd={handleDragEnd}
              style={{
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                y: dragY,
              }}
              className="w-full max-h-[85vh] overflow-hidden bg-white pb-safe touch-none"
            >
              {/* Drag handle - draggable area */}
              <div
                className="flex cursor-grab justify-center pt-3 pb-2 active:cursor-grabbing"
                onPointerDown={(e) => dragControls.start(e)}
              >
                <div className="h-1 w-10 rounded-full bg-zinc-300" />
              </div>

              {/* Title (optional) - also draggable */}
              {title && (
                <DialogTitle
                  className="cursor-grab px-4 pb-3 text-base font-semibold text-zinc-900 border-b border-zinc-100 active:cursor-grabbing"
                  onPointerDown={(e) => dragControls.start(e)}
                >
                  {title}
                </DialogTitle>
              )}

              {/* Content with overflow scroll */}
              <div className="overflow-y-auto overscroll-contain touch-auto" style={{ maxHeight: 'calc(85vh - 4rem)' }}>
                {children}
              </div>
            </DialogPanel>
          </div>
        </Dialog>
      )}
    </AnimatePresence>
  )
}
