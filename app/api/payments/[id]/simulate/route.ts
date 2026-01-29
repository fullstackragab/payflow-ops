/**
 * API Route: /api/payments/[id]/simulate
 * POST - Simulate processor outcome (demo only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayment, setPayment } from '@/lib/api/stores';
import type { PaymentStatus } from '@/lib/types';

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

  const body = await request.json();
  let targetStatus: PaymentStatus;
  let failureCode: string | null = null;
  let failureMessage: string | null = null;

  switch (body.outcome) {
    case 'succeed':
      targetStatus = 'succeeded';
      break;
    case 'fail':
      targetStatus = 'failed';
      failureCode = body.failureCode || 'processor_declined';
      failureMessage = body.failureMessage || 'Payment was declined by the processor';
      break;
    case 'require_action':
      targetStatus = 'requires_action';
      break;
    default:
      return NextResponse.json(
        { code: 'INVALID_OUTCOME', message: 'Outcome must be: succeed, fail, or require_action', retryable: false },
        { status: 400 }
      );
  }

  const updatedPayment = {
    ...stored.payment,
    status: targetStatus,
    updatedAt: new Date().toISOString(),
    failureCode,
    failureMessage,
    completedAt: ['succeeded', 'failed'].includes(targetStatus) ? new Date().toISOString() : null,
  };

  setPayment(id, { ...stored, payment: updatedPayment, version: stored.version + 1 });

  return NextResponse.json(createResponse(updatedPayment));
}
