import type { Metadata } from 'next'
import Link from 'next/link'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading, Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { getTickerInsiderActivity } from '@/actions/insider-sales'
import { formatLargeNumber, decodeHtmlEntities } from '@/lib/format'
import { InsiderTransactionsTable } from '@/components/insider-sales/InsiderTransactionsTable'

interface PageProps {
  params: Promise<{ ticker: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker } = await params
  const upperTicker = ticker.toUpperCase()

  return {
    title: `${upperTicker} Insider Trading | Rensider`,
    description: `Track insider purchases and sales for ${upperTicker}. View officer and director transactions from SEC Form 4 filings.`,
    openGraph: {
      title: `${upperTicker} Insider Trading | Rensider`,
      description: `Track insider trading activity for ${upperTicker}`,
    },
  }
}

export default async function TickerInsiderPage({ params }: PageProps) {
  const { ticker } = await params
  const data = await getTickerInsiderActivity({ ticker })

  if (!data) {
    return (
      <ApplicationLayout>
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <Text>No insider data found for {ticker.toUpperCase()}</Text>
          <Link href="/insider-sales" className="text-blue-600 hover:underline">
            Back to Insider Sales
          </Link>
        </div>
      </ApplicationLayout>
    )
  }

  const netSentiment = data.stats.netSharesLast90Days >= 0 ? 'positive' : 'negative'

  return (
    <ApplicationLayout>
      <div className="max-w-6xl">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Heading>{data.ticker}</Heading>
              <Badge color={netSentiment === 'positive' ? 'green' : 'red'}>
                {netSentiment === 'positive' ? 'Net Buying' : 'Net Selling'}
              </Badge>
            </div>
            <Text className="mt-1 text-zinc-600">
              {decodeHtmlEntities(data.issuerName)}
            </Text>
          </div>
          <Link
            href={`/stock/${data.ticker}`}
            prefetch={false}
            className="text-sm text-blue-600 hover:underline"
          >
            View Institutional Ownership &rarr;
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:mt-8 sm:gap-6 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Insiders
            </Text>
            <div className="mt-2 text-xl font-semibold tabular-nums text-zinc-900 sm:text-2xl">
              {data.stats.totalInsiders}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Net Shares (90d)
            </Text>
            <div className={`mt-2 text-xl font-semibold tabular-nums sm:text-2xl ${
              data.stats.netSharesLast90Days >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              {data.stats.netSharesLast90Days >= 0 ? '+' : ''}
              {formatLargeNumber(data.stats.netSharesLast90Days)}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Buys (90d)
            </Text>
            <div className="mt-2 text-xl font-semibold tabular-nums text-green-600 sm:text-2xl">
              {data.stats.totalBuysLast90Days}
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
              Sales (90d)
            </Text>
            <div className="mt-2 text-xl font-semibold tabular-nums text-red-600 sm:text-2xl">
              {data.stats.totalSalesLast90Days}
            </div>
          </div>
        </div>

        {/* Top Insiders */}
        {data.topInsiders.length > 0 && (
          <div className="mt-8">
            <Subheading level={2}>Top Insiders</Subheading>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.topInsiders.slice(0, 6).map((insider) => (
                <Link
                  key={insider.cik}
                  href={`/insider/${insider.cik}`}
                  prefetch={false}
                  className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="font-medium text-zinc-900">{insider.name}</div>
                  {insider.title && (
                    <div className="text-sm text-zinc-500">{insider.title}</div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <Badge color="zinc">{insider.transactionCount} txns</Badge>
                    <span className={`text-sm font-medium ${
                      insider.netShares >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {insider.netShares >= 0 ? '+' : ''}
                      {formatLargeNumber(insider.netShares)}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <InsiderTransactionsTable
          transactions={data.recentTransactions}
          title="Recent Transactions"
          showCompany={false}
          showPrice={true}
        />
      </div>
    </ApplicationLayout>
  )
}
