import { NextRequest, NextResponse } from 'next/server';
import { getTopFilersByAUM } from '@/lib/sec/queries';

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic';

/**
 * GET /api/filers/top
 * Get top institutional filers by AUM
 *
 * Query params:
 *   - limit: Number of results (default: 10, max: 100)
 */
export async function GET(request: NextRequest) {
  try {
    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') || '10', 10),
      100
    );

    const filers = await getTopFilersByAUM(limit);

    if (filers.length === 0) {
      return NextResponse.json({
        filers: [],
        message: 'No 13F filing data available. Data may still be loading or syncing.',
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
        },
      });
    }

    return NextResponse.json({
      filers: filers.map(f => ({
        cik: f.cik,
        name: f.filingmanager_name,
        totalAum: Number(f.total_aum),
        positionCount: Number(f.position_count),
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
      },
    });
  } catch (error) {
    console.error('Error fetching top filers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch top filers' },
      { status: 500 }
    );
  }
}
