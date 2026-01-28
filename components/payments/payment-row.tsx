'use client';

/**
 * Payment Row Component.
 *
 * Dense, scannable row for payment lists.
 * Links to detail page for full lifecycle view.
 */

import Link from 'next/link';
import { StatusIndicator } from './lifecycle-diagram';
import { formatCurrency } from '@/lib/utils/currency';
import { formatTimestamp, formatRelativeTime } from '@/lib/utils/time';
import { cn } from '@/lib/utils/cn';
import { isTerminalStatus } from '@/lib/state-machines/payment-lifecycle';
import type { Payment } from '@/lib/types';
import { ChevronRight } from 'lucide-react';

interface PaymentRowProps {
  payment: Payment;
}

export function PaymentRow({ payment }: PaymentRowProps) {
  const terminal = isTerminalStatus(payment.status);

  return (
    <Link
      href={`/payments/${payment.id}`}
      className={cn(
        'flex items-center gap-4 px-4 py-3 border-b border-gray-100 dark:border-gray-800 last:border-b-0',
        'hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors',
        'group'
      )}
    >
      {/* Timestamp */}
      <div className="w-28 shrink-0">
        <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
          {formatTimestamp(payment.createdAt)}
        </span>
        <div className="text-[10px] text-gray-400 dark:text-gray-500">
          {formatRelativeTime(payment.createdAt)}
        </div>
      </div>

      {/* Payment ID */}
      <div className="w-32 shrink-0 hidden sm:block">
        <span className="font-mono text-xs text-gray-700 dark:text-gray-300 truncate block">
          {payment.id.slice(0, 12)}...
        </span>
      </div>

      {/* Description / Merchant */}
      <div className="flex-1 min-w-0">
        <span className="text-sm text-gray-900 dark:text-gray-100 truncate block">
          {payment.description || payment.merchantName}
        </span>
        {payment.description && (
          <span className="text-xs text-gray-500 dark:text-gray-400 truncate block">
            {payment.merchantName}
          </span>
        )}
      </div>

      {/* Amount */}
      <div className="w-24 shrink-0 text-right">
        <span className="font-mono text-sm text-gray-900 dark:text-gray-100">
          {formatCurrency(payment.amount, payment.currency)}
        </span>
      </div>

      {/* Status */}
      <div className="w-32 shrink-0">
        <StatusIndicator status={payment.status} />
      </div>

      {/* Arrow indicator */}
      <div className="w-5 shrink-0">
        <ChevronRight className="h-4 w-4 text-gray-400 group-hover:text-gray-600 dark:text-gray-500 dark:group-hover:text-gray-400 transition-colors" />
      </div>
    </Link>
  );
}

/**
 * Mobile-optimized payment card.
 */
export function PaymentCard({ payment }: PaymentRowProps) {
  const terminal = isTerminalStatus(payment.status);

  return (
    <Link
      href={`/payments/${payment.id}`}
      className={cn(
        'block p-4 border-b border-gray-100 dark:border-gray-800 last:border-b-0',
        'active:bg-gray-50 dark:active:bg-gray-800/50'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <StatusIndicator status={payment.status} />
          </div>
          <p className="text-sm text-gray-900 dark:text-gray-100 truncate">
            {payment.description || payment.merchantName}
          </p>
          <p className="mt-0.5 font-mono text-xs text-gray-500 truncate">
            {payment.id}
          </p>
          <p className="mt-1 text-xs text-gray-400">
            {formatRelativeTime(payment.createdAt)}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-sm text-gray-900 dark:text-gray-100">
            {formatCurrency(payment.amount, payment.currency)}
          </p>
          <ChevronRight className="h-4 w-4 text-gray-400 ml-auto mt-1" />
        </div>
      </div>
    </Link>
  );
}
