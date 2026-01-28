/**
 * MSW handlers for payout endpoints.
 *
 * Production notes:
 *
 * 1. SETTLEMENT TIMING IS REALISTIC
 *    Payouts use T+N settlement. A T+2 payout created Monday settles Wednesday.
 *    Bank holidays and weekends extend this. The mock simulates this behavior.
 *
 * 2. PARTIAL FAILURES HAPPEN
 *    A batch can have some items succeed and others fail. This is common when:
 *    - One merchant has invalid bank details
 *    - Daily limits are exceeded
 *    - Account is flagged for review
 *
 * 3. RECONCILIATION IS MANUAL
 *    When state is unclear (timeout, conflicting responses), the batch moves
 *    to requires_reconciliation. An operator must verify with the bank before
 *    marking it settled or failed. This prevents double-payments.
 *
 * 4. NO AUTOMATIC RETRIES
 *    Failed payouts are NOT automatically retried. The operator must:
 *    - Verify the failure reason
 *    - Confirm no funds were actually sent
 *    - Create a new batch manually
 *    This is intentionally friction-full to prevent double-payments.
 */

import { http, HttpResponse, delay } from 'msw';
import { getChaosConfig } from '../chaos-config';
import type {
  PayoutBatch,
  PayoutItem,
  PayoutStatus,
  PayoutItemStatus,
  AttentionLevel,
  ApiResponse,
} from '@/lib/types';

// In-memory store
let payoutStore: Map<string, PayoutBatch> = new Map();

// Merchant names for demo
const MERCHANTS = [
  { id: 'merch_001', name: 'TechCorp Solutions' },
  { id: 'merch_002', name: 'Global Retail Inc' },
  { id: 'merch_003', name: 'FastFood Chain LLC' },
  { id: 'merch_004', name: 'E-Commerce Giant' },
  { id: 'merch_005', name: 'SaaS Platform Co' },
];

function randomItem<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Add business days to a date (skip weekends).
 */
function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      added++;
    }
  }
  return result;
}

/**
 * Calculate time remaining until settlement.
 */
