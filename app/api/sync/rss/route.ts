import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { syncSchedule13FromRSS, sync13FFromRSS, syncForm345FromRSS, fetchRSSFeed, RSS_FORM_TYPES } from '@/lib/sec/rss-sync';
import { syncLogger } from '@/lib/logger';

// Disable caching for this endpoint
export const dynamic = 'force-dynamic';

// Extend timeout for Vercel serverless functions (Pro plan: up to 300s)
export const maxDuration = 300;

/**
 * POST /api/sync/rss
 * Trigger SEC RSS feed sync for near-real-time filing updates
 *
 * Headers:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Query params:
 *   - forms: Form category. Options: 13DG, 13F, 345, 3, 4, 5
 *   - count: Number of entries to fetch per form type (default: 100)
 *   - force: Re-process all entries, ignoring last sync position (default: false)
 *   - dryRun: Preview what would be synced (default: false)
 *
 * Form categories:
 *   - 13DG: Schedule 13D/13G beneficial ownership
 *   - 13F: Form 13F institutional holdings
 *   - 345: All insider trading forms (3, 4, 5)
 *   - 3, 4, 5: Individual insider trading forms
 */
export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Check for Vercel Cron header
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (!isVercelCron) {
    // Use generic error message to avoid leaking configuration details
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }

  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse form category
    const formsParam = searchParams.get('forms') || '13DG';
    // Bounds check count parameter to prevent memory exhaustion (max 1000)
    const rawCount = parseInt(searchParams.get('count') || '100', 10);
    const count = Math.max(1, Math.min(rawCount, 1000));
    const force = searchParams.get('force') === 'true';
    const dryRun = searchParams.get('dryRun') === 'true';

    // Map category to form types
    let formTypes: string[];
    switch (formsParam.toUpperCase()) {
      case '13DG':
        formTypes = RSS_FORM_TYPES.SCHEDULE_13;
        break;
      case '13F':
        formTypes = RSS_FORM_TYPES.FORM_13F;
        break;
      case '345':
      case 'FORM345':
        formTypes = [...RSS_FORM_TYPES.FORM_3, ...RSS_FORM_TYPES.FORM_4, ...RSS_FORM_TYPES.FORM_5];
        break;
      case '3':
        formTypes = RSS_FORM_TYPES.FORM_3;
        break;
      case '4':
        formTypes = RSS_FORM_TYPES.FORM_4;
        break;
      case '5':
        formTypes = RSS_FORM_TYPES.FORM_5;
        break;
      default:
        return NextResponse.json(
          { error: 'Invalid form category. Valid values: 13DG, 13F, 345, 3, 4, 5' },
          { status: 400 }
        );
    }

    syncLogger.info('Starting RSS sync', { forms: formsParam, count, force, dryRun });

    const formCategory = formsParam.toUpperCase();

    // Schedule 13D/G sync
    if (formCategory === '13DG') {
      const result = await syncSchedule13FromRSS({
        formTypes,
        count,
        force,
        dryRun,
      });

      // Invalidate caches after successful sync
      if (!dryRun) {
        revalidateTag('filings');
        revalidateTag('alerts');
        revalidateTag('activists');
        syncLogger.info('Cache invalidated', { tags: ['filings', 'alerts', 'activists'] });
      }

      syncLogger.info('RSS sync completed', { form: formsParam, result: JSON.stringify(result) });

      return NextResponse.json({
        success: true,
        form: formsParam,
        ...result,
      });
    }

    // Form 13F sync
    if (formCategory === '13F') {
      const result = await sync13FFromRSS({
        formTypes,
        count,
        force,
        dryRun,
      });

      // Invalidate caches after successful sync
      if (!dryRun) {
        revalidateTag('filings');
        revalidateTag('alerts');
        syncLogger.info('Cache invalidated', { tags: ['filings', 'alerts'] });
      }

      syncLogger.info('RSS sync completed', { form: formsParam, result: JSON.stringify(result) });

      return NextResponse.json({
        success: true,
        form: formsParam,
        ...result,
      });
    }

    // Form 3/4/5 sync
    if (['345', 'FORM345', '3', '4', '5'].includes(formCategory)) {
      const result = await syncForm345FromRSS({
        formTypes,
        count,
        force,
        dryRun,
      });

      // Invalidate caches after successful sync
      if (!dryRun) {
        revalidateTag('insider-sales');
        revalidateTag('alerts');
        syncLogger.info('Cache invalidated', { tags: ['insider-sales', 'alerts'] });
      }

      syncLogger.info('RSS sync completed', { form: formsParam, result: JSON.stringify(result) });

      return NextResponse.json({
        success: true,
        form: formsParam,
        ...result,
      });
    }

    // For other forms, just fetch and return count
    let totalEntries = 0;
    const feedResults: Record<string, number> = {};

    for (const formType of formTypes) {
      try {
        const feed = await fetchRSSFeed(formType, count);
        feedResults[formType] = feed.entries.length;
        totalEntries += feed.entries.length;
      } catch (error) {
        syncLogger.error(`Error fetching ${formType}`, {}, error as Error);
        feedResults[formType] = 0;
      }
    }

    return NextResponse.json({
      success: true,
      form: formsParam,
      message: `Sync not yet implemented for ${formsParam}`,
      entriesAvailable: totalEntries,
      feeds: feedResults,
    });

  } catch (error) {
    syncLogger.error('RSS sync failed', {}, error as Error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'RSS sync failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync/rss
 * Get RSS sync status
 */
export async function GET() {
  try {
    const { readSyncState } = await import('@/lib/sec/sync-state');
    const state = await readSyncState();

    return NextResponse.json({
      sources: {
        'rss-13dg': state['rss-sync-13dg'] || null,
        'rss-13f': state['rss-sync-13f'] || null,
        'rss-form345': state['rss-sync-form345'] || null,
      },
    });

  } catch (error) {
    syncLogger.error('Error fetching RSS sync status', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}
