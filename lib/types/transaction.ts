/**
 * Transaction types for the payment operations system.
 *
 * Design notes:
 * - Status uses a discriminated union, not an enum. This allows TypeScript to
 *   narrow types in switch statements and prevents invalid status strings.
 * - Timestamps are ISO strings, not Date objects. JSON doesn't serialize Dates,
 *   and parsing happens at the boundary (display layer), not the data layer.
 * - Amount is stored in minor units (cents) as an integer. Floating point
 *   currency math causes rounding errors in production systems.
 */

export type TransactionStatus =
  | 'pending'
  | 'processing'
  | 'authorized'
  | 'captured'
  | 'settled'
  | 'failed'
  | 'refunded'
  | 'disputed';

export type TransactionType = 'payment' | 'refund' | 'chargeback' | 'payout';

export type PaymentMethod = 'card' | 'bank_transfer' | 'wallet' | 'crypto';

export type FailureReason =
  | 'insufficient_funds'
  | 'card_declined'
  | 'expired_card'
  | 'fraud_suspected'
  | 'processor_unavailable'
  | 'network_timeout'
  | 'invalid_account'
  | 'velocity_limit_exceeded';

export interface Transaction {
  id: string;
  externalId: string | null; // Processor's reference ID
  type: TransactionType;
  status: TransactionStatus;
  amount: number; // Minor units (cents)
  currency: string; // ISO 4217
  paymentMethod: PaymentMethod;
  merchantId: string;
  merchantName: string;
  customerId: string | null;
  region: string; // ISO 3166-1 alpha-2
  failureReason: FailureReason | null;
  metadata: Record<string, string>;
  createdAt: string; // ISO 8601
  updatedAt: string;
  settledAt: string | null;
}

/**
 * Lightweight transaction for list views.
 * Production rationale: Full transaction objects can be 2-5KB each.
 * A stream of 100 transactions shouldn't transfer 500KB of redundant data.
 */
export interface TransactionSummary {
  id: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  currency: string;
  merchantName: string;
  region: string;
  createdAt: string;
  failureReason: FailureReason | null;
}

/**
 * SSE event payload for realtime transaction updates.
 * Includes a sequence number for detecting gaps in the stream.
 */
export interface TransactionStreamEvent {
  sequence: number;
  transaction: TransactionSummary;
  previousStatus: TransactionStatus | null;
  timestamp: string;
}

/**
 * Valid state transitions for transactions.
 * This is the source of truth for the transaction state machine.
 * Any transition not in this map is invalid.
 */
export const TRANSACTION_TRANSITIONS: Record<TransactionStatus, TransactionStatus[]> = {
  pending: ['processing', 'failed'],
  processing: ['authorized', 'failed'],
  authorized: ['captured', 'failed', 'refunded'],
  captured: ['settled', 'refunded', 'disputed'],
  settled: ['refunded', 'disputed'],
  failed: [], // Terminal state
  refunded: [], // Terminal state
  disputed: ['settled', 'refunded'], // Can be resolved either way
};

export function canTransition(from: TransactionStatus, to: TransactionStatus): boolean {
  return TRANSACTION_TRANSITIONS[from].includes(to);
}

export function isTerminalStatus(status: TransactionStatus): boolean {
  return TRANSACTION_TRANSITIONS[status].length === 0;
}
