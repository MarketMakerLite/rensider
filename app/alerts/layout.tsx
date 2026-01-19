import type { Metadata } from 'next'

// Force dynamic rendering for this route segment
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ownership Alerts | Rensider',
  description: 'Find stocks with significant institutional ownership increases. Track accumulation signals from hedge funds and investment managers.',
  alternates: {
    canonical: 'https://renbot.app/alerts',
  },
  openGraph: {
    title: 'Ownership Alerts | Rensider',
    description: 'Find stocks with significant institutional ownership increases.',
    images: ['/api/og/home'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Ownership Alerts | Rensider',
    description: 'Find stocks with significant institutional ownership increases.',
    images: ['/api/og/home'],
  },
}

export default function AlertsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
