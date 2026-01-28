/**
 * MSW handlers for transaction endpoints.
 *
 * Production note:
 * These handlers simulate a real API. In production, these endpoints would
 * live behind an API gateway or BFF layer, not inside Next.js.
 * The handlers here demonstrate realistic response shapes and timing.
 */

import { http, HttpResponse, delay } from 'msw';
import { getChaosConfig } from '../chaos-config';
import {
  generateTransactionBatch,
  generateTransaction,
  generateTransactionSummary,
} from '../data/generators';
import type { ApiResponse, TransactionSummary, Transaction } from '@/lib/types';

// In-memory store for transactions
let transactionStore: TransactionSummary[] = generateTransactionBatch(50);

/**
 * Apply chaos configuration to a request.
 * Returns early with an error response if chaos dictates failure.
 */
async function applyChaos(url: string): Promise<Response | null> {
  const chaos = getChaosConfig();

  // Apply latency
  if (chaos.latency.enabled) {
    const latencyMs =
      chaos.latency.minMs +
      Math.random() * (chaos.latency.maxMs - chaos.latency.minMs);
    await delay(latencyMs);
  }

  // Check for degraded endpoints (extra latency)
  if (chaos.degraded.enabled) {
    const isDegraded = chaos.degraded.endpoints.some((e) => url.includes(e));
    if (isDegraded) {
      await delay(chaos.latency.maxMs * chaos.degraded.slowdownMultiplier);
    }
  }

  // Check for partial outage
  if (chaos.partialOutage.enabled) {
    const isOutage = chaos.partialOutage.endpoints.some((e) => url.includes(e));
    if (isOutage) {
      return HttpResponse.json(
        {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Service temporarily unavailable',
          retryable: true,
          retryAfterMs: 5000,
        },
        { status: 503 }
      );
    }
  }

  // Random failure injection
  if (chaos.failures.enabled && Math.random() < chaos.failures.rate) {
    return HttpResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
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
function createResponse<T>(data: T, isStale = false): ApiResponse<T> {
  const chaos = getChaosConfig();
  const staleAge = chaos.staleData.enabled ? chaos.staleData.staleAgeMs : 0;

  return {
    data,
    freshness: {
      timestamp: new Date(Date.now() - staleAge).toISOString(),
      source: isStale || chaos.staleData.enabled ? 'cache' : 'live',
      maxAgeMs: 5000,
    },
  };
}

export const transactionHandlers = [
  // GET /api/transactions - List transactions
  http.get('/api/transactions', async ({ request }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const pageSize = parseInt(url.searchParams.get('pageSize') || '20', 10);
    const status = url.searchParams.get('status');

    let filtered = [...transactionStore];
    if (status) {
      filtered = filtered.filter((t) => t.status === status);
    }

    const start = (page - 1) * pageSize;
    const paginated = filtered.slice(start, start + pageSize);

    return HttpResponse.json({
      ...createResponse(paginated),
      meta: {
        page,
        pageSize,
        total: filtered.length,
        hasMore: start + pageSize < filtered.length,
      },
    });
  }),

  // GET /api/transactions/:id - Get single transaction
  http.get('/api/transactions/:id', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    const txn = transactionStore.find((t) => t.id === id);

    if (!txn) {
      return HttpResponse.json(
        {
          code: 'NOT_FOUND',
          message: `Transaction ${id} not found`,
          retryable: false,
        },
        { status: 404 }
      );
    }

    // Return full transaction object
    const fullTxn = generateTransaction({ ...txn });
    return HttpResponse.json(createResponse(fullTxn));
  }),

  // PATCH /api/transactions/:id - Update transaction status
  http.patch('/api/transactions/:id', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    const body = (await request.json()) as { status?: string };
    const index = transactionStore.findIndex((t) => t.id === id);

    if (index === -1) {
      return HttpResponse.json(
        {
          code: 'NOT_FOUND',
          message: `Transaction ${id} not found`,
          retryable: false,
        },
        { status: 404 }
      );
    }

    if (body.status) {
      transactionStore[index] = {
        ...transactionStore[index],
        status: body.status as TransactionSummary['status'],
      };
    }

    return HttpResponse.json(createResponse(transactionStore[index]));
  }),

  // POST /api/transactions - Create transaction (for testing)
  http.post('/api/transactions', async ({ request }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const newTxn = generateTransactionSummary();
    transactionStore.unshift(newTxn);

    return HttpResponse.json(createResponse(newTxn), { status: 201 });
  }),
];

/**
 * Add a transaction to the store (for SSE simulation).
 * Exported for use by the SSE handler.
 */
export function addTransaction(txn: TransactionSummary): void {
  transactionStore.unshift(txn);
  // Keep store bounded
  if (transactionStore.length > 100) {
    transactionStore = transactionStore.slice(0, 100);
  }
}

/**
 * Get current transaction store (for SSE).
 */
export function getTransactionStore(): TransactionSummary[] {
  return transactionStore;
}
