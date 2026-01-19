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
          backgroundColor: '#0C0A09',
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
              fontSize: 72,
              fontWeight: 700,
              color: '#F3F1F1',
              marginBottom: 24,
              letterSpacing: '-0.02em',
            }}
          >
            Rensider
          </div>
          <div
            style={{
              fontSize: 32,
              color: '#B8B3B3',
              textAlign: 'center',
            }}
          >
            Track What the Smart Money is Buying
          </div>
          <div
            style={{
              fontSize: 22,
              color: '#6B6363',
              marginTop: 20,
              textAlign: 'center',
              maxWidth: 800,
            }}
          >
            Hedge fund holdings · Insider trades · Institutional activity
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
