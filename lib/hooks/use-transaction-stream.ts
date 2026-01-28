'use client';

/**
 * Transaction Stream Hook.
 *
 * This hook orchestrates:
 * 1. SSE connection management
 * 2. Backpressure buffering
 * 3. TanStack Query cache updates
 *
 * Design decisions:
 *
 * 1. SINGLE SOURCE OF TRUTH
 *    Events flow: SSE → Buffer → TanStack Query Cache → UI
 *    The UI ONLY reads from the query cache, never from local state.
 *    System stability: No duplicate state, no sync issues.
 *
 * 2. IDEMPOTENT EVENT HANDLING
 *    Events are keyed by transaction ID. Duplicates are ignored.
 *    Failure containment: Network retries or server replays don't corrupt state.
 *
 * 3. BOUNDED LIST SIZE
 *    The cache holds at most N transactions (most recent first).
 *    System stability: Unbounded lists cause memory exhaustion.
 *
 * 4. COMBINED STATE EXPOSURE
 *    Single state object with connection, buffer, and data info.
 *    Operator trust: All relevant info in one place.
 */

import { useCallback, useMemo } from 'react';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { useSSE, type SSEConnectionState } from './use-sse';
import { useBackpressureBuffer } from './use-backpressure-buffer';
import type { TransactionSummary } from '@/lib/types';

const TRANSACTION_LIST_MAX_SIZE = 100;
const QUERY_KEY = ['transactions', 'stream'];

export interface TransactionStreamState {
  // Connection
  connectionState: SSEConnectionState;
  lastEventAt: string | null;
  reconnectAttempt: number;
  missedEvents: number;
  connectionError: string | null;

  // Backpressure
  bufferSize: number;
  droppedCount: number;
  isThrottling: boolean;

  // Data
  transactions: TransactionSummary[];
  isLoading: boolean;
}

export interface UseTransactionStreamOptions {
  enabled?: boolean;
}

export function useTransactionStream({
  enabled = true,
}: UseTransactionStreamOptions = {}) {
  const queryClient = useQueryClient();

  // Query for reading transaction list from cache
  const {
    data: transactions = [],
    isLoading,
  } = useQuery<TransactionSummary[]>({
    queryKey: QUERY_KEY,
    queryFn: () => {
      // Initial data is empty - populated by SSE
      return [];
    },
    // Never refetch - data comes from SSE
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Track seen IDs for idempotency
  const seenIds = useMemo(() => new Set(transactions.map((t) => t.id)), [transactions]);

  // Flush handler - writes buffered transactions to query cache
  const handleFlush = useCallback(
    (items: TransactionSummary[]) => {
      queryClient.setQueryData<TransactionSummary[]>(QUERY_KEY, (prev = []) => {
        // Filter out duplicates (idempotency)
        const newItems = items.filter((item) => !seenIds.has(item.id));

        if (newItems.length === 0) return prev;

        // Prepend new items, maintain max size
        const updated = [...newItems, ...prev].slice(0, TRANSACTION_LIST_MAX_SIZE);
        return updated;
      });
    },
    [queryClient, seenIds]
  );

  // Backpressure buffer
  const {
    push: pushToBuffer,
    state: bufferState,
    resetDroppedCount,
  } = useBackpressureBuffer<TransactionSummary>({
    maxBufferSize: 50,
    flushIntervalMs: 16, // ~60fps
    onFlush: handleFlush,
  });

  // SSE message handler
  const handleSSEMessage = useCallback(
    (event: { type: string; data?: TransactionSummary }, sequence: number) => {
      if (event.type === 'transaction' && event.data) {
        pushToBuffer(event.data);
      }
      // Heartbeats and other events are ignored but update lastEventAt
    },
    [pushToBuffer]
  );

  // SSE connection
  const sseState = useSSE<{ type: string; data?: TransactionSummary }>({
    url: '/api/transactions/stream',
    onMessage: handleSSEMessage,
    enabled,
  });

  // Clear transactions
  const clearTransactions = useCallback(() => {
    queryClient.setQueryData<TransactionSummary[]>(QUERY_KEY, []);
    resetDroppedCount();
  }, [queryClient, resetDroppedCount]);

  // Combined state
  const state: TransactionStreamState = {
    // Connection
    connectionState: sseState.connectionState,
    lastEventAt: sseState.lastEventAt,
    reconnectAttempt: sseState.reconnectAttempt,
    missedEvents: sseState.missedEvents,
    connectionError: sseState.error,

    // Backpressure
    bufferSize: bufferState.bufferSize,
    droppedCount: bufferState.droppedCount,
    isThrottling: bufferState.isThrottling,

    // Data
    transactions,
    isLoading,
  };

  return {
    state,
    clearTransactions,
    resetDroppedCount,
    reconnect: (sseState as ReturnType<typeof useSSE> & { reconnect: () => void }).reconnect,
  };
}
