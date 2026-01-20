import type { Metadata } from 'next'
import Link from 'next/link'
import { getStockOwnership, getOwnershipHistory } from '@/actions/ownership'
import { getTickerInsiderActivity } from '@/actions/insider-sales'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading, Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Badge } from '@/components/twc/badge'
import { OwnershipChart } from '@/components/ownership/OwnershipChart'
import { SentimentGauge } from '@/components/ownership/SentimentGauge'
import { MetricsGrid } from '@/components/ownership/MetricsGrid'
import { RecentFilers } from '@/components/ownership/RecentFilers'
import { ConcentrationMetrics } from '@/components/ownership/ConcentrationMetrics'
import { ShareButton } from '@/components/ownership/ShareButton'
import { StockHoldersSection } from '@/components/ownership/StockHoldersSection'
import { InsiderActivitySection } from '@/components/insider-sales/InsiderActivitySection'
import { formatDateTime, decodeHtmlEntities } from '@/lib/format'
import { stockPageSchema, financialProductSchema } from '@/lib/seo/structured-data'

interface PageProps {
  params: Promise<{ ticker: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { ticker } = await params
  const upperTicker = ticker.toUpperCase()

  return {
    title: `${upperTicker} Institutional Ownership | Rensider`,
    description: `Track institutional holdings, 13F filings, and insider transactions for ${upperTicker}. View institutional sentiment, ownership concentration, and insider activity.`,
    alternates: {
      canonical: `https://renbot.app/stock/${upperTicker}`,
    },
    openGraph: {
      title: `${upperTicker} Institutional Ownership | Rensider`,
      description: `Track institutional holdings and 13F filings for ${upperTicker}`,
      images: [`/api/og/stock/${upperTicker}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${upperTicker} Institutional Ownership | Rensider`,
      description: `Track institutional holdings and 13F filings for ${upperTicker}`,
      images: [`/api/og/stock/${upperTicker}`],
    },
  }
}

export default async function StockOwnershipPage({ params }: PageProps) {
  const { ticker } = await params

  // Fetch all data sources in parallel
  const [data, historyData, insiderData] = await Promise.all([
    getStockOwnership({ ticker }),
    getOwnershipHistory({ ticker }),
    getTickerInsiderActivity({ ticker }),
  ])

  if (!data) {
    return (
      <ApplicationLayout>
        <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
          <Text className="font-medium text-zinc-900">No institutional ownership data for {ticker.toUpperCase()}</Text>
          <Text className="max-w-md text-sm text-zinc-500">
            This may be a small-cap stock, foreign listing, or recent IPO not yet in 13F filings.
          </Text>
          <Link href="/" className="text-blue-600 hover:underline">
            Back to Dashboard
          </Link>
        </div>
      </ApplicationLayout>
    )
  }

  // JSON-LD structured data for SEO
  const webPageSchema = stockPageSchema(ticker.toUpperCase(), data.companyName ? decodeHtmlEntities(data.companyName) : null)
  const productSchema = financialProductSchema(
    ticker.toUpperCase(),
    data.companyName ? decodeHtmlEntities(data.companyName) : null,
    {
      totalHolders: data.metrics.totalHolders,
      sentimentScore: data.sentiment.score,
      sentimentSignal: data.sentiment.signal,
    }
  )

  return (
    <ApplicationLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([webPageSchema, productSchema]) }}
      />
      <div className="max-w-7xl">
        {/* Header - mobile-first layout */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <div className="flex items-center gap-2 sm:gap-3">
              <Heading>{ticker}</Heading>
              <Badge color={getSentimentColor(data.sentiment.signal)}>
                {data.sentiment.signal}
              </Badge>
            </div>
            {data.companyName && (
              <Text className="mt-1 text-zinc-600">
                {decodeHtmlEntities(data.companyName)}
              </Text>
            )}
          </div>
          <ShareButton
            title={`${ticker} Institutional Ownership`}
            description={data.companyName ? `Track institutional holdings for ${decodeHtmlEntities(data.companyName)}` : undefined}
          />
        </div>

        {/* Metrics Grid - mobile-first: 1 → 2 → 4 columns */}
        <div className="mt-6 grid grid-cols-1 gap-4 sm:mt-8 sm:gap-6 md:grid-cols-2 lg:grid-cols-4">
          <SentimentGauge score={data.sentiment.score} signal={data.sentiment.signal} />
          <MetricsGrid metrics={data.metrics} />
          {data.putCallRatio !== null && data.putCallRatio > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white px-4 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md">
              <Text className="text-sm text-zinc-500">13F Put/Call Ratio</Text>
              <div className="mt-1 flex items-baseline justify-between">
                <div className="text-2xl font-bold tabular-nums text-zinc-900">
                  {data.putCallRatio.toFixed(2)}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`inline-flex h-2 w-2 rounded-full ${data.putCallRatio < 0.7 ? 'bg-emerald-500' : data.putCallRatio > 1.0 ? 'bg-red-500' : 'bg-amber-500'}`} />
                  <Text className="text-[11px] text-zinc-500">
                    {data.putCallRatio < 0.7 ? 'Bullish' : data.putCallRatio > 1.0 ? 'Bearish' : 'Neutral'} positioning
                  </Text>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Ownership Chart */}
        {historyData && historyData.length > 0 && (
          <div className="mt-6 sm:mt-8">
            <Subheading level={2}>Quarterly Changes</Subheading>
            <div className="mt-3 sm:mt-4">
              <OwnershipChart data={historyData} />
            </div>
          </div>
        )}

        {/* Concentration Metrics */}
        <ConcentrationMetrics metrics={data.concentrationMetrics} />

        {/* Recent Filers */}
        <RecentFilers filers={data.recentFilers} />

        {/* Holdings Section with Table/Treemap toggle */}
        <StockHoldersSection holders={data.holders} totalValue={data.metrics.totalValue} />

        {/* Insider Activity Section */}
        {insiderData && <InsiderActivitySection data={insiderData} />}

        {/* Last Updated - mobile-first spacing */}
        <div className="mt-6 border-t border-zinc-200 pt-3 sm:mt-8 sm:pt-4">
          <Text className="text-xs text-zinc-400">
            Last updated: {formatDateTime(data.lastUpdated)}
          </Text>
        </div>
      </div>
    </ApplicationLayout>
  )
}

function getSentimentColor(signal: string): 'green' | 'yellow' | 'red' {
  switch (signal) {
    case 'BULLISH':
      return 'green'
    case 'BEARISH':
      return 'red'
    default:
      return 'yellow'
  }
}
