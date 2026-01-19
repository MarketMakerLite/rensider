import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ cik: string }> }
) {
  const { cik } = await params

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
              fontSize: 72,
              fontWeight: 700,
              color: '#ffffff',
            }}
          >
            Fund Profile
          </div>
          <div
            style={{
              fontSize: 28,
              color: '#71717a',
              marginTop: 16,
            }}
          >
            CIK: {cik}
          </div>
          <div
            style={{
              fontSize: 36,
              color: '#a1a1aa',
              marginTop: 32,
            }}
          >
            13F Holdings & Portfolio Analysis
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
              AUM Tracking
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
              Quarterly Filings
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
