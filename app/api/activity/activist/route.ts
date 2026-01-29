import { NextRequest, NextResponse } from 'next/server';
import { getRecentActivistActivity } from '@/lib/sec/queries';

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic';

/**
 * GET /api/activity/activist
 * Get recent activist activity across all securities
 *
 * Query params:
 *   - limit: Number of results (default: 20, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const parsedLimit = parseInt(request.nextUrl.searchParams.get('limit') || '20', 10);
    const limit = Math.min(Math.max(Number.isNaN(parsedLimit) ? 20 : parsedLimit, 1), 100);

    const activity = await getRecentActivistActivity(limit);

    return NextResponse.json({
      count: activity.length,
      activity: activity.map(a => ({
        accessionNumber: a.accessionNumber,
        filingDate: a.filingDate,
        eventDate: a.eventDate || null,
        issuerName: a.issuerName,
        issuerCusip: a.issuerCusip || null,
        percentOfClass: a.percentOfClass,
        purposeOfTransaction: a.purposeOfTransaction || null,
        reportingPersonName: a.reportingPersonName,
        intentCategory: a.intentCategory || null,
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching activist activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch activist activity' },
      { status: 500 }
    );
  }
}
