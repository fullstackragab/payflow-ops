/**
 * API Route: /api/payments/[id]/transition
 * POST - Transition payment to new status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayment, setPayment, getIdempotencyRecord, setIdempotencyRecord } from '@/lib/api/stores';
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

// Simplified state machine
const VALID_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  draft: ['submitted', 'canceled'],
  submitted: ['processing', 'canceled'],
  processing: ['succeeded', 'failed', 'requires_action'],
  requires_action: ['processing', 'succeeded', 'failed', 'canceled'],
  succeeded: [],
  failed: [],
  canceled: [],
};

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
  const currentStatus = stored.payment.status;
  const targetStatus = body.targetStatus as PaymentStatus;

  // Optimistic locking
  if (body.expectedVersion !== undefined && body.expectedVersion !== stored.version) {
    return NextResponse.json(
      {
        code: 'CONCURRENT_MODIFICATION',
        message: 'Payment was modified. Please refetch and retry.',
        details: { expectedVersion: body.expectedVersion, actualVersion: stored.version },
        retryable: true,
      },
      { status: 409 }
    );
  }

  // Already in target state (idempotent)
  if (currentStatus === targetStatus) {
    return NextResponse.json(createResponse(stored.payment));
  }

  // Validate transition
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return NextResponse.json(
      {
        code: 'INVALID_TRANSITION',
        message: `Cannot transition from "${currentStatus}" to "${targetStatus}"`,
        details: { currentStatus, targetStatus, allowedTransitions: allowed },
        retryable: false,
      },
      { status: 422 }
    );
  }

  const updatedPayment = {
    ...stored.payment,
    status: targetStatus,
    updatedAt: new Date().toISOString(),
    failureCode: body.failureCode || stored.payment.failureCode,
    failureMessage: body.failureMessage || stored.payment.failureMessage,
    completedAt: ['succeeded', 'failed', 'canceled'].includes(targetStatus)
      ? new Date().toISOString()
      : stored.payment.completedAt,
  };

  setPayment(id, { ...stored, payment: updatedPayment, version: stored.version + 1 });

  // Update idempotency record if exists
  const idemRecord = getIdempotencyRecord(updatedPayment.idempotencyKey);
  if (idemRecord) {
    setIdempotencyRecord(updatedPayment.idempotencyKey, { ...idemRecord, result: updatedPayment });
  }

  return NextResponse.json({
    ...createResponse(updatedPayment),
    transition: { from: currentStatus, to: targetStatus },
  });
}
