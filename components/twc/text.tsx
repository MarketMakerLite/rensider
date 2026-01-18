import clsx from 'clsx'
import { Link } from './link'

export function Text({ className, ...props }: React.ComponentPropsWithoutRef<'p'>) {
  return (
    <p
      data-slot="text"
      {...props}
      // Mobile-first: slightly smaller on mobile for better density
      // Base styles first, then className allows overrides
      className={clsx('text-sm/6 text-zinc-500 sm:text-base/6', className)}
    />
  )
}

export function TextLink({ className, ...props }: React.ComponentPropsWithoutRef<typeof Link>) {
  return (
    <Link
      {...props}
      className={clsx(
        className,
        'text-zinc-950 underline decoration-zinc-950/50 data-hover:decoration-zinc-950'
      )}
    />
  )
}

export function Strong({ className, ...props }: React.ComponentPropsWithoutRef<'strong'>) {
  return <strong {...props} className={clsx('font-medium text-zinc-950', className)} />
}

export function Code({ className, ...props }: React.ComponentPropsWithoutRef<'code'>) {
  return (
    <code
      {...props}
      // Mobile-first: smaller code text on mobile
      // Base styles first, then className allows overrides
      className={clsx(
        'rounded-sm border border-zinc-950/10 bg-zinc-950/2.5 px-0.5 text-xs font-medium text-zinc-950 sm:text-sm',
        className
      )}
    />
  )
}
