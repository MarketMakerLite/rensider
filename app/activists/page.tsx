import type { Metadata } from 'next'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading, Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { getActivistActivity } from '@/actions/activists'
import { BeneficialOwnerSearch } from './BeneficialOwnerSearch'
import { ActivistActivityTable } from '@/components/activists/ActivistActivityTable'

// Force dynamic rendering for database queries
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Activist Activity | Rensider',
  description: 'Track activist investor filings (Schedule 13D and 13G) from the SEC. Monitor major shareholders with 5%+ positions and activist campaigns.',
  alternates: {
    canonical: 'https://renbot.app/activists',
  },
  openGraph: {
    title: 'Activist Activity | Rensider',
    description: 'Track Schedule 13D/G activist investor filings from the SEC',
    images: ['/api/og/home'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Activist Activity | Rensider',
    description: 'Track Schedule 13D/G activist investor filings from the SEC',
    images: ['/api/og/home'],
  },
}

export default async function BeneficialOwnersPage() {
  const activities = await getActivistActivity({ days: 90, limit: 200 })

  return (
    <ApplicationLayout>
      <div className="max-w-7xl">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <Heading>Activist Activity</Heading>
            <Badge color="blue">Schedule 13D/G</Badge>
          </div>
          <Text className="mt-1 text-zinc-600">
            Track investors with 5%+ beneficial ownership in public companies
          </Text>
        </div>

        {/* Search */}
        <div className="mt-6">
          <BeneficialOwnerSearch />
        </div>

        {/* Explanation Cards */}
        <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6 md:grid-cols-2">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-50 text-red-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <Text className="font-medium text-zinc-900">Schedule 13D</Text>
            </div>
            <Text className="mt-3 text-sm leading-relaxed text-zinc-600">
              Filed by activist investors who hold 5%+ and may seek to influence management,
              pursue strategic changes, or seek board representation.
            </Text>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <Text className="font-medium text-zinc-900">Schedule 13G</Text>
            </div>
            <Text className="mt-3 text-sm leading-relaxed text-zinc-600">
              Filed by passive investors (institutional or individual) who hold 5%+
              with no intent to influence control of the company.
            </Text>
          </div>
        </div>

        {/* Recent Activist Activity */}
        <ActivistActivityTable activities={activities} />

        {/* How it works */}
        <div className="mt-8 border-t border-zinc-200 pt-8">
          <Subheading level={2}>Understanding Beneficial Ownership</Subheading>
          <div className="mt-4 grid gap-4 sm:gap-6 md:grid-cols-3">
            <div>
              <Text className="font-medium text-zinc-900">5% Threshold</Text>
              <Text className="mt-1 text-sm text-zinc-600">
                Any person or group acquiring beneficial ownership of more than 5%
                of a public company must file within 10 days.
              </Text>
            </div>
            <div>
              <Text className="font-medium text-zinc-900">Beneficial Ownership</Text>
              <Text className="mt-1 text-sm text-zinc-600">
                Includes shares you own, have voting power over, or have
                the right to acquire within 60 days.
              </Text>
            </div>
            <div>
              <Text className="font-medium text-zinc-900">Form Type</Text>
              <Text className="mt-1 text-sm text-zinc-600">
                13D is required for activist intent. 13G is for passive
                investors meeting specific criteria.
              </Text>
            </div>
          </div>
        </div>
      </div>
    </ApplicationLayout>
  )
}
