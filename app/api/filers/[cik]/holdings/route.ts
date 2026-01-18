import { NextRequest, NextResponse } from 'next/server';
import { getFilerHoldings } from '@/lib/sec/queries';

// Revalidate every 5 minutes
export const revalidate = 300;

/**
 * GET /api/filers/[cik]/holdings
 * Get holdings for an institutional filer by CIK
 *
 * Query params:
 *   - quarter: Specific quarter to query (e.g., 2024-Q3)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cik: string }> }
) {
  try {
    const { cik } = await params;

    // Validate CIK format (numeric, 1-10 digits)
    if (!/^\d{1,10}$/.test(cik)) {
      return NextResponse.json(
        { error: 'Invalid CIK format. Expected 1-10 digit number.' },
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

    const holdings = await getFilerHoldings(cik, quarter);

    if (holdings.length === 0) {
      return NextResponse.json(
        { error: 'No holdings found for this filer' },
        { status: 404 }
      );
    }

    const totalValue = holdings.reduce((sum, h) => sum + Number(h.value || 0), 0);

    return NextResponse.json({
      cik,
      filerName: holdings[0].filingmanager_name,
      periodOfReport: holdings[0].period_of_report,
      filingDate: holdings[0].filing_date,
      totalValue,
      positionCount: holdings.length,
      holdings: holdings.map(h => ({
        cusip: h.cusip,
        ticker: h.ticker || null,
        figi: h.figi || null,
        nameOfIssuer: h.name_of_issuer,
        titleOfClass: h.title_of_class,
        value: Number(h.value),
        shares: Number(h.shares),
        sharesOrPrincipalType: h.shares_or_principal_type,
        putCall: h.put_call || null,
        investmentDiscretion: h.investment_discretion,
        percentOfPortfolio: totalValue > 0 ? (Number(h.value) / totalValue) * 100 : 0,
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching filer holdings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch holdings' },
      { status: 500 }
    );
  }
}
