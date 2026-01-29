/**
 * API Route: /api/payouts/[id]
 * GET - Get single payout batch
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayout } from '@/lib/api/stores';

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

function getSettlementCountdown(expectedSettlementAt: string | null) {
  if (!expectedSettlementAt) {
    return { hoursRemaining: 0, isOverdue: false };
  }

  const expected = new Date(expectedSettlementAt).getTime();
  const now = Date.now();
  const diff = expected - now;
  const hoursRemaining = Math.floor(diff / (1000 * 60 * 60));

  return {
    hoursRemaining: Math.max(0, hoursRemaining),
    isOverdue: diff < 0,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const batch = getPayout(id);

  if (!batch) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: `Payout batch ${id} not found`, retryable: false },
      { status: 404 }
    );
  }

  const countdown = getSettlementCountdown(batch.expectedSettlementAt);

  return NextResponse.json({
    ...createResponse(batch),
    countdown,
  });
}
