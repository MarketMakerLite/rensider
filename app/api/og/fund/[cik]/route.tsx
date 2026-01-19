import { ImageResponse } from 'next/og'
import { getFundPortfolioHistory } from '@/lib/data/holdings'
import { getFilerNames } from '@/lib/sec/filer-names'

// Use Node.js runtime to access database
export const runtime = 'nodejs'

function formatValue(value: number): string {
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`
  return `$${value}`
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cik: string }> }
) {
  const { cik } = await params
  const normalizedCik = cik.replace(/^0+/, '')

  // Fetch fund name and portfolio history
  let fundName = `CIK ${normalizedCik}`
  let historyData: { quarter: string; totalValue: number; positionCount: number }[] = []

  try {
    const [filerNamesMap, history] = await Promise.all([
      getFilerNames([normalizedCik], { fetchMissing: false }),
      getFundPortfolioHistory(normalizedCik, 6),
    ])
    fundName = filerNamesMap.get(normalizedCik) || fundName
    historyData = history
  } catch (e) {
    // Continue with empty data
  }

  // Calculate max value for scaling (multiply by 1000 since values are in thousands)
  const maxValue = Math.max(...historyData.map(d => d.totalValue * 1000), 1)
  const latestValue = historyData.length > 0 ? historyData[historyData.length - 1].totalValue * 1000 : 0
  const latestPositions = historyData.length > 0 ? historyData[historyData.length - 1].positionCount : 0

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#09090b',
          fontFamily: 'system-ui, sans-serif',
          padding: 60,
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            <div
              style={{
                fontSize: 24,
                color: '#3b82f6',
                marginBottom: 8,
              }}
            >
              Rensider
            </div>
            <div
              style={{
                fontSize: 48,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                maxWidth: 900,
              }}
            >
              {fundName.length > 40 ? fundName.slice(0, 40) + '...' : fundName}
            </div>
            <div
              style={{
                display: 'flex',
                gap: 32,
                marginTop: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: '#22c55e' }}>
                  {formatValue(latestValue)}
                </span>
                <span style={{ fontSize: 18, color: '#71717a' }}>AUM</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 32, fontWeight: 700, color: '#ffffff' }}>
                  {latestPositions}
                </span>
                <span style={{ fontSize: 18, color: '#71717a' }}>positions</span>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Area */}
        <div
          style={{
            display: 'flex',
            flex: 1,
            alignItems: 'flex-end',
            gap: 16,
            marginTop: 40,
            paddingBottom: 40,
          }}
        >
          {historyData.length > 0 ? (
            historyData.map((d, i) => {
              const height = Math.max((d.totalValue * 1000 / maxValue) * 280, 20)
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    flex: 1,
                  }}
                >
                  {/* Bar */}
                  <div
                    style={{
                      width: '100%',
                      height: height,
                      backgroundColor: '#3b82f6',
                      borderRadius: 8,
                      opacity: 0.6 + (i / historyData.length) * 0.4,
                    }}
                  />
                  {/* Quarter label */}
                  <div
                    style={{
                      fontSize: 16,
                      color: '#71717a',
                      marginTop: 12,
                    }}
                  >
                    {d.quarter}
                  </div>
                </div>
              )
            })
          ) : (
            // Placeholder bars when no data
            [1, 2, 3, 4, 5, 6].map((_, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: 60 + Math.random() * 180,
                    backgroundColor: '#27272a',
                    borderRadius: 8,
                  }}
                />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: 24 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: '#3b82f6',
                  borderRadius: 2,
                }}
              />
              <span style={{ color: '#71717a', fontSize: 16 }}>Portfolio Value</span>
            </div>
          </div>
          <div style={{ color: '#52525b', fontSize: 14 }}>
            13F Quarterly Filings
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  )
}
