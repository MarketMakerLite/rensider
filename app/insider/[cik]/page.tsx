import type { Metadata } from 'next'
import Link from 'next/link'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading, Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { getInsiderProfile } from '@/actions/insider-sales'
import { formatDate, formatLargeNumber, decodeHtmlEntities } from '@/lib/format'
import { InsiderTransactionsTable } from '@/components/insider-sales/InsiderTransactionsTable'

// Force dynamic rendering for database queries
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ cik: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cik } = await params
  const profile = await getInsiderProfile({ cik })

  const name = profile?.name || `CIK ${cik}`

  return {
    title: `${name} | Insider Profile | Rensider`,
    description: `View insider trading history for ${name}. Track their positions and transactions across public companies.`,
    alternates: {
      canonical: `https://renbot.app/insider/${cik}`,
    },
    openGraph: {
      title: `${name} | Insider Profile | Rensider`,
      description: `View insider trading history for ${name}`,
      images: ['/api/og/home'],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} | Insider Profile | Rensider`,
      description: `View insider trading history for ${name}`,
      images: ['/api/og/home'],
    },
  }
}

export default async function InsiderProfilePage({ params }: PageProps) {
  const { cik } = await params
  const profile = await getInsiderProfile({ cik })

  if (!profile) {
    return (
      <ApplicationLayout>
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <Text>No insider found with CIK {cik}</Text>
          <Link href="/insiders" className="text-blue-600 hover:underline">
            Back to Insider Sales
          </Link>
        </div>
      </ApplicationLayout>
    )
  }

  return (
    <ApplicationLayout>
      <div className="max-w-6xl">
        {/* Header */}
        <div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Heading>{decodeHtmlEntities(profile.name)}</Heading>
            <Badge color="zinc">CIK {profile.cik}</Badge>
          </div>
          <Text className="mt-1 text-zinc-600">
            Insider at {profile.stats.totalCompanies} {profile.stats.totalCompanies === 1 ? 'company' : 'companies'}
          </Text>
        </div>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:mt-8 sm:gap-6 lg:grid-cols-3">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Companies
            </Text>
            <div className="mt-2 text-xl font-semibold tabular-nums text-zinc-900 sm:text-2xl">
              {profile.stats.totalCompanies}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Transactions
            </Text>
            <div className="mt-2 text-xl font-semibold tabular-nums text-zinc-900 sm:text-2xl">
              {profile.stats.totalTransactions}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Net Shares (All Time)
            </Text>
            <div className={`mt-2 text-xl font-semibold tabular-nums sm:text-2xl ${
              profile.stats.netSharesAllTime >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {profile.stats.netSharesAllTime >= 0 ? '+' : ''}
              {formatLargeNumber(profile.stats.netSharesAllTime)}
            </div>
          </div>
        </div>

        {/* Current Positions */}
        {profile.currentPositions.length > 0 && (
          <div className="mt-8">
            <Subheading level={2}>Current Positions</Subheading>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {profile.currentPositions.map((position) => (
                <Link
                  key={position.ticker || position.issuerName}
                  href={position.ticker ? `/stock/${position.ticker}#insiders` : '#'}
                  prefetch={false}
                  className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-blue-600">
                      {position.ticker || 'N/A'}
                    </div>
                    <Badge color="zinc">{position.relationship}</Badge>
                  </div>
                  <div className="mt-1 text-sm text-zinc-600">
                    {decodeHtmlEntities(position.issuerName)}
                  </div>
                  {position.title && (
                    <div className="text-xs text-zinc-500">{position.title}</div>
                  )}
                  <div className="mt-2 text-sm font-medium text-zinc-900">
                    {formatLargeNumber(position.sharesOwned)} shares
                  </div>
                  <div className="text-xs text-zinc-400">
                    Last filed: {formatDate(position.lastFilingDate)}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <InsiderTransactionsTable
          transactions={profile.recentTransactions}
          title="Transaction History"
          showCompany={true}
          showPrice={true}
        />
      </div>
    </ApplicationLayout>
  )
}
