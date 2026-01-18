import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { runForm345Sync, type Form345SyncOptions } from '@/lib/sec/form345-sync';
import { getForm345Stats } from '@/lib/sec/form345-db';
import { syncLogger } from '@/lib/logger';

// Disable caching for this endpoint
export const dynamic = 'force-dynamic';

// Extend timeout for Vercel serverless functions
export const maxDuration = 300;

/**
 * POST /api/sync/form345
 * Trigger Form 3/4/5 sync from SEC EDGAR
 *
 * Headers:
 *   Authorization: Bearer <CRON_SECRET>
 *
 * Query params:
 *   - quarter: Specific quarter to sync (e.g., 2024-Q1)
 *   - current: Sync only current quarter (default: sync current + previous)
 *   - dryRun: Preview what would be synced
 *
 * Usage with Vercel Cron:
 *   vercel.json:
 *   {
 *     "crons": [{
 *       "path": "/api/sync/form345",
 *       "schedule": "0 5 * * *"
 *     }]
 *   }
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

    const options: Form345SyncOptions = {
      quarter: searchParams.get('quarter') || undefined,
      current: searchParams.get('current') === 'true',
      dryRun: searchParams.get('dryRun') === 'true',
    };

    syncLogger.info('Form 345 sync triggered', {
      quarter: options.quarter || 'default',
      current: options.current,
      dryRun: options.dryRun,
    });

    const result = await runForm345Sync(options);

    // Invalidate caches after successful sync
    if (!options.dryRun && result.success) {
      revalidateTag('insider-sales', {});
      revalidateTag('alerts', {});
      syncLogger.info('Cache invalidated', { tags: ['insider-sales', 'alerts'] });
    }

    return NextResponse.json(result);

  } catch (error) {
    syncLogger.error('Form 345 sync failed', {}, error as Error);
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
 * GET /api/sync/form345
 * Get Form 3/4/5 database stats
 */
export async function GET() {
  try {
    const stats = await getForm345Stats();

    return NextResponse.json({
      success: true,
      stats,
    });

  } catch (error) {
    syncLogger.error('Error fetching Form 345 stats', {}, error as Error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
