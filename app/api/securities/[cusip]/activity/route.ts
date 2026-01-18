import { NextRequest, NextResponse } from 'next/server';
import { getSchedule13Activity } from '@/lib/sec/queries';

// Revalidate every 5 minutes
export const revalidate = 300;

/**
 * GET /api/securities/[cusip]/activity
 * Get Schedule 13D/G activity for a security by CUSIP
 *
 * Query params:
 *   - limit: Number of results (default: 20, max: 100)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cusip: string }> }
) {
  try {
    const { cusip } = await params;

    // Validate CUSIP format
    if (!/^[A-Z0-9]{9}$/i.test(cusip)) {
      return NextResponse.json(
        { error: 'Invalid CUSIP format. Expected 9 alphanumeric characters.' },
        { status: 400 }
      );
    }

    const limit = Math.min(
      parseInt(request.nextUrl.searchParams.get('limit') || '20', 10),
      100
    );

    const activity = await getSchedule13Activity(cusip.toUpperCase(), limit);

    if (activity.length === 0) {
      return NextResponse.json(
        { error: 'No 13D/13G activity found for this security' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      cusip: cusip.toUpperCase(),
      activityCount: activity.length,
      activity: activity.map(a => ({
        accessionNumber: a.accessionNumber,
        formType: a.formType,
        filingDate: a.filingDate,
        eventDate: a.eventDate || null,
        issuerName: a.issuerName,
        percentOfClass: a.percentOfClass,
        aggregateOwned: a.aggregateOwned,
        purposeOfTransaction: a.purposeOfTransaction || null,
        reportingPersons: a.reportingPersons.map(p => ({
          name: p.name,
          cik: p.cik || null,
          percentOfClass: p.percentOfClass,
          intentFlags: p.intentFlags || [],
        })),
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching security activity:', error);
    return NextResponse.json(
      { error: 'Failed to fetch security activity' },
      { status: 500 }
    );
  }
}
