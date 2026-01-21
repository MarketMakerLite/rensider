'use client'

import * as Headless from '@headlessui/react'
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence, useDragControls, useMotionValue, useReducedMotion, type PanInfo } from 'motion/react'
import { NavbarItem } from './navbar'
import { rightDrawer } from '@/lib/animations'
import { FontToggle } from '@/components/common/FontToggle'
import Link from 'next/link'
import Image from 'next/image'

const DISMISS_THRESHOLD = 100

function OpenMenuIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M2 6.75C2 6.33579 2.33579 6 2.75 6H17.25C17.6642 6 18 6.33579 18 6.75C18 7.16421 17.6642 7.5 17.25 7.5H2.75C2.33579 7.5 2 7.16421 2 6.75ZM2 13.25C2 12.8358 2.33579 12.5 2.75 12.5H17.25C17.6642 12.5 18 12.8358 18 13.25C18 13.6642 17.6642 14 17.25 14H2.75C2.33579 14 2 13.6642 2 13.25Z" />
    </svg>
  )
}

function CloseMenuIcon() {
  return (
    <svg data-slot="icon" viewBox="0 0 20 20" aria-hidden="true">
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
    </svg>
  )
}

function MobileSidebar({ open, close, children }: React.PropsWithChildren<{ open: boolean; close: () => void }>) {
  const dragControls = useDragControls()
  const dragX = useMotionValue(0)
  const shouldReduceMotion = useReducedMotion()

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      dragX.set(0)
      return () => {
        document.body.style.overflow = ''
      }
    }
  }, [open, dragX])

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    // Dismiss if dragged right past threshold or with velocity
    if (info.offset.x > DISMISS_THRESHOLD || info.velocity.x > 500) {
      close()
    } else {
      dragX.set(0)
    }
  }

  // Reduced motion variants - instant transitions for users who prefer reduced motion
  const reducedMotionVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1 },
    exit: { opacity: 0 },
  }

  return (
    <AnimatePresence>
      {open && (
        <Headless.Dialog static open={open} onClose={close} className="relative z-40 lg:hidden">
          {/* Backdrop - starts below header */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.15 }}
            className="fixed inset-0 top-[calc(3rem+env(safe-area-inset-top,0px))] bg-black/40"
            aria-hidden="true"
          />

          {/* Right drawer - full height below header */}
          <div className="fixed inset-0 top-[calc(3rem+env(safe-area-inset-top,0px))] right-0 flex justify-end">
            <Headless.DialogPanel
              as={motion.div}
              id="mobile-sidebar"
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={shouldReduceMotion ? reducedMotionVariants : rightDrawer}
              drag={shouldReduceMotion ? false : "x"}
              dragControls={dragControls}
              dragListener={false}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0, right: 0.5 }}
              onDragEnd={handleDragEnd}
              className="w-72 h-full touch-none overflow-hidden bg-zinc-50"
              style={{ x: shouldReduceMotion ? undefined : dragX }}
            >
              {/* Drawer header with close button */}
              <div className="flex items-center justify-between border-b border-zinc-200/60 px-4 py-3">
                <FontToggle />
                <Headless.CloseButton as={NavbarItem} aria-label="Close navigation" className="touch-target">
                  <CloseMenuIcon />
                </Headless.CloseButton>
              </div>

              {/* Drag handle - vertical bar on left edge (hidden when reduced motion is enabled) */}
              {!shouldReduceMotion && (
                <div
                  className="absolute left-0 top-0 bottom-0 w-4 cursor-grab flex items-center justify-center active:cursor-grabbing"
                  onPointerDown={(e) => dragControls.start(e)}
                  role="button"
                  aria-label="Drag to dismiss navigation"
                  tabIndex={0}
                >
                  <div className="h-16 w-1 rounded-full bg-zinc-300" />
                </div>
              )}

              {/* Content with scroll */}
              <div className="touch-auto overflow-y-auto overscroll-contain h-full pb-safe pl-2">
                {children}
              </div>
            </Headless.DialogPanel>
          </div>
        </Headless.Dialog>
      )}
    </AnimatePresence>
  )
}

export function SidebarLayout({
  sidebar,
  children,
}: React.PropsWithChildren<{ sidebar: React.ReactNode }>) {
  const [showSidebar, setShowSidebar] = useState(false)

  return (
    <div className="relative isolate flex min-h-dvh w-full flex-col bg-zinc-50 lg:flex-row lg:bg-zinc-100">
      {/* Sidebar on desktop - hidden on mobile, fixed on desktop */}
      <div className="fixed inset-y-0 left-0 hidden w-56 lg:block">{sidebar}</div>

      {/* Sidebar on mobile - slide-out drawer */}
      <MobileSidebar open={showSidebar} close={() => setShowSidebar(false)}>
        {sidebar}
      </MobileSidebar>

      {/* Mobile header with logo and menu button */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-zinc-200/60 bg-zinc-50 px-4 safe-area-inset-top lg:hidden">
        {/* Logo/Title on left */}
        <Link href="/" className="flex items-center gap-2 py-2">
          <Image
            src="/logo.svg"
            alt="Rensider"
            width={24}
            height={24}
            className="h-6 w-6"
          />
          <span className="text-sm font-semibold text-zinc-950">Rensider</span>
        </Link>

        {/* Menu button on right */}
        <div className="py-2">
          <NavbarItem
            onClick={() => setShowSidebar(true)}
            aria-label="Open navigation"
            aria-expanded={showSidebar}
            aria-controls="mobile-sidebar"
            className="touch-target flex items-center justify-center"
          >
            <OpenMenuIcon />
          </NavbarItem>
        </div>
      </header>

      {/* Main content area */}
      <main role="main" className="flex flex-1 flex-col lg:min-w-0 lg:pl-56">
        <div className="grow px-4 pb-6 pt-12 sm:px-6 lg:bg-zinc-50 lg:px-10 lg:pb-10 lg:pt-14">
          <div className="mx-auto max-w-7xl px-0 sm:px-4 lg:px-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
