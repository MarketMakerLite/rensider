import { ApplicationLayout } from '@/components/layout/ApplicationLayout'

export default function InsiderProfileLoading() {
  return (
    <ApplicationLayout>
      <div className="max-w-7xl animate-pulse">
        <div className="h-8 w-56 bg-zinc-200" />
        <div className="mt-2 h-5 w-40 bg-zinc-100" />
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="border border-zinc-200 p-4">
              <div className="h-4 w-20 bg-zinc-100" />
              <div className="mt-2 h-8 w-24 bg-zinc-200" />
            </div>
          ))}
        </div>
        <div className="mt-8 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 w-full bg-zinc-100" />
          ))}
        </div>
      </div>
    </ApplicationLayout>
  )
}
