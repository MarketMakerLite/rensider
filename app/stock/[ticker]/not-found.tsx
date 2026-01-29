import Link from 'next/link'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'

export default function StockNotFound() {
  return (
    <ApplicationLayout>
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <Heading>Stock not found</Heading>
        <Text className="max-w-md text-sm text-zinc-500">
          No institutional ownership data found. This may be a small-cap stock, foreign listing, or recent IPO not yet in 13F filings.
        </Text>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    </ApplicationLayout>
  )
}
