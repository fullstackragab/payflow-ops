'use client';

/**
 * Payments List Page.
 *
 * Shows all payments with filtering by status.
 * Links to detail pages for lifecycle management.
 *
 * Production notes:
 * - Pagination would be cursor-based for large datasets
 * - Filters would be persisted in URL for shareability
 * - Bulk actions would require idempotency handling
 */

import { useState } from 'react';
import { usePayments, useCreatePayment } from '@/lib/hooks/use-payments';
import { PaymentRow, PaymentCard } from '@/components/payments/payment-row';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils/cn';
import type { PaymentStatus } from '@/lib/types';
import { Plus, RefreshCw, AlertTriangle } from 'lucide-react';

const STATUS_FILTERS: { value: PaymentStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'processing', label: 'Processing' },
  { value: 'requires_action', label: 'Requires Action' },
  { value: 'succeeded', label: 'Succeeded' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' },
];

export default function PaymentsPage() {
  const [statusFilter, setStatusFilter] = useState<PaymentStatus | 'all'>('all');
  const [isCreating, setIsCreating] = useState(false);

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePayments({
    status: statusFilter === 'all' ? undefined : statusFilter,
    pageSize: 50,
  });

  const createMutation = useCreatePayment();

  const payments = response?.data || [];
  const meta = response?.meta;

  const handleCreatePayment = async () => {
    setIsCreating(true);
    try {
      await createMutation.mutateAsync({
        amount: Math.floor(Math.random() * 100000) + 1000, // $10 - $1000
        currency: 'USD',
        merchantId: 'merch_demo',
        intent: 'capture',
        description: `Test payment ${Date.now()}`,
      });
    } catch (err) {
      // Error handling done by mutation
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl text-gray-900 dark:text-gray-100">
            Payments
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Payment lifecycle management with state machine validation
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
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
          <Button
            size="sm"
            onClick={handleCreatePayment}
            disabled={isCreating || createMutation.isPending}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Create Draft
          </Button>
        </div>
      </div>

      {/* Status filters */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            onClick={() => setStatusFilter(filter.value)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-md transition-colors',
              statusFilter === filter.value
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Create error */}
      {createMutation.isError && (
        <Alert variant="destructive">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-medium">Failed to create payment</p>
              <p className="text-sm">{createMutation.error.message}</p>
            </div>
          </div>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading && (
        <Card className="p-8">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading payments...</span>
          </div>
        </Card>
      )}

      {/* Error state */}
      {isError && (
        <Alert variant="destructive">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-medium">Failed to load payments</p>
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

      {/* Payment list */}
      {!isLoading && !isError && (
        <Card className="overflow-hidden">
          {/* Desktop Header */}
          <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500 dark:text-gray-400 font-medium">
            <div className="w-28">Created</div>
            <div className="w-32">ID</div>
            <div className="flex-1">Description</div>
            <div className="w-24 text-right">Amount</div>
            <div className="w-32">Status</div>
            <div className="w-5" />
          </div>

          {/* Payment rows */}
          {payments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <p className="text-sm">
                {statusFilter === 'all'
                  ? 'No payments found'
                  : `No ${statusFilter} payments`}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCreatePayment}
                className="mt-4 gap-2"
              >
                <Plus className="h-4 w-4" />
                Create a payment
              </Button>
            </div>
          ) : (
            <>
              {/* Desktop view */}
              <ScrollArea className="hidden sm:block max-h-[600px]">
                {payments.map((payment) => (
                  <PaymentRow key={payment.id} payment={payment} />
                ))}
              </ScrollArea>

              {/* Mobile view */}
              <ScrollArea className="sm:hidden max-h-[600px]">
                {payments.map((payment) => (
                  <PaymentCard key={payment.id} payment={payment} />
                ))}
              </ScrollArea>
            </>
          )}

          {/* Footer */}
          {meta && (
            <div className="px-4 py-2 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Showing {payments.length} of {meta.total} payments
                {meta.hasMore && ' (scroll for more)'}
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Idempotency explanation */}
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-900">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Idempotency in payments
        </h3>
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
          Every payment creation includes an idempotency key. If a network failure
          causes a retry with the same key, the server returns the original payment
          instead of creating a duplicate. This prevents double-charges.
        </p>
      </div>
    </div>
  );
}
