'use client';

/**
 * Real-Time Transaction Stream Page.
 *
 * Architecture:
 *
 * ┌─────────────────────────────────────────────────────────────┐
 * │                        SSE Endpoint                        │
 * │                   /api/transactions/stream                 │
 * └─────────────────────────────┬───────────────────────────────┘
 *                               │
 *                               ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │                      useSSE Hook                           │
 * │  - Manages EventSource connection                          │
 * │  - Exponential backoff reconnection                        │
 * │  - Sequence number gap detection                           │
 * └─────────────────────────────┬───────────────────────────────┘
 *                               │
 *                               ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │               useBackpressureBuffer Hook                   │
 * │  - Buffers events (max 50)                                 │
 * │  - Throttles flushes to ~60fps                             │
 * │  - Drops oldest events when buffer full                    │
 * │  - Tracks dropped count for UI                             │
 * └─────────────────────────────┬───────────────────────────────┘
 *                               │
 *                               ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │                   TanStack Query Cache                     │
 * │  - Single source of truth for transaction list             │
 * │  - Idempotent updates (dedupe by ID)                       │
 * │  - Bounded list size (max 100)                             │
 * └─────────────────────────────┬───────────────────────────────┘
 *                               │
 *                               ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │                         UI Layer                           │
 * │  - Reads ONLY from query cache                             │
 * │  - Displays connection status                              │
 * │  - Shows backpressure indicators                           │
 * └─────────────────────────────────────────────────────────────┘
 *
 * Why this architecture:
 *
 * 1. FAILURE CONTAINMENT
 *    - SSE disconnects trigger reconnection, not data loss
 *    - Buffer overflow drops data gracefully, not crash
 *    - Query cache persists across reconnections
 *
 * 2. OPERATOR TRUST
 *    - Connection state is always visible
 *    - Dropped events are counted and shown
 *    - Last event timestamp reveals stale connections
 *
 * 3. SYSTEM STABILITY
 *    - Render throttling prevents DOM thrashing
 *    - Bounded data structures prevent memory exhaustion
 *    - Single source of truth prevents state sync bugs
 */

import { useState } from 'react';
import { useTransactionStream } from '@/lib/hooks/use-transaction-stream';
import { StreamStatus } from '@/components/transactions/stream-status';
import { TransactionRow, TransactionCard } from '@/components/transactions/transaction-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Pause, Play, Trash2 } from 'lucide-react';

export default function TransactionsPage() {
  const [isPaused, setIsPaused] = useState(false);

  const {
    state,
    clearTransactions,
    resetDroppedCount,
    reconnect,
  } = useTransactionStream({
    enabled: !isPaused,
  });

  const {
    connectionState,
    lastEventAt,
    reconnectAttempt,
    missedEvents,
    droppedCount,
    bufferSize,
    isThrottling,
    transactions,
  } = state;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl text-gray-900 dark:text-gray-100">
            Real-Time Transaction Stream
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {isPaused
              ? 'Stream paused — no new events'
              : 'Live feed of transaction events'}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsPaused(!isPaused)}
            className="gap-2"
          >
            {isPaused ? (
              <>
                <Play className="h-4 w-4" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                Pause
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearTransactions}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      {/* Stream Status */}
      <Card className="p-3">
        <StreamStatus
          connectionState={connectionState}
          lastEventAt={lastEventAt}
          reconnectAttempt={reconnectAttempt}
          missedEvents={missedEvents}
          droppedCount={droppedCount}
          bufferSize={bufferSize}
          isThrottling={isThrottling}
          onReconnect={reconnect}
          onResetDropped={resetDroppedCount}
        />
      </Card>

      {/* Transaction List */}
      <Card className="overflow-hidden">
        {/* Desktop Header */}
        <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 font-medium">
          <div className="w-20">Time</div>
          <div className="w-32">ID</div>
          <div className="flex-1">Merchant</div>
          <div className="w-24 text-right">Amount</div>
          <div className="w-12 text-center hidden md:block">Region</div>
          <div className="w-24 text-center">Status</div>
        </div>

        {/* Transaction List */}
        {transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500">
            <p className="text-sm">
              {isPaused
                ? 'Stream is paused'
                : connectionState === 'connecting'
                ? 'Connecting to stream...'
                : connectionState === 'error'
                ? 'Unable to connect to stream'
                : 'Waiting for transactions...'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop view */}
            <ScrollArea className="h-[600px] hidden sm:block">
              {transactions.map((txn, index) => (
                <TransactionRow
                  key={txn.id}
                  transaction={txn}
                  isNew={index === 0}
                />
              ))}
            </ScrollArea>

            {/* Mobile view */}
            <ScrollArea className="h-[600px] sm:hidden">
              {transactions.map((txn, index) => (
                <TransactionCard
                  key={txn.id}
                  transaction={txn}
                  isNew={index === 0}
                />
              ))}
            </ScrollArea>
          </>
        )}

        {/* Footer with count */}
        <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Showing {transactions.length} transactions (max 100)
          </p>
        </div>
      </Card>

      {/* Backpressure explanation (for demo/education) */}
      {droppedCount > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-900/50 dark:bg-yellow-950/20">
          <h3 className="text-sm font-medium text-yellow-900 dark:text-yellow-200">
            Events were dropped
          </h3>
          <p className="mt-1 text-xs text-yellow-800 dark:text-yellow-300">
            {droppedCount} events were dropped due to high event volume. This is
            intentional: dropping events keeps the UI responsive and prevents
            memory exhaustion. The alternative — buffering infinitely — would
            eventually crash the browser.
          </p>
        </div>
      )}
    </div>
  );
}
