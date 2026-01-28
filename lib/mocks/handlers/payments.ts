/**
 * MSW handlers for payment endpoints.
 *
 * Production notes:
 *
 * 1. IDEMPOTENCY IS MANDATORY FOR WRITES
 *    Every POST/PATCH that affects money must be idempotent.
 *    The client sends an idempotency key; the server returns the same
 *    response for duplicate requests with the same key.
 *
 * 2. STATE TRANSITIONS ARE VALIDATED
 *    The server enforces the state machine. Invalid transitions return
 *    a 422 with an explanation of why the transition is blocked.
 *
 * 3. CONCURRENT UPDATES ARE DETECTED
 *    If two requests try to update the same payment, the second one
 *    fails with a 409 Conflict. The client must refetch and retry.
 *
 * 4. FAILURE SCENARIOS
 *    - Duplicate submit: Return original result (idempotent)
 *    - Timeout during processing: Client retries with same key, gets same result
 *    - Partial failure: State machine prevents inconsistent states
 */

import { http, HttpResponse, delay } from 'msw';
import { getChaosConfig } from '../chaos-config';
import { generatePayment } from '../data/generators';
import { canTransition, getTransitionBlockReason, getTransition } from '@/lib/state-machines/payment-lifecycle';
import { hashRequest, isValidIdempotencyKey } from '@/lib/utils/idempotency';
import type { Payment, PaymentStatus, PaymentRequest, ApiResponse } from '@/lib/types';

/**
 * In-memory payment store.
 *
 * Production note: This would be a database with:
 * - Serializable isolation for concurrent updates
 * - Idempotency key table with TTL
 * - Audit log of all state transitions
 */
interface StoredPayment {
  payment: Payment;
  version: number; // Optimistic locking
  idempotencyHash: string | null; // Hash of original request for conflict detection
}

let paymentStore: Map<string, StoredPayment> = new Map();
let idempotencyKeyStore: Map<string, { paymentId: string; requestHash: string; result: Payment }> = new Map();

// Initialize with some seed payments
function initializePaymentStore() {
  if (paymentStore.size > 0) return;

  const statuses: PaymentStatus[] = ['draft', 'submitted', 'processing', 'requires_action', 'succeeded', 'failed', 'canceled'];

  statuses.forEach((status, i) => {
    const payment = generatePayment({
      id: `pay_seed_${i + 1}`,
      status,
      createdAt: new Date(Date.now() - (6 - i) * 86400000).toISOString(), // Spread over last week
    });

    paymentStore.set(payment.id, {
      payment,
      version: 1,
      idempotencyHash: null,
    });
  });

  // Add a few more for variety
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

/**
 * Apply chaos configuration to a request.
 */
async function applyChaos(url: string): Promise<Response | null> {
  const chaos = getChaosConfig();

  if (chaos.latency.enabled) {
    const latencyMs =
      chaos.latency.minMs +
      Math.random() * (chaos.latency.maxMs - chaos.latency.minMs);
    await delay(latencyMs);
  }

  if (chaos.degraded.enabled) {
    const isDegraded = chaos.degraded.endpoints.some((e) => url.includes(e));
    if (isDegraded) {
      await delay(chaos.latency.maxMs * chaos.degraded.slowdownMultiplier);
    }
  }

  if (chaos.partialOutage.enabled) {
    const isOutage = chaos.partialOutage.endpoints.some((e) => url.includes(e));
    if (isOutage) {
      return HttpResponse.json(
        {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Payment service temporarily unavailable',
          retryable: true,
          retryAfterMs: 5000,
        },
        { status: 503 }
      );
    }
  }

  if (chaos.failures.enabled && Math.random() < chaos.failures.rate) {
    return HttpResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred while processing payment',
        retryable: true,
      },
      { status: 500 }
    );
  }

  return null;
}

/**
 * Create a response with freshness metadata.
 */
function createResponse<T>(data: T): ApiResponse<T> {
  return {
    data,
    freshness: {
      timestamp: new Date().toISOString(),
      source: 'live',
      maxAgeMs: 5000,
    },
  };
}

