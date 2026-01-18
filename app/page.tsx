import type { Metadata } from 'next'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { HomeContent } from '@/components/home/HomeContent'

export const metadata: Metadata = {
  title: 'Institutional Ownership Tracker | 13F Filings',
  description: 'Track institutional holdings from SEC 13F filings. Search by ticker symbol or fund CIK.',
  openGraph: {
    title: 'Institutional Ownership Tracker | 13F Filings',
    description: 'Track institutional holdings from SEC 13F filings. Search by ticker symbol or fund CIK.',
    images: ['/api/og/home'],
    type: 'website',
  },
  twitter: {
    title: 'Institutional Ownership Tracker | 13F Filings',
    description: 'Track institutional holdings from SEC 13F filings. Search by ticker symbol or fund CIK.',
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
