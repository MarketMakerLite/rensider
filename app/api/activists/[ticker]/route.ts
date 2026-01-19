import { NextResponse } from 'next/server';
import { getBeneficialOwnership } from '@/actions/activists';

// Revalidate every 5 minutes - beneficial ownership changes infrequently
export const revalidate = 300;

/**
 * GET /api/activists/[ticker]
 * Get beneficial ownership data (13D/G filings) for a ticker
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticker: string }> }
) {
  try {
    const { ticker } = await params;

    // Validate ticker format
    if (!/^[A-Z]{1,5}$/i.test(ticker)) {
      return NextResponse.json(
        { error: 'Invalid ticker format' },
        { status: 400 }
      );
    }

    const result = await getBeneficialOwnership({ ticker });

    if (!result) {
      return NextResponse.json(
        { error: 'No beneficial ownership data found' },
        { status: 404 }
      );
    }

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching beneficial ownership:', error);
    return NextResponse.json(
      { error: 'Failed to fetch beneficial ownership data' },
      { status: 500 }
    );
  }
}
