/**
 * API Route: /api/payments/[id]/submit
 * POST - Submit a draft payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayment, setPayment } from '@/lib/api/stores';

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

export async function POST(
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

  if (stored.payment.status !== 'draft') {
    return NextResponse.json(
      { code: 'INVALID_TRANSITION', message: `Cannot submit: current status is "${stored.payment.status}"`, retryable: false },
      { status: 422 }
    );
  }

  const updatedPayment = {
    ...stored.payment,
    status: 'submitted' as const,
    updatedAt: new Date().toISOString(),
  };

  setPayment(id, { ...stored, payment: updatedPayment, version: stored.version + 1 });

  return NextResponse.json(createResponse(updatedPayment));
}
