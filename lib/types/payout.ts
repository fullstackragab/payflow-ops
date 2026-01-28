/**
 * Payout types for merchant settlement and batch processing.
 *
 * Design notes:
 *
 * 1. WHY PAYOUTS ARE BATCHED
 *    Individual settlements would overwhelm banking systems and incur
 *    per-transaction fees. Batching is an efficiency requirement, not a choice.
 *
 * 2. WHY SETTLEMENT IS DELAYED (T+N)
 *    - Fraud review window: Chargebacks can be filed within hours/days
 *    - Bank processing time: ACH takes 1-3 business days
 *    - Regulatory holds: Some jurisdictions require holding periods
 *    The delay protects the platform and merchants from fraud losses.
 *
 * 3. WHY EXPECTED DATES ARE ESTIMATES
 *    - Bank holidays aren't always predictable
 *    - Receiving banks can delay for their own reasons
 *    - Network congestion causes variable timing
 *    The UI must communicate this uncertainty clearly.
 *
 * 4. WHY RETRIES ARE DANGEROUS
 *    A failed payout might have partially succeeded at the bank level.
 *    Blind retry could result in double-payment to the merchant.
 *    Reconciliation (manual or automated) must confirm state before retry.
 */

/**
 * Batch-level status.
 * Represents the overall state of the payout batch.
 */
export type PayoutStatus =
  | 'pending' // Batch created, waiting for processing window
  | 'processing' // Submitted to banking partner
  | 'in_transit' // Confirmed by bank, funds moving
  | 'settled' // All items confirmed settled
  | 'partially_settled' // Some items settled, some failed
  | 'failed' // Entire batch failed
  | 'returned' // Funds returned after settlement (bounced)
  | 'requires_reconciliation'; // State unclear, manual review needed

/**
 * Item-level status.
 * Individual items within a batch can have different outcomes.
 */
export type PayoutItemStatus =
  | 'pending' // Included in batch, not yet processed
  | 'settled' // Successfully delivered
  | 'failed' // Failed to deliver
  | 'returned'; // Delivered then returned

/**
 * Attention level for operators.
 * Determines what action (if any) is needed.
 */
export type AttentionLevel =
  | 'none' // No action required, normal operation
  | 'info' // FYI, something changed
  | 'warning' // May need attention soon
  | 'action_required'; // Manual intervention needed

export interface PayoutItem {
  id: string;
  transactionId: string;
  status: PayoutItemStatus;
  amount: number;
  fee: number; // Platform fee deducted
  netAmount: number;
  merchantId: string;
  failureCode: string | null;
  failureMessage: string | null;
  settledAt: string | null;
}

export interface PayoutBatch {
  id: string;
  status: PayoutStatus;
  attentionLevel: AttentionLevel;
  attentionReason: string | null;
  merchantId: string;
  merchantName: string;
  itemCount: number;
  settledItemCount: number;
  failedItemCount: number;
  grossAmount: number; // Sum of all item amounts
  totalFees: number;
  netAmount: number; // grossAmount - totalFees
  settledAmount: number; // Amount actually settled
  currency: string;
  items: PayoutItem[];
  bankAccountLast4: string; // Masked account number
  settlementDays: number; // T+N configuration
  createdAt: string;
  processedAt: string | null; // When submitted to bank
  expectedSettlementAt: string | null; // Estimate based on T+N
  settledAt: string | null; // When fully settled
  failureReason: string | null;
  reconciliationNotes: string | null; // Manual notes from operators
  lastReconciledAt: string | null;
}

/**
 * Settlement schedule configuration.
 * Different merchants may have different settlement terms.
 */
export interface SettlementSchedule {
  merchantId: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  delayDays: number; // T+N settlement
  minimumAmount: number; // Don't settle below this threshold
  cutoffTime: string; // HH:MM UTC
}

/**
 * Payout state transitions.
 *
 * Key constraints:
 * - settled is terminal and positive
 * - failed and returned are terminal and negative
 * - requires_reconciliation can transition to any terminal state
 *   after manual review
 * - partially_settled can become settled (remaining items succeed)
 *   or requires_reconciliation (need manual review)
 */
export const PAYOUT_TRANSITIONS: Record<PayoutStatus, PayoutStatus[]> = {
  pending: ['processing', 'failed'],
  processing: ['in_transit', 'failed', 'requires_reconciliation'],
  in_transit: ['settled', 'partially_settled', 'failed', 'returned', 'requires_reconciliation'],
  settled: [], // Terminal - success
  partially_settled: ['settled', 'requires_reconciliation'],
  failed: [], // Terminal - can create new batch manually
  returned: [], // Terminal - funds bounced back
  requires_reconciliation: ['settled', 'partially_settled', 'failed', 'returned'], // After manual review
};

/**
 * Check if a batch status transition is valid.
 */
export function canTransitionPayout(from: PayoutStatus, to: PayoutStatus): boolean {
  return PAYOUT_TRANSITIONS[from].includes(to);
}

/**
 * Check if a batch requires operator attention.
 */
export function requiresAttention(batch: PayoutBatch): boolean {
  return batch.attentionLevel === 'action_required' || batch.attentionLevel === 'warning';
}

/**
 * Check if a batch is in a terminal state.
 */
export function isTerminalPayoutStatus(status: PayoutStatus): boolean {
  return PAYOUT_TRANSITIONS[status].length === 0;
}
