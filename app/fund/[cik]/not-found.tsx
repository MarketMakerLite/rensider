import Link from 'next/link'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'

export default function FundNotFound() {
  return (
    <ApplicationLayout>
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <Heading>Fund not found</Heading>
        <Text className="max-w-md text-sm text-zinc-500">
          No holdings data found for this CIK. The fund may not have filed a 13F report.
        </Text>
        <Link href="/" className="text-blue-600 hover:underline">
          Back to Dashboard
        </Link>
      </div>
    </ApplicationLayout>
  )
}
