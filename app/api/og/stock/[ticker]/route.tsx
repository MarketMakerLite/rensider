import { ImageResponse } from 'next/og'
import { getOwnershipHistoryData } from '@/lib/data/holdings'

// Use Node.js runtime to access database
export const runtime = 'nodejs'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const upperTicker = ticker.toUpperCase()

  // Fetch actual ownership history
  let historyData: { quarter: string; totalValue: number; newPositions: number; closedPositions: number }[] = []
  try {
    const data = await getOwnershipHistoryData(upperTicker, 6)
    historyData = data.slice(0, 6).reverse() // Last 6 quarters, oldest first
  } catch (e) {
    // Continue with empty data
  }

  // Calculate max value for scaling
  const maxValue = Math.max(...historyData.map(d => d.totalValue), 1)

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
          <div style={{ display: 'flex', flexDirection: 'column' }}>
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
                fontSize: 80,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.02em',
              }}
            >
              {upperTicker}
            </div>
            <div
              style={{
                fontSize: 28,
                color: '#71717a',
                marginTop: 8,
              }}
            >
              Institutional Ownership
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
              const height = Math.max((d.totalValue / maxValue) * 280, 20)
              const isPositive = d.newPositions >= d.closedPositions
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
                      backgroundColor: isPositive ? '#22c55e' : '#ef4444',
                      borderRadius: 8,
                      opacity: 0.8 + (i / historyData.length) * 0.2,
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
                  backgroundColor: '#22c55e',
                  borderRadius: 2,
                }}
              />
              <span style={{ color: '#71717a', fontSize: 16 }}>Net Buying</span>
            </div>
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
                  backgroundColor: '#ef4444',
                  borderRadius: 2,
                }}
              />
              <span style={{ color: '#71717a', fontSize: 16 }}>Net Selling</span>
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
