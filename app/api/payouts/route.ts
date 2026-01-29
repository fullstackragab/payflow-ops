/**
 * API Route: /api/payouts
 * GET - List payout batches
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayouts, getPayoutSummary } from '@/lib/api/stores';

function createResponse<T>(data: T) {
  return {
    data,
    freshness: {
      timestamp: new Date().toISOString(),
      source: 'live',
      maxAgeMs: 30000,
    },
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status') || undefined;
  const needsAttention = searchParams.get('needsAttention') === 'true';

  const batches = getPayouts(status, needsAttention);
  const summary = getPayoutSummary(batches);

  return NextResponse.json({
    ...createResponse(batches),
    summary,
  });
}
