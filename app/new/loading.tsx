import { ApplicationLayout } from '@/components/layout/ApplicationLayout'

export default function NewFilingsLoading() {
  return (
    <ApplicationLayout>
      <div className="max-w-7xl animate-pulse">
        <div className="h-8 w-48 bg-zinc-200" />
        <div className="mt-2 h-5 w-72 bg-zinc-100" />
        <div className="mt-8 flex items-center gap-3">
          <div className="h-6 w-56 bg-zinc-200" />
          <div className="h-6 w-16 bg-zinc-200" />
        </div>
        <div className="mt-4 space-y-2">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-12 w-full bg-zinc-100" />
          ))}
        </div>
        <div className="mt-8 flex items-center gap-3">
          <div className="h-6 w-56 bg-zinc-200" />
          <div className="h-6 w-16 bg-zinc-200" />
        </div>
        <div className="mt-4 space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 w-full bg-zinc-100" />
          ))}
        </div>
      </div>
    </ApplicationLayout>
  )
}
