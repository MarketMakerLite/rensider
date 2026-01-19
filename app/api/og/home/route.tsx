import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export async function GET() {
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
              fontSize: 64,
              fontWeight: 700,
              color: '#ffffff',
              marginBottom: 24,
            }}
          >
            <span style={{ color: '#3b82f6' }}>Ren</span>sider
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#a1a1aa',
              textAlign: 'center',
            }}
          >
            Institutional Ownership Tracker
          </div>
          <div
            style={{
              fontSize: 24,
              color: '#71717a',
              marginTop: 16,
            }}
          >
            Track 13F filings & fund holdings
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
