import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { runSync, type SyncOptions } from '@/lib/sec/daily-sync';
import { syncLogger } from '@/lib/logger';

// Disable caching for this endpoint
export const dynamic = 'force-dynamic';

// Extend timeout for Vercel serverless functions (Pro plan: up to 300s)
export const maxDuration = 300;

/**
 * POST /api/sync
 * Trigger SEC filings sync
 *
 * Headers:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Query params:
 *   - forms: Comma-separated form types (default: 13F,13DG)
 *   - force: Force sync even if already run today (default: false)
 *   - dryRun: Preview what would be synced (default: false)
 *
 * Usage with Vercel Cron:
 *   vercel.json:
 *   {
 *     "crons": [{
 *       "path": "/api/sync?forms=13F,13DG",
 *       "schedule": "0 4 * * *"
 *     }]
 *   }
 */
export async function POST(request: NextRequest) {
  // Verify authorization
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Check for Vercel Cron header (automatically set by Vercel for cron jobs)
  const isVercelCron = request.headers.get('x-vercel-cron') === '1';

  if (!isVercelCron) {
    // For non-cron requests, require CRON_SECRET
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

    // Parse form types
    const formsParam = searchParams.get('forms');
    let forms: ('13F' | '13DG')[] = ['13F', '13DG'];
    if (formsParam) {
      forms = formsParam
        .split(',')
        .map(f => f.trim().toUpperCase())
        .filter((f): f is '13F' | '13DG' => f === '13F' || f === '13DG');

      if (forms.length === 0) {
        return NextResponse.json(
          { error: 'Invalid form types. Valid values: 13F, 13DG' },
          { status: 400 }
        );
      }
    }

    const options: SyncOptions = {
      forms,
      force: searchParams.get('force') === 'true',
      dryRun: searchParams.get('dryRun') === 'true',
    };

    syncLogger.info('Starting sync', { forms, force: options.force, dryRun: options.dryRun });

    const result = await runSync(options);

    // Invalidate caches after successful sync
    if (!options.dryRun) {
      if (options.forms.includes('13F')) {
        revalidateTag('filings', {});
        revalidateTag('alerts', {});
      }
      if (options.forms.includes('13DG')) {
        revalidateTag('filings', {});
        revalidateTag('alerts', {});
        revalidateTag('beneficial-ownership', {});
      }
      syncLogger.info('Cache invalidated', { tags: ['filings', 'alerts', 'beneficial-ownership'] });
    }

    syncLogger.info('Sync completed', { result: JSON.stringify(result) });

    return NextResponse.json({
      success: true,
      ...result,
    });

  } catch (error) {
    syncLogger.error('Sync failed', {}, error as Error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Sync failed',
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sync
 * Get sync status (no authentication required for status check)
 */
export async function GET() {
  try {
    const { readSyncState } = await import('@/lib/sec/sync-state');
    const state = await readSyncState();

    return NextResponse.json({
      sources: {
        '13F': state['daily-sync-13f'] || null,
        '13DG': state['daily-sync-13dg'] || null,
      },
    });

  } catch (error) {
    syncLogger.error('Error fetching status', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch sync status' },
      { status: 500 }
    );
  }
}
