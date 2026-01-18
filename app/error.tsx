'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error('Application error:', error)
  }, [error])

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center border border-red-200 bg-red-50 text-red-500">
          <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
        </div>

        <h1 className="mt-6 text-2xl font-semibold text-zinc-900">
          Something went wrong
        </h1>

        <p className="mt-2 text-zinc-600">
          An unexpected error occurred. Please try again.
        </p>

        {error.digest && (
          <p className="mt-2 font-mono text-xs text-zinc-400">
            Error ID: {error.digest}
          </p>
        )}

        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={reset}
            className="border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
          >
            Try again
          </button>
          <Link
            href="/"
            className="bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
