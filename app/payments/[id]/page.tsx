'use client';

/**
 * Payment Detail Page.
 *
 * Shows full payment details with lifecycle visualization and actions.
 *
 * Design decisions:
 * 1. State machine is the centerpiece - always visible
 * 2. Actions reflect state machine constraints - disabled when invalid
 * 3. Transition history would be shown in production (audit trail)
 * 4. Optimistic locking prevents concurrent modification issues
 */

import { use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { usePayment } from '@/lib/hooks/use-payments';
import { LifecycleDiagram, StatusIndicator } from '@/components/payments/lifecycle-diagram';
import { TransitionActions, TransitionDetails } from '@/components/payments/transition-actions';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { formatCurrency } from '@/lib/utils/currency';
import { formatTimestamp, formatRelativeTime } from '@/lib/utils/time';
import { getValidTransitions, isTerminalStatus, STATUS_METADATA } from '@/lib/state-machines/payment-lifecycle';
import type { Payment } from '@/lib/types';
import { ArrowLeft, RefreshCw, AlertTriangle, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PaymentDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const router = useRouter();
  const [copied, setCopied] = useState<string | null>(null);

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePayment(id);

  const payment = response?.data;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleTransitionComplete = (newPayment: Payment) => {
    // Could show a success toast here
    refetch();
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/payments">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        <Card className="p-8">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading payment...</span>
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (isError || !payment) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Link href="/payments">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        <Alert variant="destructive">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-medium">Failed to load payment</p>
              <p className="text-sm">{error?.message || 'Payment not found'}</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
                <Link href="/payments">
                  <Button size="sm" variant="outline">
                    Back to list
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  const meta = STATUS_METADATA[payment.status];
  const validTransitions = getValidTransitions(payment.status);
  const terminal = isTerminalStatus(payment.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <Link href="/payments">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-xl text-gray-900 dark:text-gray-100 flex items-center gap-3">
              Payment Details
              <StatusIndicator status={payment.status} />
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 font-mono">
              {payment.id}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-2"
        >
          <RefreshCw className={isFetching ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: Payment details */}
        <div className="space-y-6">
          {/* Amount and basic info */}
          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Amount
                </p>
                <p className="mt-1 text-2xl font-mono text-gray-900 dark:text-gray-100">
                  {formatCurrency(payment.amount, payment.currency)}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Intent</p>
                  <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100 capitalize">
                    {payment.intent.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Currency</p>
                  <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                    {payment.currency}
                  </p>
                </div>
              </div>
            </div>
          </Card>

          {/* Identifiers */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Identifiers
            </h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Payment ID</p>
                  <p className="mt-0.5 text-sm font-mono text-gray-900 dark:text-gray-100">
                    {payment.id}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(payment.id, 'id')}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {copied === 'id' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Idempotency Key</p>
                  <p className="mt-0.5 text-sm font-mono text-gray-900 dark:text-gray-100">
                    {payment.idempotencyKey}
                  </p>
                </div>
                <button
                  onClick={() => handleCopy(payment.idempotencyKey, 'idem')}
                  className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  {copied === 'idem' ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-400" />
                  )}
                </button>
              </div>

              {payment.customerId && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Customer ID</p>
                  <p className="mt-0.5 text-sm font-mono text-gray-900 dark:text-gray-100">
                    {payment.customerId}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Merchant and timestamps */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Details
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Merchant</p>
                <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                  {payment.merchantName}
                </p>
                <p className="text-xs text-gray-400 font-mono">{payment.merchantId}</p>
              </div>

              {payment.description && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Description</p>
                  <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                    {payment.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100 dark:border-gray-800">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Created</p>
                  <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                    {formatTimestamp(payment.createdAt)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatRelativeTime(payment.createdAt)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Updated</p>
                  <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                    {formatTimestamp(payment.updatedAt)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatRelativeTime(payment.updatedAt)}
                  </p>
                </div>
              </div>

              {payment.completedAt && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Completed</p>
                  <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                    {formatTimestamp(payment.completedAt)}
                  </p>
                </div>
              )}
            </div>
          </Card>

          {/* Failure info */}
          {payment.failureCode && (
            <Alert variant="destructive">
              <div>
                <p className="font-medium">Payment failed</p>
                <p className="text-sm font-mono mt-1">{payment.failureCode}</p>
                {payment.failureMessage && (
                  <p className="text-sm mt-1">{payment.failureMessage}</p>
                )}
              </div>
            </Alert>
          )}
        </div>

        {/* Right column: Lifecycle and actions */}
        <div className="space-y-6">
          {/* Lifecycle diagram */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Payment Lifecycle
            </h3>
            <LifecycleDiagram currentStatus={payment.status} />
          </Card>

          {/* Current status detail */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Current Status
            </h3>
            <div className="space-y-2">
              <StatusIndicator status={payment.status} showTransitions />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {meta.description}
              </p>
            </div>
          </Card>

          {/* Available actions */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Available Actions
            </h3>
            <TransitionActions
              payment={payment}
              onTransitionComplete={handleTransitionComplete}
            />
          </Card>

          {/* Valid transitions explanation */}
          {validTransitions.length > 0 && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Transition Details
              </h3>
              <div className="space-y-4">
                {validTransitions.map((t) => (
                  <div
                    key={t.to}
                    className="pb-3 border-b border-gray-100 dark:border-gray-800 last:border-0 last:pb-0"
                  >
                    <TransitionDetails from={payment.status} to={t.to} />
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
