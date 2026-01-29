/**
 * API Route: /api/payments
 * GET - List payments
 * POST - Create new payment
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayments, getPayment, setPayment, getIdempotencyRecord, setIdempotencyRecord } from '@/lib/api/stores';
import type { Payment } from '@/lib/types';

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const pageSize = parseInt(searchParams.get('pageSize') || '20', 10);
  const status = searchParams.get('status') || undefined;

  const payments = getPayments(status);
  const start = (page - 1) * pageSize;
  const paginated = payments.slice(start, start + pageSize);

  return NextResponse.json({
    ...createResponse(paginated),
    meta: {
      page,
      pageSize,
      total: payments.length,
      hasMore: start + pageSize < payments.length,
    },
  });
}

export async function POST(request: NextRequest) {
  const idempotencyKey = request.headers.get('Idempotency-Key');

  if (!idempotencyKey) {
    return NextResponse.json(
      { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Idempotency-Key header is required', retryable: false },
      { status: 400 }
    );
  }

  const body = await request.json();
  const requestHash = JSON.stringify(body);

  // Check for existing idempotency key
  const existing = getIdempotencyRecord(idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      return NextResponse.json(
        { code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency key was already used with different parameters', retryable: false },
        { status: 422 }
      );
    }
    return NextResponse.json(createResponse(existing.result));
  }

  if (!body.amount || body.amount <= 0) {
    return NextResponse.json(
      { code: 'INVALID_AMOUNT', message: 'Amount must be a positive integer', retryable: false },
      { status: 400 }
    );
  }

  const payment: Payment = {
    id: `pay_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
    idempotencyKey,
    status: 'draft',
    amount: body.amount,
    currency: body.currency || 'USD',
    intent: body.intent || 'capture',
    merchantId: body.merchantId,
    merchantName: 'Demo Merchant',
    customerId: body.customerId || null,
    description: body.description || null,
    transactionIds: [],
    failureCode: null,
    failureMessage: null,
    metadata: body.metadata || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
  };

  setPayment(payment.id, { payment, version: 1, idempotencyHash: requestHash });
  setIdempotencyRecord(idempotencyKey, { paymentId: payment.id, requestHash, result: payment });

  return NextResponse.json(createResponse(payment), { status: 201 });
}
