import type { Metadata } from 'next'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { HomeContent } from '@/components/home/HomeContent'

export const metadata: Metadata = {
  title: 'Rensider | Track What the Smart Money is Buying',
  description: 'See what hedge funds and institutional investors are buying and selling. Track insider trades and discover where the smart money is flowing.',
  alternates: {
    canonical: 'https://renbot.app',
  },
  openGraph: {
    title: 'Rensider | Track What the Smart Money is Buying',
    description: 'See what hedge funds and institutional investors are buying and selling. Track insider trades and discover where the smart money is flowing.',
    images: ['/api/og/home'],
    type: 'website',
  },
  twitter: {
    title: 'Rensider | Track What the Smart Money is Buying',
    description: 'See what hedge funds and institutional investors are buying and selling. Track insider trades and discover where the smart money is flowing.',
    images: ['/api/og/home'],
  },
}

export default function OwnershipDashboard() {
  return (
    <ApplicationLayout>
      <HomeContent />
    </ApplicationLayout>
  )
}
