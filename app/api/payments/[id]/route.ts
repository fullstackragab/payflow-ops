/**
 * API Route: /api/payments/[id]
 * GET - Get single payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayment } from '@/lib/api/stores';

function createResponse<T>(data: T) {
  return {
    data,
    freshness: {
      timestamp: new Date().toISOString(),
      source: 'live',
      maxAgeMs: 5000,
    },
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const stored = getPayment(id);

  if (!stored) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: `Payment ${id} not found`, retryable: false },
      { status: 404 }
    );
  }

  return NextResponse.json(createResponse(stored.payment));
}
