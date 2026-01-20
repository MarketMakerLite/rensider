import Link from 'next/link'
import { Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { InsiderTransactionsTable } from '@/components/insider-sales/InsiderTransactionsTable'
import { formatLargeNumber, decodeHtmlEntities } from '@/lib/format'
import type { TickerInsiderActivity } from '@/types/insider-sales'

interface InsiderActivitySectionProps {
  data: TickerInsiderActivity
}

export function InsiderActivitySection({ data }: InsiderActivitySectionProps) {
  const netSentiment = data.stats.netSharesLast90Days >= 0 ? 'positive' : 'negative'

  return (
    <section id="insiders" aria-labelledby="insiders-heading" className="mt-6 scroll-mt-16 sm:mt-8">
      {/* Section Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 sm:gap-3">
          <Subheading level={2} id="insiders-heading">Insider Activity</Subheading>
          <Badge color={netSentiment === 'positive' ? 'green' : 'red'}>
            {netSentiment === 'positive' ? 'Net Buying' : 'Net Selling'}
          </Badge>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mt-4 grid grid-cols-2 gap-4 sm:mt-6 sm:gap-6 lg:grid-cols-4">
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
          <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Insiders
          </Text>
          <div className="mt-2 text-xl font-semibold tabular-nums text-zinc-900 sm:text-2xl">
            {data.stats.totalInsiders}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
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
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
          <Text className="text-xs font-medium uppercase tracking-wide text-zinc-500">
            Buys (90d)
          </Text>
          <div className="mt-2 text-xl font-semibold tabular-nums text-green-600 sm:text-2xl">
            {data.stats.totalBuysLast90Days}
          </div>
        </div>
        <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
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
        <div className="mt-6 sm:mt-8">
          <Subheading level={3}>Top Insiders</Subheading>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {data.topInsiders.slice(0, 6).map((insider) => (
              <Link
                key={insider.cik}
                href={`/insider/${insider.cik}`}
                prefetch={false}
                className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md"
              >
                <div className="font-medium text-zinc-900">{decodeHtmlEntities(insider.name)}</div>
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
        title="Recent Insider Transactions"
        showCompany={false}
        showPrice={true}
      />
    </section>
  )
}
