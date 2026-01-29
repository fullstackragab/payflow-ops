/**
 * API Route: /api/metrics
 *
 * Returns dashboard metrics. In production, this would query actual data sources.
 * For this case study, we return generated mock data.
 */

import { NextResponse } from 'next/server';
import { generateDashboardMetrics } from '@/lib/mocks/data/generators';

export async function GET() {
  const metrics = generateDashboardMetrics();

  return NextResponse.json({
    data: metrics,
    freshness: {
      timestamp: new Date().toISOString(),
      source: 'live',
      maxAgeMs: 5000,
    },
  });
}
