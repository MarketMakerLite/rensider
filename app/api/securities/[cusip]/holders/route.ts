import { NextRequest, NextResponse } from 'next/server';
import { getSecurityHolders } from '@/lib/sec/queries';

// Revalidate every 5 minutes
export const revalidate = 300;

/**
 * GET /api/securities/[cusip]/holders
 * Get institutional holders for a security by CUSIP
 *
 * Query params:
 *   - quarter: Specific quarter to query (e.g., 2024-Q3)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cusip: string }> }
) {
  try {
    const { cusip } = await params;

    // Validate CUSIP format (9 alphanumeric characters)
    if (!/^[A-Z0-9]{9}$/i.test(cusip)) {
      return NextResponse.json(
        { error: 'Invalid CUSIP format. Expected 9 alphanumeric characters.' },
        { status: 400 }
      );
    }

    const quarter = request.nextUrl.searchParams.get('quarter') || undefined;

    // Validate quarter format if provided
    if (quarter && !/^\d{4}-Q[1-4]$/.test(quarter)) {
      return NextResponse.json(
        { error: 'Invalid quarter format. Expected YYYY-QN (e.g., 2024-Q3)' },
        { status: 400 }
      );
    }

    const holders = await getSecurityHolders(cusip.toUpperCase(), quarter);

    if (holders.length === 0) {
      return NextResponse.json(
        { error: 'No holders found for this security' },
        { status: 404 }
      );
    }

    const totalValue = holders.reduce((sum, h) => sum + Number(h.value || 0), 0);

    // Get ticker info from first holder
    const tickerInfo = holders[0]?.ticker ? {
      ticker: holders[0].ticker,
      issuerName: holders[0].issuer_name,
    } : null;

    return NextResponse.json({
      cusip: cusip.toUpperCase(),
      ticker: tickerInfo?.ticker || null,
      issuerName: tickerInfo?.issuerName || null,
      totalValue,
      holderCount: holders.length,
      holders: holders.map(h => ({
        cik: h.cik,
        filerName: h.filer_name,
        value: Number(h.value),
        shares: Number(h.shares),
        periodOfReport: h.period_of_report,
        filingDate: h.filing_date,
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching security holders:', error);
    return NextResponse.json(
      { error: 'Failed to fetch holders' },
      { status: 500 }
    );
  }
}
