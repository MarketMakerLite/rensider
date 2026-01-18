import clsx from 'clsx'

type HeadingProps = { level?: 1 | 2 | 3 | 4 | 5 | 6 } & React.ComponentPropsWithoutRef<
  'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
>

export function Heading({ className, level = 1, ...props }: HeadingProps) {
  const Element: `h${typeof level}` = `h${level}`

  return (
    <Element
      {...props}
      // Mobile-first: readable size on mobile, larger on desktop
      // Base styles first, then className allows overrides
      className={clsx('text-xl/7 font-semibold tracking-tight text-zinc-950 sm:text-2xl/8 lg:text-3xl/9', className)}
    />
  )
}

export function Subheading({ className, level = 2, ...props }: HeadingProps) {
  const Element: `h${typeof level}` = `h${level}`

  return (
    <Element
      {...props}
      // Mobile-first: compact on mobile, slightly larger on desktop
      // Base styles first, then className allows overrides
      className={clsx('text-sm/6 font-semibold tracking-tight text-zinc-950 sm:text-base/7', className)}
    />
  )
}