function getSettlementCountdown(expectedSettlementAt: string | null): {
  hoursRemaining: number;
  isOverdue: boolean;
} {
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

/**
 * Generate payout items for a batch.
 */
function generatePayoutItems(count: number, merchantId: string): PayoutItem[] {
  const items: PayoutItem[] = [];
  for (let i = 0; i < count; i++) {
    const amount = randomBetween(1000, 100000);
    const fee = Math.floor(amount * 0.025); // 2.5% platform fee
    items.push({
      id: generateId('item'),
      transactionId: generateId('txn'),
      status: 'pending',
      amount,
      fee,
      netAmount: amount - fee,
      merchantId,
      failureCode: null,
      failureMessage: null,
      settledAt: null,
    });
  }
  return items;
}

/**
 * Generate a payout batch with realistic data.
 */
function generatePayoutBatch(overrides: Partial<PayoutBatch> = {}): PayoutBatch {
  const merchant = randomItem(MERCHANTS);
  const itemCount = randomBetween(3, 15);
  const items = generatePayoutItems(itemCount, merchant.id);
  const grossAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const totalFees = items.reduce((sum, item) => sum + item.fee, 0);
  const settlementDays = randomItem([1, 2, 2, 2, 3]); // T+1, T+2, T+3

  const createdAt = new Date(Date.now() - randomBetween(0, 7 * 24 * 60 * 60 * 1000));
  const expectedSettlement = addBusinessDays(createdAt, settlementDays);

  return {
    id: generateId('payout'),
    status: 'pending',
    attentionLevel: 'none',
    attentionReason: null,
    merchantId: merchant.id,
    merchantName: merchant.name,
    itemCount,
    settledItemCount: 0,
    failedItemCount: 0,
    grossAmount,
    totalFees,
    netAmount: grossAmount - totalFees,
    settledAmount: 0,
    currency: 'USD',
    items,
    bankAccountLast4: `${randomBetween(1000, 9999)}`,
    settlementDays,
    createdAt: createdAt.toISOString(),
    processedAt: null,
    expectedSettlementAt: expectedSettlement.toISOString(),
    settledAt: null,
    failureReason: null,
    reconciliationNotes: null,
    lastReconciledAt: null,
    ...overrides,
  };
}

/**
 * Initialize store with seed data showing various states.
 */
function initializePayoutStore() {
  if (payoutStore.size > 0) return;

  // Settled batch (normal)
  const settled = generatePayoutBatch({
    status: 'settled',
    attentionLevel: 'none',
    processedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
    settledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  });
  settled.settledItemCount = settled.itemCount;
  settled.settledAmount = settled.netAmount;
  settled.items.forEach((item) => {
    item.status = 'settled';
    item.settledAt = settled.settledAt;
  });
  payoutStore.set(settled.id, settled);

  // In transit batch (normal, on schedule)
  const inTransit = generatePayoutBatch({
    status: 'in_transit',
    attentionLevel: 'none',
    processedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    expectedSettlementAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  });
  payoutStore.set(inTransit.id, inTransit);

  // In transit batch (overdue - should have settled)
  const overdue = generatePayoutBatch({
    status: 'in_transit',
    attentionLevel: 'warning',
    attentionReason: 'Settlement is overdue. Expected settlement was 6 hours ago.',
    processedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    expectedSettlementAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  });
  payoutStore.set(overdue.id, overdue);

  // Partially settled batch
  const partial = generatePayoutBatch({
    status: 'partially_settled',
    attentionLevel: 'warning',
    attentionReason: '3 of 8 items failed to settle. Review required.',
    processedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  });
  const failCount = 3;
  partial.failedItemCount = failCount;
  partial.settledItemCount = partial.itemCount - failCount;
  let settledAmt = 0;
  partial.items.forEach((item, i) => {
    if (i < partial.itemCount - failCount) {
      item.status = 'settled';
      item.settledAt = new Date().toISOString();
      settledAmt += item.netAmount;
    } else {
      item.status = 'failed';
      item.failureCode = randomItem(['insufficient_balance', 'invalid_account', 'daily_limit']);
      item.failureMessage = 'Transfer could not be completed';
    }
  });
  partial.settledAmount = settledAmt;
  payoutStore.set(partial.id, partial);

  // Requires reconciliation
  const needsRecon = generatePayoutBatch({
    status: 'requires_reconciliation',
    attentionLevel: 'action_required',
    attentionReason: 'Bank response timeout. Verify settlement status before retry.',
    processedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  });
  payoutStore.set(needsRecon.id, needsRecon);

  // Failed batch
  const failed = generatePayoutBatch({
    status: 'failed',
    attentionLevel: 'none',
    attentionReason: null,
    processedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    failureReason: 'Bank rejected entire batch: Invalid routing number',
  });
  failed.items.forEach((item) => {
    item.status = 'failed';
    item.failureCode = 'batch_rejected';
    item.failureMessage = 'Batch was rejected by bank';
  });
  payoutStore.set(failed.id, failed);

  // Pending batches (various ages)
  for (let i = 0; i < 3; i++) {
    const pending = generatePayoutBatch({
      status: 'pending',
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    });
    pending.expectedSettlementAt = addBusinessDays(new Date(pending.createdAt), pending.settlementDays).toISOString();
    payoutStore.set(pending.id, pending);
  }

  // Processing batch
  const processing = generatePayoutBatch({
    status: 'processing',
    processedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  });
  payoutStore.set(processing.id, processing);
}

initializePayoutStore();

/**
 * Apply chaos configuration.
 */
async function applyChaos(url: string): Promise<Response | null> {
  const chaos = getChaosConfig();

  if (chaos.latency.enabled) {
    const latencyMs =
      chaos.latency.minMs +
      Math.random() * (chaos.latency.maxMs - chaos.latency.minMs);
    await delay(latencyMs);
  }

  if (chaos.failures.enabled && Math.random() < chaos.failures.rate) {
    return HttpResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'Payout service error',
        retryable: true,
      },
      { status: 500 }
    );
  }

  return null;
}

/**
 * Create response with freshness metadata.
 */
function createResponse<T>(data: T): ApiResponse<T> {
  return {
    data,
    freshness: {
      timestamp: new Date().toISOString(),
      source: 'live',
      maxAgeMs: 30000, // Payouts can be stale longer than transactions
    },
  };
}

