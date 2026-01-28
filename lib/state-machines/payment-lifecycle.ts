/**
 * Payment Lifecycle State Machine.
 *
 * This is the source of truth for payment state transitions.
 * All transitions must go through this module.
 *
 * Design decisions:
 *
 * 1. EXPLICIT TRANSITION MAP
 *    Every valid transition is enumerated. If it's not in the map, it's illegal.
 *    Financial risk: Prevents accidental state corruption (e.g., refunding an uncaptured payment).
 *
 * 2. TYPED UNIONS, NOT ENUMS
 *    TypeScript can narrow types in switch statements with unions.
 *    Consistency: Exhaustiveness checking catches missing cases at compile time.
 *
 * 3. TERMINAL STATES ARE EXPLICIT
 *    Some states have no outgoing transitions. These are terminal.
 *    Operator confidence: "This payment is done" is unambiguous.
 *
 * 4. TRANSITION REASONS
 *    Each transition has a reason explaining why it's valid/invalid.
 *    Operator confidence: UI can show "Cannot refund: payment not yet captured".
 *
 * 5. SIDE EFFECTS ARE DOCUMENTED
 *    Each transition documents what external effects occur.
 *    Financial risk: Operators know what happens when they click.
 */

import type { PaymentStatus } from '@/lib/types';

/**
 * Transition definition with metadata.
 */
export interface TransitionDefinition {
  from: PaymentStatus;
  to: PaymentStatus;
  action: string; // Human-readable action name
  description: string; // What this transition means
  sideEffects: string[]; // What happens externally
  requiredFields?: string[]; // Fields needed for this transition
  isDestructive: boolean; // Does this transition have irreversible consequences
}

/**
 * All valid transitions in the payment lifecycle.
 *
 * ┌─────────┐
 * │  draft  │
 * └────┬────┘
 *      │ submit
 *      ▼
 * ┌─────────────┐
 * │  submitted  │───────────────────────┐
 * └──────┬──────┘                       │
 *        │ process                      │ fail
 *        ▼                              ▼
 * ┌─────────────┐                 ┌──────────┐
 * │  processing │────────────────▶│  failed  │ (terminal)
 * └──────┬──────┘      fail       └──────────┘
 *        │
 *        ├── authorize ──▶ requires_action ──┐
 *        │                                   │ complete
 *        │ succeed                           ▼
 *        ▼                            ┌─────────────┐
 * ┌─────────────┐                     │  succeeded  │ (terminal)
 * │  succeeded  │◀────────────────────┴─────────────┘
 * └─────────────┘
 *
 * ┌─────────────┐
 * │  canceled   │ (terminal, from draft/submitted/requires_action)
 * └─────────────┘
 */
export const PAYMENT_TRANSITIONS: TransitionDefinition[] = [
  // From draft
  {
    from: 'draft',
    to: 'submitted',
    action: 'Submit',
    description: 'Submit payment for processing',
    sideEffects: ['Payment sent to processor', 'Idempotency key consumed'],
    isDestructive: false,
  },
  {
    from: 'draft',
    to: 'canceled',
    action: 'Cancel',
    description: 'Cancel draft payment',
    sideEffects: ['None - payment was never submitted'],
    isDestructive: false,
  },

  // From submitted
  {
    from: 'submitted',
    to: 'processing',
    action: 'Process',
    description: 'Begin processing with payment processor',
    sideEffects: ['Processor begins authorization'],
    isDestructive: false,
  },
  {
    from: 'submitted',
    to: 'failed',
    action: 'Fail',
    description: 'Mark as failed before processing',
    sideEffects: ['None - no funds were held'],
    isDestructive: true,
  },
  {
    from: 'submitted',
    to: 'canceled',
    action: 'Cancel',
    description: 'Cancel submitted payment',
    sideEffects: ['None - not yet processed'],
    isDestructive: false,
  },

  // From processing
  {
    from: 'processing',
    to: 'requires_action',
    action: 'Require Action',
    description: 'Additional verification required (3DS, etc.)',
    sideEffects: ['Customer notified of required action'],
    isDestructive: false,
  },
  {
    from: 'processing',
    to: 'succeeded',
    action: 'Succeed',
    description: 'Payment authorized and captured',
    sideEffects: ['Funds captured from customer', 'Merchant balance credited'],
    isDestructive: true,
  },
  {
    from: 'processing',
    to: 'failed',
    action: 'Fail',
    description: 'Payment failed during processing',
    sideEffects: ['Authorization declined', 'No funds captured'],
    isDestructive: true,
  },

  // From requires_action
  {
    from: 'requires_action',
    to: 'processing',
    action: 'Continue',
    description: 'Customer completed required action',
    sideEffects: ['Verification result sent to processor'],
    isDestructive: false,
  },
  {
    from: 'requires_action',
    to: 'succeeded',
    action: 'Succeed',
    description: 'Payment completed after action',
    sideEffects: ['Funds captured from customer', 'Merchant balance credited'],
    isDestructive: true,
  },
  {
    from: 'requires_action',
    to: 'failed',
    action: 'Fail',
    description: 'Required action failed or timed out',
    sideEffects: ['Authorization voided', 'No funds captured'],
    isDestructive: true,
  },
  {
    from: 'requires_action',
    to: 'canceled',
    action: 'Cancel',
    description: 'Cancel payment awaiting action',
    sideEffects: ['Authorization voided if held'],
    isDestructive: false,
  },

  // Terminal states: succeeded, failed, canceled have no outgoing transitions
];

