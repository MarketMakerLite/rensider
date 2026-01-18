import { NextRequest, NextResponse } from 'next/server';
import { getActivistActivity } from '@/actions/beneficial-ownership';

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic';

/**
 * GET /api/beneficial-ownership/activist-activity
 * Get recent activist activity across all tickers
 *
 * Query params:
 *   - limit: Number of results (default: 20, max: 100)
 *   - days: Number of days to look back (default: 30, max: 180)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 100);
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 180);

    const activities = await getActivistActivity({ days, limit });

    return NextResponse.json({
      activities,
      count: activities.length,
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
