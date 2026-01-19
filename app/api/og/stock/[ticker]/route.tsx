import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  const { ticker } = await params
  const upperTicker = ticker.toUpperCase()

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#09090b',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: 32,
              color: '#3b82f6',
              marginBottom: 20,
            }}
          >
            Rensider
          </div>
          <div
            style={{
              fontSize: 120,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '-0.02em',
            }}
          >
            {upperTicker}
          </div>
          <div
            style={{
              fontSize: 36,
              color: '#a1a1aa',
              marginTop: 24,
            }}
          >
            Institutional Ownership Analysis
          </div>
          <div
            style={{
              display: 'flex',
              gap: 24,
              marginTop: 40,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#18181b',
                padding: '12px 24px',
                borderRadius: 8,
                color: '#71717a',
                fontSize: 18,
              }}
            >
              13F Filings
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#18181b',
                padding: '12px 24px',
                borderRadius: 8,
                color: '#71717a',
                fontSize: 18,
              }}
            >
              Fund Holdings
            </div>
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
