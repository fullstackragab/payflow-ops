/**
 * API Route: /api/metrics/regions
 *
 * Returns regional metrics breakdown.
 */

import { NextResponse } from 'next/server';
import { generateRegionalMetrics } from '@/lib/mocks/data/generators';

export async function GET() {
  const regions = generateRegionalMetrics();

  return NextResponse.json({
    data: regions,
    freshness: {
      timestamp: new Date().toISOString(),
      source: 'live',
      maxAgeMs: 5000,
    },
  });
}
