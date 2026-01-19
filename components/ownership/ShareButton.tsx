'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react'
import { BottomSheet } from '@/components/ui/BottomSheet'
import { useIsMobile } from '@/hooks/useIsMobile'

interface ShareButtonProps {
  title: string
  description?: string
  url?: string
}

export function ShareButton({ title, description, url }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  const [isSheetOpen, setIsSheetOpen] = useState(false)
  const isMobile = useIsMobile()
  const closeTimerRef = useRef<NodeJS.Timeout | null>(null)
  const copiedTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Clear timers on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current)
      }
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
    }
  }, [])

  const getShareUrl = useCallback(() => {
    if (url) return url
    if (typeof window !== 'undefined') {
      return window.location.href
    }
    return ''
  }, [url])

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(getShareUrl())
      setCopied(true)
      if (copiedTimerRef.current) {
        clearTimeout(copiedTimerRef.current)
      }
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy link:', error)
    }
  }, [getShareUrl])

  const handleNativeShare = useCallback(async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text: description,
          url: getShareUrl(),
        })
      } catch (error) {
        // User cancelled or share failed
        if (error instanceof Error && error.name !== 'AbortError') {
          console.error('Share failed:', error)
        }
      }
    }
  }, [title, description, getShareUrl])

  const hasNativeShare = typeof navigator !== 'undefined' && 'share' in navigator

  // Share options content - reusable for both dropdown and bottom sheet
  const shareOptions = (
    <>
      {hasNativeShare && (
        <button
          onClick={() => {
            handleNativeShare()
            setIsSheetOpen(false)
          }}
          className={`flex w-full items-center gap-3 text-left text-zinc-700 ${
            isMobile ? 'min-h-[48px] px-4 py-3 active:bg-zinc-100' : 'px-3 py-2 data-[focus]:bg-zinc-50'
          }`}
        >
          <ShareIcon className={isMobile ? 'h-5 w-5 text-zinc-500' : 'h-4 w-4 text-zinc-400'} />
          <span className={isMobile ? 'text-base' : 'text-sm'}>Share...</span>
        </button>
      )}

      <button
        onClick={() => {
          handleCopyLink()
          if (isMobile) {
            closeTimerRef.current = setTimeout(() => setIsSheetOpen(false), 1500)
          }
        }}
        className={`flex w-full items-center gap-3 text-left text-zinc-700 ${
          isMobile ? 'min-h-[48px] px-4 py-3 active:bg-zinc-100' : 'px-3 py-2 data-[focus]:bg-zinc-50'
        }`}
      >
        {copied ? (
          <>
            <CheckIcon className={isMobile ? 'h-5 w-5 text-green-500' : 'h-4 w-4 text-green-500'} />
            <span className={isMobile ? 'text-base text-green-600' : 'text-sm'}>Copied!</span>
          </>
        ) : (
          <>
            <LinkIcon className={isMobile ? 'h-5 w-5 text-zinc-500' : 'h-4 w-4 text-zinc-400'} />
            <span className={isMobile ? 'text-base' : 'text-sm'}>Copy Link</span>
          </>
        )}
      </button>
    </>
  )

  // Mobile: Button opens BottomSheet
  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setIsSheetOpen(true)}
          className="inline-flex items-center gap-1.5 border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors active:bg-zinc-100 touch-target"
        >
          <ShareIcon className="h-4 w-4" />
          Share
        </button>

        <BottomSheet
          open={isSheetOpen}
          onClose={() => {
            if (closeTimerRef.current) {
              clearTimeout(closeTimerRef.current)
              closeTimerRef.current = null
            }
            setIsSheetOpen(false)
          }}
          title="Share"
        >
          <div className="pb-4">
            {shareOptions}
          </div>
        </BottomSheet>
      </>
    )
  }

  // Desktop: Menu dropdown
  return (
    <Menu as="div" className="relative">
      <MenuButton className="inline-flex items-center gap-1.5 border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
        <ShareIcon className="h-4 w-4" />
        Share
      </MenuButton>

      <MenuItems className="absolute right-0 z-10 mt-1 w-48 origin-top-right border border-zinc-200 bg-white shadow-lg focus:outline-none">
        {hasNativeShare && (
          <MenuItem>
            <button
              onClick={handleNativeShare}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 data-[focus]:bg-zinc-50"
            >
              <ShareIcon className="h-4 w-4 text-zinc-400" />
              Share...
            </button>
          </MenuItem>
        )}

        <MenuItem>
          <button
            onClick={handleCopyLink}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-zinc-700 data-[focus]:bg-zinc-50"
          >
            {copied ? (
              <>
                <CheckIcon className="h-4 w-4 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <LinkIcon className="h-4 w-4 text-zinc-400" />
                Copy Link
              </>
            )}
          </button>
        </MenuItem>

      </MenuItems>
    </Menu>
  )
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
      />
    </svg>
  )
}

function LinkIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  )
}

