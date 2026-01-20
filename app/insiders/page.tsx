import type { Metadata } from 'next'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading, Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { getRecentInsiderTransactions } from '@/actions/insider-sales'
import { InsiderTransactionsTable } from '@/components/insider-sales/InsiderTransactionsTable'

// Force dynamic rendering for database queries
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Insider Activity | Rensider',
  description: 'Track insider trading activity from SEC Form 3, 4, and 5 filings. Monitor insider purchases and sales in public companies.',
  alternates: {
    canonical: 'https://renbot.app/insiders',
  },
  openGraph: {
    title: 'Insider Activity | Rensider',
    description: 'Track insider trading activity from SEC Form 3/4/5 filings',
    images: ['/api/og/home'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Insider Activity | Rensider',
    description: 'Track insider trading activity from SEC Form 3/4/5 filings',
    images: ['/api/og/home'],
  },
}

export default async function InsiderSalesPage() {
  const { transactions, totalCount } = await getRecentInsiderTransactions({ limit: 200 })

  return (
    <ApplicationLayout>
      <div className="max-w-6xl">
        {/* Header */}
        <div>
          <div className="flex items-center gap-3">
            <Heading>Insider Activity</Heading>
            <Badge color="amber">Form 3/4/5</Badge>
          </div>
          <Text className="mt-1 text-zinc-600">
            When executives buy their own stock, it often means something
          </Text>
        </div>

        {/* Explanation Cards */}
        <div className="mt-6 grid gap-4 sm:mt-8 sm:gap-6 md:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                </svg>
              </div>
              <Text className="font-medium text-zinc-900">Form 3</Text>
            </div>
            <Text className="mt-3 text-sm leading-relaxed text-zinc-600">
              Initial statement of beneficial ownership filed when someone becomes an insider.
            </Text>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </div>
              <Text className="font-medium text-zinc-900">Form 4</Text>
            </div>
            <Text className="mt-3 text-sm leading-relaxed text-zinc-600">
              The main filing for insider trades. Executives must report within 2 days.
            </Text>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-50 text-purple-600">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <Text className="font-medium text-zinc-900">Form 5</Text>
            </div>
            <Text className="mt-3 text-sm leading-relaxed text-zinc-600">
              Annual statement of changes. Reports transactions not previously filed.
            </Text>
          </div>
        </div>

        {/* Recent Transactions */}
        <InsiderTransactionsTable
          transactions={transactions}
          title={totalCount > 0 ? `Recent Insider Transactions (${totalCount.toLocaleString()} total)` : 'Recent Insider Transactions'}
          showCompany={true}
        />

        {/* How it works */}
        <div className="mt-8 border-t border-zinc-200 pt-8">
          <Subheading level={2}>Understanding Insider Trading</Subheading>
          <div className="mt-4 grid gap-4 sm:gap-6 md:grid-cols-3">
            <div>
              <Text className="font-medium text-zinc-900">Who are Insiders?</Text>
              <Text className="mt-1 text-sm text-zinc-600">
                Officers, directors, and 10%+ beneficial owners of a public company.
              </Text>
            </div>
            <div>
              <Text className="font-medium text-zinc-900">Section 16</Text>
              <Text className="mt-1 text-sm text-zinc-600">
                SEC rule requiring insiders to report transactions within 2 business days.
              </Text>
            </div>
            <div>
              <Text className="font-medium text-zinc-900">Why It Matters</Text>
              <Text className="mt-1 text-sm text-zinc-600">
                Insider activity can signal confidence or concern about a company&apos;s prospects.
              </Text>
            </div>
          </div>
        </div>
      </div>
    </ApplicationLayout>
  )
}
