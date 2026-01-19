import { NextRequest, NextResponse } from 'next/server'
import type { BeneficialOwnershipAlert } from '@/types/activists'

export const dynamic = 'force-dynamic'

// In-memory alert storage (would be database in production)
// Note: This is lost on server restart - for production, use persistent storage
const alertStore: BeneficialOwnershipAlert[] = []

/**
 * Verify internal API authentication
 * Uses CRON_SECRET for internal endpoints
 */
function isAuthenticated(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  const isVercelCron = request.headers.get('x-vercel-cron') === '1'

  // Allow Vercel Cron jobs
  if (isVercelCron) return true

  // Require CRON_SECRET for other callers
  if (!cronSecret) return false
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * GET /api/activists/alerts
 * Get beneficial ownership alerts
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const acknowledged = searchParams.get('acknowledged')
    const alertType = searchParams.get('type')
    const limit = parseInt(searchParams.get('limit') || '50', 10)

    let filtered = alertStore

    // Filter by acknowledged status
    if (acknowledged === 'true') {
      filtered = filtered.filter(a => a.acknowledged)
    } else if (acknowledged === 'false') {
      filtered = filtered.filter(a => !a.acknowledged)
    }

    // Filter by alert type
    if (alertType) {
      filtered = filtered.filter(a => a.alertType === alertType)
    }

    // Sort by detection time (most recent first)
    filtered.sort((a, b) => b.detectedAt - a.detectedAt)

    return NextResponse.json({
      alerts: filtered.slice(0, limit),
      total: filtered.length,
    })
  } catch (error) {
    console.error('Error fetching alerts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch alerts' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/activists/alerts
 * Create a new alert (internal use only - requires authentication)
 */
export async function POST(request: NextRequest) {
  // Require authentication for alert creation
  if (!isAuthenticated(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const alert = await request.json() as Omit<BeneficialOwnershipAlert, 'id' | 'detectedAt' | 'acknowledged'>

    const newAlert: BeneficialOwnershipAlert = {
      ...alert,
      id: alertStore.length + 1,
      detectedAt: Date.now(),
      acknowledged: false,
    }

    alertStore.push(newAlert)

    return NextResponse.json(newAlert, { status: 201 })
  } catch (error) {
    console.error('Error creating alert:', error)
    return NextResponse.json(
      { error: 'Failed to create alert' },
      { status: 500 }
    )
  }
}
