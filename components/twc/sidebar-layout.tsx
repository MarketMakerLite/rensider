'use client'

import * as Headless from '@headlessui/react'
import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { NavbarItem } from './navbar'
import { bottomSheet } from '@/lib/animations'

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
        <Headless.Dialog static open={open} onClose={close} className="relative z-50 lg:hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/40"
            aria-hidden="true"
          />

          {/* Bottom sheet panel */}
          <div className="fixed inset-x-0 bottom-0 flex items-end justify-center">
            <Headless.DialogPanel
              as={motion.div}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={bottomSheet}
              className="w-full max-h-[85vh] overflow-hidden bg-zinc-50 pb-safe"
              style={{ borderTopLeftRadius: '16px', borderTopRightRadius: '16px' }}
            >
              {/* Drag handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="h-1 w-10 rounded-full bg-zinc-300" />
              </div>

              {/* Close button */}
              <div className="flex justify-end px-4 pb-2">
                <Headless.CloseButton as={NavbarItem} aria-label="Close navigation" className="touch-target">
                  <CloseMenuIcon />
                </Headless.CloseButton>
              </div>

              {/* Content with overflow scroll */}
              <div className="overflow-y-auto overscroll-contain" style={{ maxHeight: 'calc(85vh - 5rem)' }}>
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
  navbar,
  sidebar,
  children,
}: React.PropsWithChildren<{ navbar: React.ReactNode; sidebar: React.ReactNode }>) {
  const [showSidebar, setShowSidebar] = useState(false)

  return (
    <div className="relative isolate flex min-h-svh w-full flex-col bg-zinc-50 lg:flex-row lg:bg-zinc-100">
      {/* Sidebar on desktop - hidden on mobile, fixed on desktop */}
      <div className="fixed inset-y-0 left-0 hidden w-56 lg:block">{sidebar}</div>

      {/* Sidebar on mobile - slide-out drawer */}
      <MobileSidebar open={showSidebar} close={() => setShowSidebar(false)}>
        {sidebar}
      </MobileSidebar>

      {/* Mobile header with hamburger menu */}
      <header className="flex items-center border-b border-zinc-200/60 px-4 safe-area-inset-top lg:hidden">
        <div className="py-2">
          <NavbarItem
            onClick={() => setShowSidebar(true)}
            aria-label="Open navigation"
            className="touch-target flex items-center justify-center"
          >
            <OpenMenuIcon />
          </NavbarItem>
        </div>
        <div className="min-w-0 flex-1">{navbar}</div>
      </header>

      {/* Main content area */}
      <main className="flex flex-1 flex-col lg:min-w-0 lg:pl-56">
        <div className="grow px-4 pb-6 pt-12 sm:px-6 lg:bg-zinc-50 lg:px-10 lg:pb-10 lg:pt-14">
          <div className="mx-auto max-w-7xl px-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
