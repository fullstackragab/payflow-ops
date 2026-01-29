/**
 * API Route: /api/payouts/[id]/reconcile
 * POST - Mark batch as reconciled
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayout, setPayout } from '@/lib/api/stores';
import type { PayoutStatus } from '@/lib/types';

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

export async function POST(
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

  if (batch.status !== 'requires_reconciliation' && batch.status !== 'partially_settled') {
    return NextResponse.json(
      {
        code: 'INVALID_STATE',
        message: `Cannot reconcile batch in "${batch.status}" status`,
        retryable: false,
      },
      { status: 422 }
    );
  }

  const body = await request.json();
  const validResolutions: PayoutStatus[] = ['settled', 'failed', 'returned', 'partially_settled'];

  if (!validResolutions.includes(body.resolvedStatus)) {
    return NextResponse.json(
      {
        code: 'INVALID_STATUS',
        message: `Invalid resolved status. Must be one of: ${validResolutions.join(', ')}`,
        retryable: false,
      },
      { status: 400 }
    );
  }

  const updatedBatch = {
    ...batch,
    status: body.resolvedStatus as PayoutStatus,
    attentionLevel: 'none' as const,
    attentionReason: null,
    reconciliationNotes: body.notes,
    lastReconciledAt: new Date().toISOString(),
    settledAt: body.resolvedStatus === 'settled' ? new Date().toISOString() : batch.settledAt,
    settledAmount: body.settledAmount ?? batch.settledAmount,
  };

  setPayout(id, updatedBatch);

  return NextResponse.json(createResponse(updatedBatch));
}
