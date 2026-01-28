'use client';

/**
 * Payouts List Page.
 *
 * Shows payout batches with attention-needed items surfaced first.
 * No realtime updates — payouts are checked periodically, not continuously.
 *
 * Key UX decisions:
 * 1. "Needs attention" filter is prominent — operators check this first
 * 2. Settled batches are de-emphasized — no action needed
 * 3. No automatic refresh — operators decide when to check
 * 4. Clear explanations of what each status means
 */

import { useState } from 'react';
import { usePayouts } from '@/lib/hooks/use-payouts';
import { PayoutRow, PayoutCard } from '@/components/payouts/payout-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/utils/currency';
import { cn } from '@/lib/utils/cn';
import type { PayoutStatus } from '@/lib/types';
import { RefreshCw, AlertTriangle, Clock, CheckCircle, Filter } from 'lucide-react';

type FilterMode = 'all' | 'needs_attention' | 'in_progress' | 'settled';

const FILTER_OPTIONS: { value: FilterMode; label: string; description: string }[] = [
  { value: 'all', label: 'All', description: 'All payout batches' },
  { value: 'needs_attention', label: 'Needs Attention', description: 'Batches requiring action' },
  { value: 'in_progress', label: 'In Progress', description: 'Pending, processing, or in transit' },
  { value: 'settled', label: 'Settled', description: 'Completed batches' },
];

export default function PayoutsPage() {
  const [filterMode, setFilterMode] = useState<FilterMode>('all');

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePayouts({
    needsAttention: filterMode === 'needs_attention' || undefined,
  });

  const allBatches = response?.data || [];
  const summary = response?.summary;

  // Client-side filtering for other modes
  const batches = allBatches.filter((batch) => {
    switch (filterMode) {
      case 'in_progress':
        return ['pending', 'processing', 'in_transit'].includes(batch.status);
      case 'settled':
        return batch.status === 'settled';
      case 'needs_attention':
      case 'all':
      default:
        return true;
    }
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl text-gray-900 dark:text-gray-100">
            Payouts & Settlements
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Settlement batches with T+N processing delays
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {summary.inTransit}
                </p>
                <p className="text-xs text-gray-500">In Transit</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {summary.needsAttention}
                </p>
                <p className="text-xs text-gray-500">Needs Attention</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {summary.pending}
                </p>
                <p className="text-xs text-gray-500">Pending</p>
              </div>
            </div>
          </Card>

          <Card className="p-4">
            <div>
              <p className="text-lg font-mono font-semibold text-gray-900 dark:text-gray-100">
                {formatCurrency(summary.totalPendingAmount, 'USD')}
              </p>
              <p className="text-xs text-gray-500">Pending Settlement</p>
            </div>
          </Card>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilterMode(option.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              filterMode === option.value
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            )}
            title={option.description}
          >
            {option.value === 'needs_attention' && summary?.needsAttention ? (
              <>
                {option.label}
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] rounded-full bg-yellow-500 text-white">
                  {summary.needsAttention}
                </span>
              </>
            ) : (
              option.label
            )}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {isLoading && (
        <Card className="p-8">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading payouts...</span>
          </div>
        </Card>
      )}

      {/* Error state */}
      {isError && (
        <Alert variant="destructive">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-medium">Failed to load payouts</p>
              <p className="text-sm">{error.message}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => refetch()}
                className="mt-2"
              >
                Try again
              </Button>
            </div>
          </div>
        </Alert>
      )}

      {/* Payout list */}
      {!isLoading && !isError && (
        <Card className="overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 font-medium">
            <div className="w-5" /> {/* Attention indicator space */}
            <div className="w-36">Created / Merchant</div>
            <div className="w-28">Batch ID</div>
            <div className="w-20 text-center hidden md:block">Items</div>
            <div className="w-28 text-right">Amount</div>
            <div className="flex-1">Settlement</div>
            <div className="w-28">Status</div>
            <div className="w-5" />
          </div>

          {/* Payout rows */}
          {batches.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <p className="text-sm">
                {filterMode === 'needs_attention'
                  ? 'No batches need attention'
                  : filterMode === 'in_progress'
                  ? 'No batches in progress'
                  : 'No payout batches found'}
              </p>
              {filterMode !== 'all' && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setFilterMode('all')}
                  className="mt-4 gap-2"
                >
                  <Filter className="h-4 w-4" />
                  Show all batches
                </Button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop view */}
              <ScrollArea className="hidden sm:block max-h-[500px]">
                {batches.map((batch) => (
                  <PayoutRow key={batch.id} batch={batch} />
                ))}
              </ScrollArea>

              {/* Mobile view */}
              <ScrollArea className="sm:hidden max-h-[500px]">
                {batches.map((batch) => (
                  <PayoutCard key={batch.id} batch={batch} />
                ))}
              </ScrollArea>
            </>
          )}

          {/* Footer */}
          <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Showing {batches.length} batch{batches.length !== 1 ? 'es' : ''}
              {filterMode !== 'all' && ` (filtered: ${filterMode.replace('_', ' ')})`}
            </p>
          </div>
        </Card>
      )}

      {/* Settlement explanation */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          About settlement timing
        </h3>
        <div className="mt-2 space-y-2 text-xs text-gray-600 dark:text-gray-400">
          <p>
            <strong>T+N settlement</strong> means funds take N business days to arrive after
            processing. A T+2 batch processed on Monday settles on Wednesday.
          </p>
          <p>
            <strong>Expected dates are estimates.</strong> Bank holidays, receiving bank delays,
            and manual reviews can extend settlement times. An overdue batch doesn't necessarily
            mean failure — it means verification may be needed.
          </p>
          <p>
            <strong>Never retry without reconciliation.</strong> A failed or unclear batch may
            have partially succeeded. Retrying could result in duplicate payments. Always verify
            with the bank before creating a new batch.
          </p>
        </div>
      </div>
    </div>
  );
}
