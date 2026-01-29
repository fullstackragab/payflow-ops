/**
 * Shared in-memory data stores for API routes.
 *
 * These stores persist across requests during the server lifecycle.
 * In production, these would be replaced with actual database calls.
 */

import type { Payment, PaymentStatus, PayoutBatch, PayoutStatus, PayoutItem, PayoutItemStatus } from '@/lib/types';

// ============================================================
// PAYMENT STORE
// ============================================================

interface StoredPayment {
  payment: Payment;
  version: number;
  idempotencyHash: string | null;
}

const paymentStore = new Map<string, StoredPayment>();
const idempotencyKeyStore = new Map<string, { paymentId: string; requestHash: string; result: Payment }>();

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

function generatePayment(overrides: Partial<Payment> = {}): Payment {
  const merchant = randomItem(MERCHANTS);
  const status: PaymentStatus = randomItem(['draft', 'submitted', 'processing', 'succeeded', 'failed']);

  return {
    id: generateId('pay'),
    idempotencyKey: `idem_${Date.now()}_${randomBetween(1000, 9999)}`,
    status,
    amount: randomBetween(1000, 5000000),
    currency: randomItem(['USD', 'EUR', 'GBP']),
    intent: randomItem(['capture', 'authorize_only']),
    merchantId: merchant.id,
    merchantName: merchant.name,
    customerId: `cust_${randomBetween(1000, 9999)}`,
    description: randomItem(['Monthly subscription', 'One-time purchase', 'Service fee']),
    transactionIds: [],
    failureCode: status === 'failed' ? 'payment_failed' : null,
    failureMessage: status === 'failed' ? 'The payment could not be processed' : null,
    metadata: {},
    createdAt: new Date(Date.now() - randomBetween(0, 604800000)).toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: status === 'succeeded' ? new Date().toISOString() : null,
    ...overrides,
  };
}

function initializePaymentStore() {
  if (paymentStore.size > 0) return;

  const statuses: PaymentStatus[] = ['draft', 'submitted', 'processing', 'requires_action', 'succeeded', 'failed', 'canceled'];

  statuses.forEach((status, i) => {
    const payment = generatePayment({
      id: `pay_seed_${i + 1}`,
      status,
      createdAt: new Date(Date.now() - (6 - i) * 86400000).toISOString(),
    });

    paymentStore.set(payment.id, {
      payment,
      version: 1,
      idempotencyHash: null,
    });
  });

  for (let i = 0; i < 10; i++) {
    const payment = generatePayment();
    paymentStore.set(payment.id, {
      payment,
      version: 1,
      idempotencyHash: null,
    });
  }
}

initializePaymentStore();

export function getPayments(status?: string): Payment[] {
  let payments = Array.from(paymentStore.values()).map((s) => s.payment);
  if (status) {
    payments = payments.filter((p) => p.status === status);
  }
  payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return payments;
}

export function getPayment(id: string): StoredPayment | undefined {
  return paymentStore.get(id);
}

export function setPayment(id: string, stored: StoredPayment): void {
  paymentStore.set(id, stored);
}

export function getIdempotencyRecord(key: string) {
  return idempotencyKeyStore.get(key);
}

export function setIdempotencyRecord(key: string, record: { paymentId: string; requestHash: string; result: Payment }) {
  idempotencyKeyStore.set(key, record);
}

// ============================================================
// PAYOUT STORE
// ============================================================

const payoutStore = new Map<string, PayoutBatch>();

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

function generatePayoutItems(count: number, merchantId: string): PayoutItem[] {
  const items: PayoutItem[] = [];
  for (let i = 0; i < count; i++) {
    const amount = randomBetween(1000, 100000);
    const fee = Math.floor(amount * 0.025);
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

function generatePayoutBatch(overrides: Partial<PayoutBatch> = {}): PayoutBatch {
  const merchant = randomItem(MERCHANTS);
  const itemCount = randomBetween(3, 15);
  const items = generatePayoutItems(itemCount, merchant.id);
  const grossAmount = items.reduce((sum, item) => sum + item.amount, 0);
  const totalFees = items.reduce((sum, item) => sum + item.fee, 0);
  const settlementDays = randomItem([1, 2, 2, 2, 3]);

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

function initializePayoutStore() {
  if (payoutStore.size > 0) return;

  // Settled batch
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

  // In transit
  const inTransit = generatePayoutBatch({
    status: 'in_transit',
    attentionLevel: 'none',
    processedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
    expectedSettlementAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
  });
  payoutStore.set(inTransit.id, inTransit);

  // Requires reconciliation
  const needsRecon = generatePayoutBatch({
    status: 'requires_reconciliation',
    attentionLevel: 'action_required',
    attentionReason: 'Bank response timeout. Verify settlement status before retry.',
    processedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  });
  payoutStore.set(needsRecon.id, needsRecon);

  // Pending batches
  for (let i = 0; i < 3; i++) {
    const pending = generatePayoutBatch({
      status: 'pending',
      createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString(),
    });
    payoutStore.set(pending.id, pending);
  }
}

initializePayoutStore();

export function getPayouts(status?: string, needsAttention?: boolean): PayoutBatch[] {
  let batches = Array.from(payoutStore.values());

  if (status) {
    batches = batches.filter((b) => b.status === status);
  }

  if (needsAttention) {
    batches = batches.filter((b) => b.attentionLevel === 'action_required' || b.attentionLevel === 'warning');
  }

  const attentionOrder: Record<string, number> = { action_required: 0, warning: 1, info: 2, none: 3 };
  batches.sort((a, b) => {
    const attentionDiff = attentionOrder[a.attentionLevel] - attentionOrder[b.attentionLevel];
    if (attentionDiff !== 0) return attentionDiff;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return batches;
}

export function getPayout(id: string): PayoutBatch | undefined {
  return payoutStore.get(id);
}

export function setPayout(id: string, batch: PayoutBatch): void {
  payoutStore.set(id, batch);
}

export function getPayoutSummary(batches: PayoutBatch[]) {
  return {
    total: batches.length,
    pending: batches.filter((b) => b.status === 'pending').length,
    inTransit: batches.filter((b) => b.status === 'in_transit').length,
    needsAttention: batches.filter((b) => b.attentionLevel === 'action_required' || b.attentionLevel === 'warning').length,
    totalPendingAmount: batches
      .filter((b) => b.status === 'pending' || b.status === 'processing' || b.status === 'in_transit')
      .reduce((sum, b) => sum + b.netAmount, 0),
  };
}

// ============================================================
// TRANSACTIONS (for SSE stream)
// ============================================================

export function generateTransactionEvent() {
  const merchant = randomItem(MERCHANTS);
  const status = randomItem(['pending', 'processing', 'authorized', 'captured', 'settled', 'failed']);

  return {
    id: generateId('txn'),
    type: randomItem(['payment', 'refund']),
    status,
    amount: randomBetween(100, 1000000),
    currency: randomItem(['USD', 'EUR', 'GBP', 'JPY']),
    merchantName: merchant.name,
    region: randomItem(['US', 'EU', 'UK', 'APAC', 'LATAM', 'MEA']),
    createdAt: new Date().toISOString(),
    failureReason: status === 'failed' ? randomItem(['insufficient_funds', 'card_declined', 'network_timeout']) : null,
  };
}
