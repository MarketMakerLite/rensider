import { ApplicationLayout } from '@/components/layout/ApplicationLayout'

export default function FundLoading() {
  return (
    <ApplicationLayout>
      <div className="max-w-7xl animate-pulse">
        {/* Header skeleton */}
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="h-8 w-64 bg-zinc-200" />
            <div className="mt-2 flex items-center gap-3">
              <div className="h-5 w-32 bg-zinc-100" />
              <div className="h-5 w-24 bg-zinc-100" />
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <div className="h-20 w-32 bg-zinc-100" />
            <div className="h-9 w-20 bg-zinc-100" />
          </div>
        </div>

        {/* Metrics skeleton */}
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="border border-zinc-200 p-4">
              <div className="h-4 w-20 bg-zinc-100" />
              <div className="mt-2 h-8 w-24 bg-zinc-200" />
              <div className="mt-2 h-3 w-28 bg-zinc-100" />
            </div>
          ))}
        </div>

        {/* Top holdings skeleton */}
        <div className="mt-6">
          <div className="h-4 w-24 bg-zinc-200" />
          <div className="mt-2 flex flex-wrap gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-6 w-20 bg-zinc-100" />
            ))}
          </div>
        </div>

        {/* Treemap skeleton */}
        <div className="mt-8">
          <div className="h-6 w-40 bg-zinc-200" />
          <div className="mt-4 h-64 w-full bg-zinc-100" />
        </div>

        {/* Charts row skeleton */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="border border-zinc-200 p-4">
            <div className="h-5 w-28 bg-zinc-200" />
            <div className="mt-4 h-64 bg-zinc-100" />
          </div>
          <div className="border border-zinc-200 p-4">
            <div className="h-5 w-36 bg-zinc-200" />
            <div className="mt-4 space-y-4">
              {[...Array(3)].map((_, i) => (
                <div key={i}>
                  <div className="h-4 w-full bg-zinc-100" />
                  <div className="mt-1 h-2 w-full bg-zinc-50" />
                </div>
              ))}
            </div>
          </div>
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
