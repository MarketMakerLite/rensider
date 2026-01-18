import { NextRequest, NextResponse } from 'next/server';
import { getPositionChanges } from '@/lib/sec/queries';

// Revalidate every 5 minutes
export const revalidate = 300;

/**
 * GET /api/filers/[cik]/changes
 * Get position changes for a filer between two quarters
 *
 * Query params:
 *   - from: Previous quarter (required, e.g., 2024-Q2)
 *   - to: Current quarter (required, e.g., 2024-Q3)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cik: string }> }
) {
  try {
    const { cik } = await params;

    // Validate CIK format
    if (!/^\d{1,10}$/.test(cik)) {
      return NextResponse.json(
        { error: 'Invalid CIK format. Expected 1-10 digit number.' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const prevQuarter = searchParams.get('from');
    const currQuarter = searchParams.get('to');

    if (!prevQuarter || !currQuarter) {
      return NextResponse.json(
        { error: 'Both "from" and "to" quarter parameters are required (e.g., ?from=2024-Q2&to=2024-Q3)' },
        { status: 400 }
      );
    }

    // Validate quarter format
    const quarterRegex = /^\d{4}-Q[1-4]$/;
    if (!quarterRegex.test(prevQuarter) || !quarterRegex.test(currQuarter)) {
      return NextResponse.json(
        { error: 'Invalid quarter format. Expected YYYY-QN (e.g., 2024-Q3)' },
        { status: 400 }
      );
    }

    const changes = await getPositionChanges(cik, [prevQuarter, currQuarter]);

    const newPositions = changes.filter(c => c.change_type === 'NEW');
    const soldPositions = changes.filter(c => c.change_type === 'SOLD');
    const increased = changes.filter(c => c.change_type === 'INCREASED');
    const decreased = changes.filter(c => c.change_type === 'DECREASED');

    return NextResponse.json({
      cik,
      fromQuarter: prevQuarter,
      toQuarter: currQuarter,
      summary: {
        newPositions: newPositions.length,
        soldPositions: soldPositions.length,
        increased: increased.length,
        decreased: decreased.length,
        unchanged: changes.filter(c => c.change_type === 'UNCHANGED').length,
      },
      changes: changes.map(c => ({
        cusip: c.cusip,
        nameOfIssuer: c.name_of_issuer,
        prevShares: c.prev_shares ? Number(c.prev_shares) : null,
        currShares: c.curr_shares ? Number(c.curr_shares) : null,
        shareChange: Number(c.share_change),
        prevValue: c.prev_value ? Number(c.prev_value) : null,
        currValue: c.curr_value ? Number(c.curr_value) : null,
        changeType: c.change_type,
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching position changes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch position changes' },
      { status: 500 }
    );
  }
}
