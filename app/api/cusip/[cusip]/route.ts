import { NextResponse } from 'next/server';
import { mapCUSIPs } from '@/lib/sec/openfigi';
import { validateCusip } from '@/lib/validators';
import { lookupSecurity } from '@/lib/sec/securities-master';

// CUSIP mappings are very stable - cache for 1 hour
export const revalidate = 3600;

/**
 * GET /api/cusip/[cusip]
 * Lookup CUSIP to get ticker, FIGI, and security information
 * Supports 6-9 character CUSIPs (issuer-only to full CUSIP with check digit)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ cusip: string }> }
) {
  try {
    const { cusip } = await params;

    // Use validator for proper validation and normalization
    const validation = validateCusip.validate(cusip);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const normalized = validation.normalized!;

    // Try securities master first for cached enriched data
    const masterRecord = await lookupSecurity(normalized);
    if (masterRecord && masterRecord.ticker) {
      return NextResponse.json({
        cusip: masterRecord.cusip,
        figi: masterRecord.figi || null,
        ticker: masterRecord.ticker || null,
        name: masterRecord.companyName || masterRecord.issuerName || null,
        exchCode: masterRecord.exchange || null,
        securityType: masterRecord.securityType || null,
        marketSector: masterRecord.marketSector || null,
        isin: masterRecord.isin || null,
        checkDigitValid: validation.checkDigitValid,
        source: 'master',
      }, {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      });
    }

    // Fall back to OpenFIGI lookup
    const [mapping] = await mapCUSIPs([normalized]);

    if (!mapping || mapping.error) {
      return NextResponse.json(
        {
          cusip: normalized,
          checkDigitValid: validation.checkDigitValid,
          error: mapping?.error || 'No mapping found',
          errorType: mapping?.errorType,
        },
        { status: 404 }
      );
    }

    // Generate ISIN for successful US mappings
    const { cusipToIsin } = await import('@/lib/validators/isin');
    const isin = normalized.length === 9 ? cusipToIsin(normalized) : undefined;

    return NextResponse.json({
      cusip: mapping.cusip,
      figi: mapping.figi || null,
      ticker: mapping.ticker || null,
      name: mapping.name || null,
      exchCode: mapping.exchCode || null,
      securityType: mapping.securityType || null,
      marketSector: mapping.marketSector || null,
      isin: isin || null,
      checkDigitValid: validation.checkDigitValid,
      cachedAt: mapping.cachedAt || null,
      source: 'openfigi',
    }, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error) {
    console.error('Error looking up CUSIP:', error);
    return NextResponse.json(
      { error: 'Failed to lookup CUSIP' },
      { status: 500 }
    );
  }
}
