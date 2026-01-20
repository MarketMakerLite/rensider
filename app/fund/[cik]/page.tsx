import type { Metadata } from 'next'
import Link from 'next/link'
import { getFundHoldings, getFilerNameByCik } from '@/actions/ownership'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading, Subheading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'
import { Table, TableHead, TableBody, TableRow, TableHeader, TableCell } from '@/components/twc/table'
import { FundAumChart } from '@/components/ownership/FundAumChart'
import { HoldingsTreemap } from '@/components/ownership/HoldingsTreemap'
import { TopHoldingsButtons } from '@/components/ownership/TopHoldingsButtons'
import { ShareButton } from '@/components/ownership/ShareButton'
import { PortfolioHoldingsTable } from '@/components/ownership/PortfolioHoldingsTable'
import { formatDateTime, formatNumber, formatCurrency, decodeHtmlEntities } from '@/lib/format'
import { fundPageSchema } from '@/lib/seo/structured-data'
import type { FundPositionChanges, Filing } from '@/types/ownership'

interface PageProps {
  params: Promise<{ cik: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cik } = await params
  const filerName = await getFilerNameByCik({ cik })
  const name = filerName || `CIK ${cik}`

  return {
    title: `${name} Holdings | Rensider`,
    description: `View portfolio holdings, AUM history, and position changes for ${name}. Track 13F filings and institutional activity.`,
    alternates: {
      canonical: `https://renbot.app/fund/${cik}`,
    },
    openGraph: {
      title: `${name} Holdings | Rensider`,
      description: `View portfolio holdings and 13F filings for ${name}`,
      images: [`/api/og/fund/${cik}`],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${name} Holdings | Rensider`,
      description: `View portfolio holdings and 13F filings for ${name}`,
      images: [`/api/og/fund/${cik}`],
    },
  }
}

export default async function FundHoldingsPage({ params }: PageProps) {
  const { cik } = await params
  const data = await getFundHoldings({ cik })

  if (!data) {
    return (
      <ApplicationLayout>
        <div className="flex h-64 flex-col items-center justify-center gap-4">
          <Text>No holdings data found for CIK {cik}</Text>
          <Link href="/" className="text-zinc-600 underline decoration-zinc-400 hover:text-zinc-900 hover:decoration-zinc-600">
            Back to Dashboard
          </Link>
        </div>
      </ApplicationLayout>
    )
  }

  const valueChange = data.previousQuarterValue
    ? ((data.totalValue - data.previousQuarterValue) / data.previousQuarterValue) * 100
    : null

  // JSON-LD structured data for SEO
  const structuredData = fundPageSchema(cik, decodeHtmlEntities(data.institutionName))

  return (
    <ApplicationLayout>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <div className="max-w-7xl">
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Heading>{decodeHtmlEntities(data.institutionName)}</Heading>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <Text className="font-mono text-sm text-zinc-500">CIK: {cik}</Text>
              <span className="text-zinc-300">·</span>
              <a
                href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F&dateb=&owner=include&count=40`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-zinc-600 transition-colors hover:text-zinc-900"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                SEC EDGAR
              </a>
            </div>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            {data.filingHistory && data.filingHistory[0] && (
              <div className="rounded-lg border border-zinc-200 bg-white p-3 shadow-sm sm:text-right">
                <Text className="text-xs font-medium text-zinc-400">Latest Filing</Text>
                <Text className="mt-0.5 font-medium text-zinc-800">{data.filingHistory[0].quarter}</Text>
                <Text className="text-xs text-zinc-500">
                  Filed {formatDateTime(data.filingHistory[0].filingDate)}
                </Text>
              </div>
            )}
            <ShareButton
              title={`${decodeHtmlEntities(data.institutionName)} Holdings`}
              description={`View portfolio holdings and AUM history for ${decodeHtmlEntities(data.institutionName)}`}
            />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <MetricCard
            label="Total AUM"
            value={formatCurrency(data.totalValue * 1000)}
            subtext="As reported (13F)"
            change={valueChange}
          />
          <MetricCard
            label="Positions"
            value={formatNumber(data.positionCount)}
            subtext="Unique securities"
          />
          {data.concentration && (
            <MetricCard
              label="Top 10 Concentration"
              value={`${data.concentration.top10Percent}%`}
              subtext="Portfolio weight"
            />
          )}
          {data.positionChanges && (
            <MetricCard
              label="Position Activity"
              value={`+${data.positionChanges.newPositions.length} / -${data.positionChanges.closedPositions.length}`}
              subtext="New / Closed this quarter"
            />
          )}
        </div>

        {/* Top Holdings */}
        <div className="mt-8">
          <Text className="text-sm font-medium text-zinc-600">Top Holdings</Text>
          <div className="mt-3">
            <TopHoldingsButtons
              holdings={data.topHoldings.slice(0, 10)}
              totalValue={data.totalValue}
            />
          </div>
        </div>

        {/* Holdings Treemap */}
        {data.holdings && data.holdings.length > 0 && (
          <div className="mt-10">
            <Subheading level={2}>Portfolio Overview</Subheading>
            <Text className="mt-1 text-sm text-zinc-500">
              Holdings sized by market value. Click to view stock details.
            </Text>
            <div className="mt-4">
              <HoldingsTreemap
                holdings={data.holdings}
                totalValue={data.totalValue}
                maxItems={25}
              />
            </div>
          </div>
        )}

        {/* Charts Row */}
        <div className="mt-10 grid gap-6 lg:grid-cols-2">
          {/* AUM History Chart */}
          {data.quarterlyHistory && data.quarterlyHistory.length > 1 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <Subheading level={3}>AUM History</Subheading>
              <div className="mt-4 h-64">
                <FundAumChart data={data.quarterlyHistory} />
              </div>
            </div>
          )}

          {/* Portfolio Composition */}
          {data.typeBreakdown && data.typeBreakdown.length > 0 && (
            <div className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm">
              <Subheading level={3}>Portfolio Composition</Subheading>
              <div className="mt-5 space-y-4">
                {data.typeBreakdown.map(tb => (
                  <div key={tb.sector}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-800">{tb.sector}</span>
                      <span className="text-sm font-medium tabular-nums text-zinc-600">{tb.percentage}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className="h-full rounded-full bg-zinc-600 transition-all duration-500"
                        style={{ width: `${tb.percentage}%` }}
                      />
                    </div>
                    <Text className="mt-1.5 text-xs text-zinc-500">
                      {formatNumber(tb.count)} positions · {formatCurrency(tb.value * 1000)}
                    </Text>
                  </div>
                ))}
              </div>

              {/* Concentration Stats */}
              {data.concentration && (
                <div className="mt-6 border-t border-zinc-100 pt-5">
                  <Text className="text-sm font-medium text-zinc-600">Concentration</Text>
                  <div className="mt-3 grid grid-cols-3 gap-4">
                    <div className="text-center">
                      <Text className="text-2xl font-semibold tabular-nums text-zinc-800">{data.concentration.top5Percent}%</Text>
                      <Text className="mt-0.5 text-xs text-zinc-500">Top 5</Text>
                    </div>
                    <div className="text-center">
                      <Text className="text-2xl font-semibold tabular-nums text-zinc-800">{data.concentration.top10Percent}%</Text>
                      <Text className="mt-0.5 text-xs text-zinc-500">Top 10</Text>
                    </div>
                    <div className="text-center">
                      <Text className="text-2xl font-semibold tabular-nums text-zinc-800">{data.concentration.top20Percent}%</Text>
                      <Text className="mt-0.5 text-xs text-zinc-500">Top 20</Text>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Position Changes Section */}
        {data.positionChanges && (
          <PositionChangesSection changes={data.positionChanges} />
        )}

        {/* Holdings Table */}
        <PortfolioHoldingsTable holdings={data.holdings} totalValue={data.totalValue} />

        {/* Filing History */}
        {data.filingHistory && data.filingHistory.length > 0 && (
          <FilingHistorySection filings={data.filingHistory} cik={cik} />
        )}

        {/* Last Updated */}
        <div className="mt-10 border-t border-zinc-200 pt-4">
          <Text className="text-xs text-zinc-400">
            Data from SEC 13F filings · Last updated: {formatDateTime(data.lastUpdated)}
          </Text>
        </div>
      </div>
    </ApplicationLayout>
  )
}

// Elegant Metric Card Component
function MetricCard({
  label,
  value,
  subtext,
  change,
}: {
  label: string
  value: string
  subtext?: string
  change?: number | null
}) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow duration-200 hover:shadow-md sm:p-5">
      <Text className="text-xs font-medium text-zinc-500">{label}</Text>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-xl font-semibold tabular-nums text-zinc-900 sm:text-2xl">{value}</span>
        {change !== undefined && change !== null && (
          <span className={`text-sm font-medium tabular-nums ${change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {change >= 0 ? '+' : ''}{change.toFixed(1)}%
          </span>
        )}
      </div>
      {subtext && <Text className="mt-1.5 text-xs text-zinc-400">{subtext}</Text>}
    </div>
  )
}

// Position Changes Section
function PositionChangesSection({ changes }: { changes: FundPositionChanges }) {
  const hasChanges = changes.newPositions.length > 0 ||
    changes.closedPositions.length > 0 ||
    changes.increasedPositions.length > 0 ||
    changes.decreasedPositions.length > 0

  if (!hasChanges) return null

  return (
    <div className="mt-10">
      <Subheading level={2}>Position Activity This Quarter</Subheading>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <PositionChangeCard
          title="New Positions"
          positions={changes.newPositions.map(p => ({
            ticker: p.ticker,
            name: decodeHtmlEntities(p.securityName),
            detail: formatCurrency(p.value * 1000),
          }))}
          accentColor="emerald"
          emptyText="No new positions"
        />
        <PositionChangeCard
          title="Closed Positions"
          positions={changes.closedPositions.map(p => ({
            ticker: p.ticker,
            name: decodeHtmlEntities(p.securityName),
            detail: `was ${formatCurrency(p.previousValue * 1000)}`,
          }))}
          accentColor="red"
          emptyText="No closed positions"
        />
        <PositionChangeCard
          title="Increased"
          positions={changes.increasedPositions.map(p => ({
            ticker: p.ticker,
            name: decodeHtmlEntities(p.securityName),
            detail: `+${p.changePercent}%`,
          }))}
          accentColor="blue"
          emptyText="No increased positions"
        />
        <PositionChangeCard
          title="Decreased"
          positions={changes.decreasedPositions.map(p => ({
            ticker: p.ticker,
            name: decodeHtmlEntities(p.securityName),
            detail: `${p.changePercent}%`,
          }))}
          accentColor="amber"
          emptyText="No decreased positions"
        />
      </div>
    </div>
  )
}

function PositionChangeCard({
  title,
  positions,
  accentColor,
  emptyText,
}: {
  title: string
  positions: Array<{ ticker: string; name: string; detail: string }>
  accentColor: 'emerald' | 'red' | 'blue' | 'amber'
  emptyText: string
}) {
  const accentClasses = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <Text className="text-sm font-medium text-zinc-700">{title}</Text>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums ${accentClasses[accentColor]}`}>
          {positions.length}
        </span>
      </div>
      {positions.length > 0 ? (
        <div className="mt-4 space-y-2.5">
          {positions.slice(0, 5).map(p => (
            <div key={p.ticker} className="flex items-center justify-between">
              <Link
                href={`/stock/${p.ticker}`}
                prefetch={false}
                className="font-medium text-zinc-800 transition-colors hover:text-zinc-600"
              >
                {p.ticker}
              </Link>
              <Text className="text-xs tabular-nums text-zinc-500">{p.detail}</Text>
            </div>
          ))}
          {positions.length > 5 && (
            <Text className="pt-1 text-xs text-zinc-400">+{positions.length - 5} more</Text>
          )}
        </div>
      ) : (
        <Text className="mt-4 text-sm text-zinc-400">{emptyText}</Text>
      )}
    </div>
  )
}

// Filing History Section
function FilingHistorySection({ filings, cik }: { filings: Filing[]; cik: string }) {
  return (
    <div className="mt-10">
      <Subheading level={2}>Filing History</Subheading>
      <div className="mt-4 overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
        <Table>
          <TableHead>
            <TableRow>
              <TableHeader>Quarter</TableHeader>
              <TableHeader>Form</TableHeader>
              <TableHeader>Filed</TableHeader>
              <TableHeader className="text-right">Holdings</TableHeader>
              <TableHeader className="text-right">AUM</TableHeader>
              <TableHeader></TableHeader>
            </TableRow>
          </TableHead>
          <TableBody>
            {filings.map((filing) => (
              <TableRow key={filing.accessionNumber}>
                <TableCell className="font-medium text-zinc-800">{filing.quarter}</TableCell>
                <TableCell>
                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs font-medium text-zinc-600">
                    {filing.formType}
                  </span>
                </TableCell>
                <TableCell className="text-zinc-500">
                  {formatDateTime(filing.filingDate)}
                </TableCell>
                <TableCell className="text-right font-mono text-zinc-700">
                  {formatNumber(filing.holdingsCount)}
                  {filing.holdingsCountChange != null && filing.holdingsCountChange !== 0 && (
                    <span className={`ml-2 text-xs ${filing.holdingsCountChange > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {filing.holdingsCountChange > 0 ? '+' : ''}{filing.holdingsCountChange}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-right font-mono text-zinc-700">
                  {filing.totalValue ? formatCurrency(filing.totalValue * 1000) : '-'}
                </TableCell>
                <TableCell>
                  <a
                    href={`https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cik}&type=13F&dateb=&owner=include&count=40`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-400 transition-colors hover:text-zinc-600"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
