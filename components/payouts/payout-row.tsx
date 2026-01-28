'use client';

/**
 * Payout Row Component.
 *
 * Dense list row for payout batches.
 * Highlights attention-needed batches for operator visibility.
 */

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/currency';
import { formatTimestamp, formatRelativeTime } from '@/lib/utils/time';
import { calculateCountdown, formatCountdown } from '@/lib/hooks/use-payouts';
import { PayoutStatusBadge } from './settlement-timeline';
import type { PayoutBatch } from '@/lib/types';
import { ChevronRight, AlertTriangle } from 'lucide-react';

interface PayoutRowProps {
  batch: PayoutBatch;
}

export function PayoutRow({ batch }: PayoutRowProps) {
  const countdown = calculateCountdown(batch.expectedSettlementAt);
  const needsAttention = batch.attentionLevel === 'action_required' || batch.attentionLevel === 'warning';

  return (
    <Link
      href={`/payouts/${batch.id}`}
      className={cn(
        'flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        'group',
        needsAttention && 'bg-yellow-50/50 dark:bg-yellow-950/10 border-l-2 border-l-yellow-500'
      )}
    >
      {/* Attention indicator */}
      <div className="w-5 shrink-0">
        {needsAttention && (
          <AlertTriangle
            className={cn(
              'h-4 w-4',
              batch.attentionLevel === 'action_required' ? 'text-red-500' : 'text-yellow-500'
            )}
          />
        )}
      </div>

      {/* Created / Merchant */}
      <div className="w-36 shrink-0">
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {formatTimestamp(batch.createdAt)}
        </span>
        <div className="text-sm text-gray-900 dark:text-gray-100 truncate">
          {batch.merchantName}
        </div>
      </div>

      {/* Batch ID */}
      <div className="w-28 shrink-0 hidden sm:block">
        <span className="font-mono text-xs text-gray-500 truncate block">
          {batch.id.slice(0, 12)}...
        </span>
      </div>

      {/* Items */}
      <div className="w-20 shrink-0 text-center hidden md:block">
        <span className="text-sm text-gray-700 dark:text-gray-300">
          {batch.itemCount} items
        </span>
        {batch.status === 'partially_settled' && (
          <div className="text-xs text-red-500">
            {batch.failedItemCount} failed
          </div>
        )}
      </div>

      {/* Amount */}
      <div className="w-28 shrink-0 text-right">
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
          {formatCurrency(batch.netAmount, batch.currency)}
        </span>
        {batch.status === 'partially_settled' && (
          <div className="text-xs text-green-600 dark:text-green-400">
            {formatCurrency(batch.settledAmount, batch.currency)} settled
          </div>
        )}
      </div>

      {/* Settlement timing */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500 dark:text-gray-400">
          T+{batch.settlementDays} settlement
        </div>
        {batch.status === 'in_transit' && batch.expectedSettlementAt && (
          <div
            className={cn(
              'text-xs',
              countdown.isOverdue
                ? 'text-yellow-600 dark:text-yellow-400'
                : 'text-gray-400 dark:text-gray-500'
            )}
          >
            {formatCountdown(countdown)}
          </div>
        )}
        {batch.status === 'settled' && batch.settledAt && (
          <div className="text-xs text-green-600 dark:text-green-400">
            Settled {formatRelativeTime(batch.settledAt)}
          </div>
        )}
      </div>

      {/* Status */}
      <div className="w-28 shrink-0">
        <PayoutStatusBadge status={batch.status} attentionLevel={batch.attentionLevel} />
      </div>

      {/* Arrow */}
      <div className="w-5 shrink-0">
        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
      </div>
    </Link>
  );
}

/**
 * Mobile-optimized payout card.
 */
export function PayoutCard({ batch }: PayoutRowProps) {
  const countdown = calculateCountdown(batch.expectedSettlementAt);
  const needsAttention = batch.attentionLevel === 'action_required' || batch.attentionLevel === 'warning';

  return (
    <Link
      href={`/payouts/${batch.id}`}
      className={cn(
        'block p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0',
        'active:bg-gray-50 dark:active:bg-gray-800/50',
        needsAttention && 'bg-yellow-50/50 dark:bg-yellow-950/10 border-l-2 border-l-yellow-500'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <PayoutStatusBadge status={batch.status} attentionLevel={batch.attentionLevel} />
            {needsAttention && (
              <AlertTriangle
                className={cn(
                  'h-4 w-4',
                  batch.attentionLevel === 'action_required' ? 'text-red-500' : 'text-yellow-500'
                )}
              />
            )}
          </div>
          <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
            {batch.merchantName}
          </p>
          <p className="text-xs text-gray-500">
            {batch.itemCount} items • T+{batch.settlementDays}
          </p>
          {batch.attentionReason && (
            <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-1 truncate">
              {batch.attentionReason}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-sm text-gray-900 dark:text-gray-100">
            {formatCurrency(batch.netAmount, batch.currency)}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            {formatRelativeTime(batch.createdAt)}
          </p>
        </div>
      </div>
    </Link>
  );
}