/**
 * Build a lookup map for fast transition checking.
 */
const transitionMap = new Map<string, TransitionDefinition>();
PAYMENT_TRANSITIONS.forEach((t) => {
  transitionMap.set(`${t.from}->${t.to}`, t);
});

/**
 * Get all valid transitions from a given state.
 */
export function getValidTransitions(fromStatus: PaymentStatus): TransitionDefinition[] {
  return PAYMENT_TRANSITIONS.filter((t) => t.from === fromStatus);
}

/**
 * Check if a transition is valid.
 */
export function canTransition(from: PaymentStatus, to: PaymentStatus): boolean {
  return transitionMap.has(`${from}->${to}`);
}

/**
 * Get transition definition if valid.
 */
export function getTransition(
  from: PaymentStatus,
  to: PaymentStatus
): TransitionDefinition | null {
  return transitionMap.get(`${from}->${to}`) ?? null;
}

/**
 * Get the reason why a transition is invalid.
 */
export function getTransitionBlockReason(
  from: PaymentStatus,
  to: PaymentStatus
): string {
  if (canTransition(from, to)) {
    return ''; // Not blocked
  }

  // Check if it's a terminal state
  const validFromCurrent = getValidTransitions(from);
  if (validFromCurrent.length === 0) {
    return `Payment is in terminal state "${from}" — no further transitions allowed`;
  }

  // Check if the target state is reachable at all
  const validTargets = validFromCurrent.map((t) => t.to);
  if (!validTargets.includes(to)) {
    return `Cannot transition from "${from}" to "${to}". Valid targets: ${validTargets.join(', ')}`;
  }

  return `Invalid transition from "${from}" to "${to}"`;
}

/**
 * Check if a status is terminal (no outgoing transitions).
 */
export function isTerminalStatus(status: PaymentStatus): boolean {
  return getValidTransitions(status).length === 0;
}

/**
 * Get all terminal statuses.
 */
export function getTerminalStatuses(): PaymentStatus[] {
  const allStatuses: PaymentStatus[] = [
    'draft',
    'submitted',
    'processing',
    'requires_action',
    'succeeded',
    'failed',
    'canceled',
  ];
  return allStatuses.filter(isTerminalStatus);
}

/**
 * Payment lifecycle metadata for UI.
 */
export const STATUS_METADATA: Record<
  PaymentStatus,
  {
    label: string;
    description: string;
    color: 'gray' | 'blue' | 'yellow' | 'green' | 'red';
    isTerminal: boolean;
  }
> = {
  draft: {
    label: 'Draft',
    description: 'Payment created but not submitted',
    color: 'gray',
    isTerminal: false,
  },
  submitted: {
    label: 'Submitted',
    description: 'Sent to processor, awaiting response',
    color: 'blue',
    isTerminal: false,
  },
  processing: {
    label: 'Processing',
    description: 'Processor is authorizing the payment',
    color: 'blue',
    isTerminal: false,
  },
  requires_action: {
    label: 'Requires Action',
    description: 'Customer action needed (3DS verification)',
    color: 'yellow',
    isTerminal: false,
  },
  succeeded: {
    label: 'Succeeded',
    description: 'Payment completed, funds captured',
    color: 'green',
    isTerminal: true,
  },
  failed: {
    label: 'Failed',
    description: 'Payment failed, no funds captured',
    color: 'red',
    isTerminal: true,
  },
  canceled: {
    label: 'Canceled',
    description: 'Payment canceled by user or system',
    color: 'gray',
    isTerminal: true,
  },
};
