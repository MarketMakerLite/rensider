'use client'

const GITHUB_URL = 'https://github.com/MarketMakerLite/rensider/'

function GitHubIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  )
}

/**
 * GitHub link component for desktop floating position
 * Matches the styling of FontToggle for visual consistency
 */
export function GitHubLinkFloating() {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="flex h-9 w-9 items-center justify-center border border-zinc-200 bg-white text-zinc-600 transition-colors hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-950 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-2"
      title="View source on GitHub"
      aria-label="View source on GitHub"
    >
      <GitHubIcon className="h-5 w-5" />
    </a>
  )
}

/**
 * GitHub link component for navbar (mobile)
 * Uses NavbarItem-compatible styling with stroke-based icon
 */
export function GitHubLinkNavbar() {
  return (
    <a
      href={GITHUB_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="relative flex min-w-0 cursor-pointer items-center gap-3 p-2 text-zinc-500 transition-colors hover:bg-zinc-950/5 hover:text-zinc-950 active:bg-zinc-950/5 active:text-zinc-950"
      title="View source on GitHub"
      aria-label="View source on GitHub"
    >
      <GitHubIcon className="h-6 w-6 shrink-0 sm:h-5 sm:w-5" />
    </a>
  )
}