export const payoutHandlers = [
  /**
   * GET /api/payouts - List payout batches
   */
  http.get('*/api/payouts', async ({ request }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const needsAttention = url.searchParams.get('needsAttention') === 'true';

    let batches = Array.from(payoutStore.values());

    if (status) {
      batches = batches.filter((b) => b.status === status);
    }

    if (needsAttention) {
      batches = batches.filter(
        (b) => b.attentionLevel === 'action_required' || b.attentionLevel === 'warning'
      );
    }

    // Sort by attention level, then by created date
    batches.sort((a, b) => {
      const attentionOrder = { action_required: 0, warning: 1, info: 2, none: 3 };
      const attentionDiff = attentionOrder[a.attentionLevel] - attentionOrder[b.attentionLevel];
      if (attentionDiff !== 0) return attentionDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Calculate summary stats
    const summary = {
      total: batches.length,
      pending: batches.filter((b) => b.status === 'pending').length,
      inTransit: batches.filter((b) => b.status === 'in_transit').length,
      needsAttention: batches.filter(
        (b) => b.attentionLevel === 'action_required' || b.attentionLevel === 'warning'
      ).length,
      totalPendingAmount: batches
        .filter((b) => b.status === 'pending' || b.status === 'processing' || b.status === 'in_transit')
        .reduce((sum, b) => sum + b.netAmount, 0),
    };

    return HttpResponse.json({
      ...createResponse(batches),
      summary,
    });
  }),

  /**
   * GET /api/payouts/:id - Get single payout batch with details
   */
  http.get('*/api/payouts/:id', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    const batch = payoutStore.get(id as string);

    if (!batch) {
      return HttpResponse.json(
        {
          code: 'NOT_FOUND',
          message: `Payout batch ${id} not found`,
          retryable: false,
        },
        { status: 404 }
      );
    }

    // Calculate settlement countdown
    const countdown = getSettlementCountdown(batch.expectedSettlementAt);

    return HttpResponse.json({
      ...createResponse(batch),
      countdown,
    });
  }),

  /**
   * POST /api/payouts/:id/reconcile - Mark batch as reconciled with notes
   *
   * This is the manual reconciliation endpoint. Operators use this after
   * verifying settlement status with the bank.
   */
  http.post('*/api/payouts/:id/reconcile', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    const batch = payoutStore.get(id as string);

    if (!batch) {
      return HttpResponse.json(
        {
          code: 'NOT_FOUND',
          message: `Payout batch ${id} not found`,
          retryable: false,
        },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      resolvedStatus: PayoutStatus;
      notes: string;
      settledAmount?: number;
    };

    // Validate transition
    if (batch.status !== 'requires_reconciliation' && batch.status !== 'partially_settled') {
      return HttpResponse.json(
        {
          code: 'INVALID_STATE',
          message: `Cannot reconcile batch in "${batch.status}" status. Only "requires_reconciliation" or "partially_settled" batches can be reconciled.`,
          retryable: false,
        },
        { status: 422 }
      );
    }

    // Validate resolved status
    const validResolutions: PayoutStatus[] = ['settled', 'failed', 'returned', 'partially_settled'];
    if (!validResolutions.includes(body.resolvedStatus)) {
      return HttpResponse.json(
        {
          code: 'INVALID_STATUS',
          message: `Invalid resolved status. Must be one of: ${validResolutions.join(', ')}`,
          retryable: false,
        },
        { status: 400 }
      );
    }

    const updatedBatch: PayoutBatch = {
      ...batch,
      status: body.resolvedStatus,
      attentionLevel: 'none',
      attentionReason: null,
      reconciliationNotes: body.notes,
      lastReconciledAt: new Date().toISOString(),
      settledAt: body.resolvedStatus === 'settled' ? new Date().toISOString() : batch.settledAt,
      settledAmount: body.settledAmount ?? batch.settledAmount,
    };

    payoutStore.set(id as string, updatedBatch);

    return HttpResponse.json(createResponse(updatedBatch));
  }),

  /**
   * POST /api/payouts/:id/simulate - Simulate settlement progress (demo only)
   */
  http.post('*/api/payouts/:id/simulate', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    const batch = payoutStore.get(id as string);

    if (!batch) {
      return HttpResponse.json(
        {
          code: 'NOT_FOUND',
          message: `Payout batch ${id} not found`,
          retryable: false,
        },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      outcome: 'progress' | 'settle' | 'partial_fail' | 'fail' | 'delay' | 'need_recon';
    };

    let updatedBatch: PayoutBatch = { ...batch };

    switch (body.outcome) {
      case 'progress':
        // Move to next normal state
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
        updatedBatch.attentionReason = `${failCount} of ${batch.itemCount} items failed to settle. Review required.`;
        updatedBatch.failedItemCount = failCount;
        updatedBatch.settledItemCount = batch.itemCount - failCount;
        let settledAmt = 0;
        updatedBatch.items = updatedBatch.items.map((item, i) => {
          if (i < batch.itemCount - failCount) {
            settledAmt += item.netAmount;
            return { ...item, status: 'settled' as PayoutItemStatus, settledAt: new Date().toISOString() };
          }
          return {
            ...item,
            status: 'failed' as PayoutItemStatus,
            failureCode: 'transfer_failed',
            failureMessage: 'Receiving bank rejected transfer',
          };
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
          failureMessage: 'Batch was rejected by bank',
        }));
        break;

      case 'delay':
        updatedBatch.attentionLevel = 'warning';
        updatedBatch.attentionReason = 'Settlement is delayed. Bank processing taking longer than expected.';
        updatedBatch.expectedSettlementAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
        break;

      case 'need_recon':
        updatedBatch.status = 'requires_reconciliation';
        updatedBatch.attentionLevel = 'action_required';
        updatedBatch.attentionReason = 'Bank response unclear. Manual verification required before proceeding.';
        break;
    }

    payoutStore.set(id as string, updatedBatch);

    return HttpResponse.json(createResponse(updatedBatch));
  }),
];

export { payoutStore, generatePayoutBatch };
