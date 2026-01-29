'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'

export default function ActivistsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Activists page error:', error)
  }, [error])

  return (
    <ApplicationLayout>
      <div className="max-w-2xl py-16 text-center">
        <Heading>Failed to load activist data</Heading>
        <Text className="mt-2 text-zinc-600">
          Activist filing data could not be loaded. Please try again.
        </Text>
        {error.digest && (
          <Text className="mt-2 font-mono text-xs text-zinc-400">
            Error ID: {error.digest}
          </Text>
        )}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Try again
          </button>
          <Link
            href="/"
            className="bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
          >
            Go home
          </Link>
        </div>
      </div>
    </ApplicationLayout>
  )
}
