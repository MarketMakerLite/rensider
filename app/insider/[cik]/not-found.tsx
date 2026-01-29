import Link from 'next/link'
import { ApplicationLayout } from '@/components/layout/ApplicationLayout'
import { Heading } from '@/components/twc/heading'
import { Text } from '@/components/twc/text'

export default function InsiderNotFound() {
  return (
    <ApplicationLayout>
      <div className="flex h-64 flex-col items-center justify-center gap-4 text-center">
        <Heading>Insider not found</Heading>
        <Text className="max-w-md text-sm text-zinc-500">
          No insider found with this CIK. They may not have filed any Form 3, 4, or 5 reports.
        </Text>
        <Link href="/insiders" className="text-blue-600 hover:underline">
          Back to Insider Sales
        </Link>
      </div>
    </ApplicationLayout>
  )
}