export const paymentHandlers = [
  /**
   * GET /api/payments - List payments
   */
  http.get('/api/payments', async ({ request }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
    const status = url.searchParams.get('status');

    let payments = Array.from(paymentStore.values()).map((s) => s.payment);

    // Filter by status if provided
    if (status) {
      payments = payments.filter((p) => p.status === status);
    }

    // Sort by created date descending
    payments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const start = (page - 1) * pageSize;
    const paginated = payments.slice(start, start + pageSize);

    return HttpResponse.json({
      ...createResponse(paginated),
      meta: {
        page,
        pageSize,
        total: payments.length,
        hasMore: start + pageSize < payments.length,
      },
    });
  }),

  /**
   * GET /api/payments/:id - Get single payment with full details
   */
  http.get('/api/payments/:id', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    const stored = paymentStore.get(id as string);

    if (!stored) {
      return HttpResponse.json(
        {
          code: 'NOT_FOUND',
          message: `Payment ${id} not found`,
          retryable: false,
        },
        { status: 404 }
      );
    }

    return HttpResponse.json(createResponse(stored.payment));
  }),

  /**
   * POST /api/payments - Create a new payment
   *
   * Idempotency contract:
   * - Idempotency-Key header is REQUIRED
   * - Same key + same request = return original result
   * - Same key + different request = 422 Conflict
   * - Missing key = 400 Bad Request
   */
  http.post('/api/payments', async ({ request }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    // Extract idempotency key from header
    const idempotencyKey = request.headers.get('Idempotency-Key');

    if (!idempotencyKey) {
      return HttpResponse.json(
        {
          code: 'MISSING_IDEMPOTENCY_KEY',
          message: 'Idempotency-Key header is required for payment creation',
          retryable: false,
        },
        { status: 400 }
      );
    }

    if (!isValidIdempotencyKey(idempotencyKey)) {
      return HttpResponse.json(
        {
          code: 'INVALID_IDEMPOTENCY_KEY',
          message: 'Idempotency key format is invalid. Expected format: idem_{timestamp}_{random}',
          retryable: false,
        },
        { status: 400 }
      );
    }

    const body = (await request.json()) as Omit<PaymentRequest, 'idempotencyKey'>;
    const requestHash = hashRequest(body as Record<string, unknown>);

    // Check for existing idempotency key
    const existing = idempotencyKeyStore.get(idempotencyKey);
    if (existing) {
      // Same key exists - check if request matches
      if (existing.requestHash !== requestHash) {
        return HttpResponse.json(
          {
            code: 'IDEMPOTENCY_CONFLICT',
            message: 'Idempotency key was already used with different request parameters',
            details: {
              existingPaymentId: existing.paymentId,
            },
            retryable: false,
          },
          { status: 422 }
        );
      }

      // Same key + same request = return original result
      return HttpResponse.json(createResponse(existing.result), { status: 200 });
    }

    // Validate request
    if (!body.amount || body.amount <= 0) {
      return HttpResponse.json(
        {
          code: 'INVALID_AMOUNT',
          message: 'Amount must be a positive integer in minor units',
          retryable: false,
        },
        { status: 400 }
      );
    }

    // Create new payment in draft status
    const payment: Payment = {
      id: `pay_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`,
      idempotencyKey,
      status: 'draft',
      amount: body.amount,
      currency: body.currency || 'USD',
      intent: body.intent || 'capture',
      merchantId: body.merchantId,
      merchantName: 'Demo Merchant', // Would be looked up in production
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

    // Store payment
    paymentStore.set(payment.id, {
      payment,
      version: 1,
      idempotencyHash: requestHash,
    });

    // Store idempotency record
    idempotencyKeyStore.set(idempotencyKey, {
      paymentId: payment.id,
      requestHash,
      result: payment,
    });

    return HttpResponse.json(createResponse(payment), { status: 201 });
  }),

  /**
   * POST /api/payments/:id/transition - Transition payment to new status
   *
   * This is the primary way to move payments through the lifecycle.
   * State machine validation ensures only valid transitions are allowed.
   *
   * Idempotency: Transition requests are idempotent within a short window.
   * If the payment is already in the target state, return success.
   */
  http.post('/api/payments/:id/transition', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    const stored = paymentStore.get(id as string);

    if (!stored) {
      return HttpResponse.json(
        {
          code: 'NOT_FOUND',
          message: `Payment ${id} not found`,
          retryable: false,
        },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      targetStatus: PaymentStatus;
      reason?: string;
      failureCode?: string;
      failureMessage?: string;
      expectedVersion?: number;
    };

    const currentStatus = stored.payment.status;
    const targetStatus = body.targetStatus;

    // Optimistic locking check
    if (body.expectedVersion !== undefined && body.expectedVersion !== stored.version) {
      return HttpResponse.json(
        {
          code: 'CONCURRENT_MODIFICATION',
          message: 'Payment was modified by another request. Please refetch and retry.',
          details: {
            expectedVersion: body.expectedVersion,
            actualVersion: stored.version,
          },
          retryable: true,
        },
        { status: 409 }
      );
    }

    // Idempotent: Already in target state
    if (currentStatus === targetStatus) {
      return HttpResponse.json(createResponse(stored.payment));
    }

    // Validate transition using state machine
    if (!canTransition(currentStatus, targetStatus)) {
      const blockReason = getTransitionBlockReason(currentStatus, targetStatus);
      return HttpResponse.json(
        {
          code: 'INVALID_TRANSITION',
          message: blockReason,
          details: {
            currentStatus,
            targetStatus,
          },
          retryable: false,
        },
        { status: 422 }
      );
    }

    // Get transition metadata for logging
    const transition = getTransition(currentStatus, targetStatus);

    // Apply the transition
    const updatedPayment: Payment = {
      ...stored.payment,
      status: targetStatus,
      updatedAt: new Date().toISOString(),
      failureCode: body.failureCode || stored.payment.failureCode,
      failureMessage: body.failureMessage || stored.payment.failureMessage,
      completedAt: ['succeeded', 'failed', 'canceled'].includes(targetStatus)
        ? new Date().toISOString()
        : stored.payment.completedAt,
    };

    // Update store with new version
    paymentStore.set(id as string, {
      payment: updatedPayment,
      version: stored.version + 1,
      idempotencyHash: stored.idempotencyHash,
    });

    // Update idempotency record if it exists
    const idemRecord = idempotencyKeyStore.get(updatedPayment.idempotencyKey);
    if (idemRecord) {
      idempotencyKeyStore.set(updatedPayment.idempotencyKey, {
        ...idemRecord,
        result: updatedPayment,
      });
    }

    return HttpResponse.json({
      ...createResponse(updatedPayment),
      transition: {
        from: currentStatus,
        to: targetStatus,
        action: transition?.action,
        sideEffects: transition?.sideEffects,
      },
    });
  }),

  /**
   * POST /api/payments/:id/submit - Convenience endpoint to submit a draft payment
   *
   * This is sugar for transitioning from draft to submitted.
   * In production, this would also trigger the actual processor call.
   */
  http.post('/api/payments/:id/submit', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    const stored = paymentStore.get(id as string);

    if (!stored) {
      return HttpResponse.json(
        {
          code: 'NOT_FOUND',
          message: `Payment ${id} not found`,
          retryable: false,
        },
        { status: 404 }
      );
    }

    if (stored.payment.status !== 'draft') {
      return HttpResponse.json(
        {
          code: 'INVALID_TRANSITION',
          message: `Cannot submit payment: current status is "${stored.payment.status}", expected "draft"`,
          retryable: false,
        },
        { status: 422 }
      );
    }

    // Simulate processor submission by moving through states
    // In production, this would be an async job
    const updatedPayment: Payment = {
      ...stored.payment,
      status: 'submitted',
      updatedAt: new Date().toISOString(),
    };

    paymentStore.set(id as string, {
      payment: updatedPayment,
      version: stored.version + 1,
      idempotencyHash: stored.idempotencyHash,
    });

    return HttpResponse.json(createResponse(updatedPayment));
  }),

  /**
   * POST /api/payments/:id/cancel - Cancel a payment
   *
   * Only allowed from certain states (draft, submitted, requires_action).
   */
  http.post('/api/payments/:id/cancel', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    const stored = paymentStore.get(id as string);

    if (!stored) {
      return HttpResponse.json(
        {
          code: 'NOT_FOUND',
          message: `Payment ${id} not found`,
          retryable: false,
        },
        { status: 404 }
      );
    }

    const currentStatus = stored.payment.status;

    if (!canTransition(currentStatus, 'canceled')) {
      const blockReason = getTransitionBlockReason(currentStatus, 'canceled');
      return HttpResponse.json(
        {
          code: 'INVALID_TRANSITION',
          message: blockReason,
          retryable: false,
        },
        { status: 422 }
      );
    }

    const updatedPayment: Payment = {
      ...stored.payment,
      status: 'canceled',
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };

    paymentStore.set(id as string, {
      payment: updatedPayment,
      version: stored.version + 1,
      idempotencyHash: stored.idempotencyHash,
    });

    return HttpResponse.json(createResponse(updatedPayment));
  }),

  /**
   * POST /api/payments/:id/simulate - Simulate processor response (demo only)
   *
   * This endpoint allows the demo to simulate various processor outcomes.
   * Not present in production - processor results come via webhooks.
   */
  http.post('/api/payments/:id/simulate', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    const stored = paymentStore.get(id as string);

    if (!stored) {
      return HttpResponse.json(
        {
          code: 'NOT_FOUND',
          message: `Payment ${id} not found`,
          retryable: false,
        },
        { status: 404 }
      );
    }

    const body = (await request.json()) as {
      outcome: 'succeed' | 'fail' | 'require_action';
      failureCode?: string;
      failureMessage?: string;
    };

    const currentStatus = stored.payment.status;
    let targetStatus: PaymentStatus;
    let failureCode: string | null = null;
    let failureMessage: string | null = null;

    switch (body.outcome) {
      case 'succeed':
        targetStatus = 'succeeded';
        break;
      case 'fail':
        targetStatus = 'failed';
        failureCode = body.failureCode || 'processor_declined';
        failureMessage = body.failureMessage || 'Payment was declined by the processor';
        break;
      case 'require_action':
        targetStatus = 'requires_action';
        break;
      default:
        return HttpResponse.json(
          {
            code: 'INVALID_OUTCOME',
            message: 'Outcome must be one of: succeed, fail, require_action',
            retryable: false,
          },
          { status: 400 }
        );
    }

    if (!canTransition(currentStatus, targetStatus)) {
      const blockReason = getTransitionBlockReason(currentStatus, targetStatus);
      return HttpResponse.json(
        {
          code: 'INVALID_TRANSITION',
          message: blockReason,
          retryable: false,
        },
        { status: 422 }
      );
    }

    const updatedPayment: Payment = {
      ...stored.payment,
      status: targetStatus,
      updatedAt: new Date().toISOString(),
      failureCode,
      failureMessage,
      completedAt: ['succeeded', 'failed'].includes(targetStatus)
        ? new Date().toISOString()
        : null,
    };

    paymentStore.set(id as string, {
      payment: updatedPayment,
      version: stored.version + 1,
      idempotencyHash: stored.idempotencyHash,
    });

    return HttpResponse.json(createResponse(updatedPayment));
  }),
];

/**
 * Get all payments (for testing/debugging).
 */
export function getPaymentStore(): Payment[] {
  return Array.from(paymentStore.values()).map((s) => s.payment);
}

/**
 * Reset the payment store (for testing).
 */
export function resetPaymentStore(): void {
  paymentStore.clear();
  idempotencyKeyStore.clear();
  initializePaymentStore();
}
