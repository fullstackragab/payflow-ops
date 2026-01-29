/**
 * API Route: /api/payouts/[id]/simulate
 * POST - Simulate settlement progress (demo only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPayout, setPayout } from '@/lib/api/stores';
import type { PayoutBatch, PayoutItemStatus } from '@/lib/types';

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

  const body = await request.json();
  let updatedBatch: PayoutBatch = { ...batch };

  switch (body.outcome) {
    case 'progress':
      if (batch.status === 'pending') {
        updatedBatch.status = 'processing';
        updatedBatch.processedAt = new Date().toISOString();
      } else if (batch.status === 'processing') {
        updatedBatch.status = 'in_transit';
      }
      break;

    case 'settle':
      updatedBatch.status = 'settled';
      updatedBatch.settledAt = new Date().toISOString();
      updatedBatch.settledItemCount = updatedBatch.itemCount;
      updatedBatch.settledAmount = updatedBatch.netAmount;
      updatedBatch.items = updatedBatch.items.map((item) => ({
        ...item,
        status: 'settled' as PayoutItemStatus,
        settledAt: new Date().toISOString(),
      }));
      break;

    case 'partial_fail':
      const failCount = Math.min(3, Math.floor(batch.itemCount / 3));
      updatedBatch.status = 'partially_settled';
      updatedBatch.attentionLevel = 'warning';
      updatedBatch.attentionReason = `${failCount} of ${batch.itemCount} items failed to settle.`;
      updatedBatch.failedItemCount = failCount;
      updatedBatch.settledItemCount = batch.itemCount - failCount;
      let settledAmt = 0;
      updatedBatch.items = updatedBatch.items.map((item, i) => {
        if (i < batch.itemCount - failCount) {
          settledAmt += item.netAmount;
          return { ...item, status: 'settled' as PayoutItemStatus, settledAt: new Date().toISOString() };
        }
        return { ...item, status: 'failed' as PayoutItemStatus, failureCode: 'transfer_failed' };
      });
      updatedBatch.settledAmount = settledAmt;
      break;

    case 'fail':
      updatedBatch.status = 'failed';
      updatedBatch.failureReason = 'Bank rejected batch: Account validation failed';
      updatedBatch.items = updatedBatch.items.map((item) => ({
        ...item,
        status: 'failed' as PayoutItemStatus,
        failureCode: 'batch_rejected',
      }));
      break;

    case 'need_recon':
      updatedBatch.status = 'requires_reconciliation';
      updatedBatch.attentionLevel = 'action_required';
      updatedBatch.attentionReason = 'Bank response unclear. Manual verification required.';
      break;

    default:
      return NextResponse.json(
        { code: 'INVALID_OUTCOME', message: 'Invalid outcome', retryable: false },
        { status: 400 }
      );
  }

  setPayout(id, updatedBatch);

  return NextResponse.json(createResponse(updatedBatch));
}
