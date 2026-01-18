import { ApplicationLayout } from '@/components/layout/ApplicationLayout'

export default function StockLoading() {
  return (
    <ApplicationLayout>
      <div className="max-w-7xl animate-pulse">
        {/* Header skeleton */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <div className="h-8 w-24 bg-zinc-200" />
              <div className="h-6 w-16 bg-zinc-200" />
            </div>
            <div className="mt-2 h-5 w-48 bg-zinc-100" />
          </div>
          <div className="h-9 w-20 bg-zinc-100" />
        </div>

        {/* Metrics grid skeleton */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-zinc-200 p-4">
              <div className="h-4 w-20 bg-zinc-100" />
              <div className="mt-2 h-8 w-24 bg-zinc-200" />
              <div className="mt-2 h-3 w-32 bg-zinc-100" />
            </div>
          ))}
        </div>

        {/* Chart skeleton */}
        <div className="mt-8">
          <div className="h-6 w-40 bg-zinc-200" />
          <div className="mt-4 h-64 w-full bg-zinc-100" />
        </div>

        {/* Table skeleton */}
        <div className="mt-8">
          <div className="h-6 w-32 bg-zinc-200" />
          <div className="mt-4 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 w-full bg-zinc-100" />
            ))}
          </div>
        </div>
      </div>
    </ApplicationLayout>
  )
}
