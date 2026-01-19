'use client'

import {
  HomeIcon,
  DocumentTextIcon,
  BellAlertIcon,
  BookOpenIcon,
  UserGroupIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/20/solid'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Navbar, NavbarSpacer } from '@/components/twc/navbar'
import { FontToggle } from '@/components/common/FontToggle'
import { BackButton } from '@/components/common/BackButton'
import {
  Sidebar,
  SidebarHeader,
  SidebarBody,
  SidebarSection,
  SidebarItem,
  SidebarLabel,
  SidebarSpacer,
} from '@/components/twc/sidebar'
import { SidebarLayout } from '@/components/twc/sidebar-layout'

export function ApplicationLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const isCurrentRoute = (path: string, fuzzy: boolean = false) => {
    if (fuzzy) {
      return pathname.startsWith(path)
    }
    return pathname === path
  }

  return (
    <>
      {/* Floating back button - desktop only */}
      <div className="fixed left-[calc(14rem+1.5rem)] top-4 z-50 hidden lg:block">
        <BackButton />
      </div>
      {/* Floating font toggle - desktop only */}
      <div className="fixed right-4 top-4 z-50 hidden lg:block">
        <FontToggle />
      </div>
      <SidebarLayout
        navbar={
          <Navbar>
            <NavbarSpacer />
          </Navbar>
        }
        sidebar={
        <Sidebar>
          <SidebarHeader>
            <Link href="/" className="flex items-center gap-3 px-2">
              <Image
                src="/logo.svg"
                alt="Rensider"
                width={32}
                height={32}
                className="h-8 w-8"
              />
              <span className="text-base font-semibold text-zinc-950">Rensider</span>
            </Link>
          </SidebarHeader>
          <SidebarBody>
            <SidebarSection>
              <SidebarItem href="/" current={isCurrentRoute('/')}>
                <HomeIcon data-slot="icon" />
                <SidebarLabel>Home</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/alerts" current={isCurrentRoute('/alerts')}>
                <BellAlertIcon data-slot="icon" />
                <SidebarLabel>Alerts</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/new" current={isCurrentRoute('/new')}>
                <DocumentTextIcon data-slot="icon" />
                <SidebarLabel>New Filings</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/activists" current={isCurrentRoute('/activists', true)}>
                <UserGroupIcon data-slot="icon" />
                <SidebarLabel>Activist Actions</SidebarLabel>
              </SidebarItem>
              <SidebarItem href="/insiders" current={isCurrentRoute('/insiders', true) || isCurrentRoute('/insider', true)}>
                <CurrencyDollarIcon data-slot="icon" />
                <SidebarLabel>Insider Sales</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
            <SidebarSpacer />
            <SidebarSection>
              <SidebarItem href="/about" current={isCurrentRoute('/about')}>
                <BookOpenIcon data-slot="icon" />
                <SidebarLabel>About 13F/D/G</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarBody>
        </Sidebar>
      }
    >
        {children}
      </SidebarLayout>
    </>
  )
}
