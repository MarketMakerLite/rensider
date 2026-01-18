'use client'

import * as Headless from '@headlessui/react'
import NextLink from 'next/link'
import React, { forwardRef } from 'react'

export const Link = forwardRef(function Link(
  props: { href: string } & React.ComponentPropsWithoutRef<'a'>,
  ref: React.ForwardedRef<HTMLAnchorElement>
) {
  const { href, ...rest } = props
  return (
    <Headless.DataInteractive>
      <NextLink href={href} {...rest} ref={ref} />
    </Headless.DataInteractive>
  )
})
