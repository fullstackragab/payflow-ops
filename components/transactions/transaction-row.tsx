'use client';

/**
 * Transaction Row Component.
 *
 * Production rationale:
 * The row must be:
 * 1. Scannable - key info visible at a glance
 * 2. Dense - many rows visible without scrolling
 * 3. Consistent - same layout regardless of data
 *
 * Status badges use semantic colors matching the design system.
 */

import { Badge } from '@/components/ui/badge';
import { formatCurrency } from '@/lib/utils/currency';
import { formatTimestamp } from '@/lib/utils/time';
import { cn } from '@/lib/utils/cn';
import type { TransactionSummary, TransactionStatus } from '@/lib/types';

interface TransactionRowProps {
  transaction: TransactionSummary;
  isNew?: boolean;
}

const STATUS_VARIANTS: Record<TransactionStatus, 'success' | 'warning' | 'error' | 'info' | 'secondary'> = {
  pending: 'info',
  processing: 'info',
  authorized: 'warning',
  captured: 'success',
  settled: 'success',
  failed: 'error',
  refunded: 'secondary',
  disputed: 'error',
};

export function TransactionRow({ transaction, isNew }: TransactionRowProps) {
  const statusVariant = STATUS_VARIANTS[transaction.status];

  return (
    <div
      className={cn(
        'flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        isNew && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
    >
      {/* Timestamp */}
      <div className="w-20 shrink-0">
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {formatTimestamp(transaction.createdAt)}
        </span>
      </div>

      {/* Transaction ID */}
      <div className="w-32 shrink-0 hidden sm:block">
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate block">
          {transaction.id.slice(0, 12)}...
        </span>
      </div>

      {/* Merchant */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-900 dark:text-gray-100 truncate block">
          {transaction.merchantName}
        </span>
      </div>

      {/* Amount */}
      <div className="w-24 shrink-0 text-right">
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
          {formatCurrency(transaction.amount, transaction.currency)}
        </span>
      </div>

      {/* Region */}
      <div className="w-12 shrink-0 text-center hidden md:block">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {transaction.region}
        </span>
      </div>

      {/* Status */}
      <div className="w-24 shrink-0">
        <Badge variant={statusVariant} className="w-full justify-center">
          {transaction.status}
        </Badge>
      </div>
    </div>
  );
}

/**
 * Mobile-optimized transaction card.
 */
export function TransactionCard({ transaction, isNew }: TransactionRowProps) {
  const statusVariant = STATUS_VARIANTS[transaction.status];

  return (
    <div
      className={cn(
        'p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0',
        isNew && 'bg-blue-50/50 dark:bg-blue-950/20'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs text-gray-500">
              {formatTimestamp(transaction.createdAt)}
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-500">{transaction.region}</span>
          </div>
          <p className="mt-1 text-sm text-gray-900 dark:text-gray-100 truncate">
            {transaction.merchantName}
          </p>
          <p className="mt-0.5 font-mono text-xs text-gray-500 truncate">
            {transaction.id}
          </p>
        </div>
        <div className="text-right shrink-0">
          <Badge variant={statusVariant}>{transaction.status}</Badge>
          <p className="mt-1 font-mono text-sm text-gray-900 dark:text-gray-100">
            {formatCurrency(transaction.amount, transaction.currency)}
          </p>
        </div>
      </div>
    </div>
  );
}
