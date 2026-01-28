/**
 * Payment types representing the payment creation and lifecycle.
 *
 * Design notes:
 * - Payment is distinct from Transaction. A Payment is an intent to collect money.
 *   A Transaction is the actual movement of money through the processor.
 * - One Payment can have multiple Transactions (e.g., auth + capture, or retry after failure).
 * - idempotencyKey prevents duplicate payments from retry logic or network issues.
 */

export type PaymentStatus =
  | 'draft' // Created but not submitted
  | 'submitted' // Sent to processor
  | 'requires_action' // 3DS, additional verification
  | 'processing' // Processor is working
  | 'succeeded' // Payment complete
  | 'failed' // Terminal failure
  | 'canceled'; // User or system canceled

export type PaymentIntent = 'capture' | 'authorize_only';

export interface PaymentRequest {
  amount: number; // Minor units
  currency: string;
  paymentMethod: {
    type: 'card';
    cardToken: string; // Tokenized card reference, never raw PAN
  } | {
    type: 'bank_transfer';
    accountId: string;
  };
  intent: PaymentIntent;
  merchantId: string;
  customerId?: string;
  description?: string;
  metadata?: Record<string, string>;
  idempotencyKey: string;
}

export interface Payment {
  id: string;
  idempotencyKey: string;
  status: PaymentStatus;
  amount: number;
  currency: string;
  intent: PaymentIntent;
  merchantId: string;
  merchantName: string;
  customerId: string | null;
  description: string | null;
  transactionIds: string[]; // Related transactions
  failureCode: string | null;
  failureMessage: string | null;
  metadata: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

/**
 * Payment state machine transitions.
 *
 * Note: 'draft' can only transition to 'submitted' via explicit user action.
 * This prevents accidental payment submission.
 */
export const PAYMENT_TRANSITIONS: Record<PaymentStatus, PaymentStatus[]> = {
  draft: ['submitted', 'canceled'],
  submitted: ['processing', 'failed'],
  processing: ['requires_action', 'succeeded', 'failed'],
  requires_action: ['processing', 'succeeded', 'failed', 'canceled'],
  succeeded: [], // Terminal
  failed: [], // Terminal
  canceled: [], // Terminal
};

export function canTransitionPayment(from: PaymentStatus, to: PaymentStatus): boolean {
  return PAYMENT_TRANSITIONS[from].includes(to);
}
