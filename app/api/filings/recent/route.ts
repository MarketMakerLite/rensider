import { NextRequest, NextResponse } from 'next/server';
import { getRecentFilings } from '@/lib/sec/queries';

// Force dynamic rendering since we use searchParams
export const dynamic = 'force-dynamic';

/**
 * GET /api/filings/recent
 * Get recent SEC filings
 *
 * Query params:
 *   - limit: Number of results (default: 50, max: 100)
 *   - forms: Comma-separated form types (default: 13F,13D,13G)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100);
    const formTypesParam = searchParams.get('forms');

    // Parse and validate form types filter
    let formTypes: ('13F' | '13D' | '13G')[] = ['13F', '13D', '13G'];
    if (formTypesParam) {
      formTypes = formTypesParam
        .split(',')
        .map(f => f.trim().toUpperCase())
        .filter((f): f is '13F' | '13D' | '13G' =>
          f === '13F' || f === '13D' || f === '13G'
        );

      if (formTypes.length === 0) {
        return NextResponse.json(
          { error: 'Invalid form types. Valid values: 13F, 13D, 13G' },
          { status: 400 }
        );
      }
    }

    const filings = await getRecentFilings(formTypes, limit);

    return NextResponse.json({
      count: filings.length,
      filings: filings.map(f => ({
        accessionNumber: f.accessionNumber,
        formType: f.formType,
        filingDate: f.filingDate,
        filerName: f.filerName,
        filerCik: f.filerCik || null,
        issuerName: f.issuerName || null,
        issuerCusip: f.issuerCusip || null,
      })),
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error fetching recent filings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch recent filings' },
      { status: 500 }
    );
  }
}
