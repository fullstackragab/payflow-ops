'use client';

/**
 * Payout Batch Detail Page.
 *
 * Shows full batch details, settlement timeline, and reconciliation tools.
 *
 * Key decisions:
 * 1. Timeline is the centerpiece — shows where we are in the process
 * 2. Reconciliation requires explicit notes — no silent state changes
 * 3. Items are shown with individual status — partial failures are clear
 * 4. Simulation tools for demo only
 */

import { use, useState } from 'react';
import Link from 'next/link';
import { usePayout, useReconcilePayout, useSimulatePayout } from '@/lib/hooks/use-payouts';
import { SettlementTimeline, PayoutStatusBadge } from '@/components/payouts/settlement-timeline';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Alert } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatCurrency } from '@/lib/utils/currency';
import { formatTimestamp, formatRelativeTime } from '@/lib/utils/time';
import { cn } from '@/lib/utils/cn';
import { isTerminalPayoutStatus } from '@/lib/types/payout';
import type { PayoutBatch, PayoutStatus, PayoutItemStatus } from '@/lib/types';
import {
  ArrowLeft,
  RefreshCw,
  AlertTriangle,
  Copy,
  Check,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PayoutDetailPage({ params }: PageProps) {
  const { id } = use(params);
  const [copied, setCopied] = useState<string | null>(null);
  const [showReconcile, setShowReconcile] = useState(false);
  const [reconcileNotes, setReconcileNotes] = useState('');
  const [reconcileStatus, setReconcileStatus] = useState<PayoutStatus>('settled');
  const [reconcileError, setReconcileError] = useState<string | null>(null);

  const {
    data: response,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = usePayout(id);

  const reconcileMutation = useReconcilePayout();
  const simulateMutation = useSimulatePayout();

  const batch = response?.data;

  const handleCopy = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopied(field);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleReconcile = async () => {
    if (!batch || !reconcileNotes.trim()) {
      setReconcileError('Reconciliation notes are required');
      return;
    }

    setReconcileError(null);

    try {
      await reconcileMutation.mutateAsync({
        payoutId: batch.id,
        resolvedStatus: reconcileStatus,
        notes: reconcileNotes,
        settledAmount: reconcileStatus === 'settled' ? batch.netAmount : undefined,
      });
      setShowReconcile(false);
      setReconcileNotes('');
    } catch (err: unknown) {
      setReconcileError(err instanceof Error ? err.message : 'Reconciliation failed');
    }
  };

  const handleSimulate = async (outcome: 'progress' | 'settle' | 'partial_fail' | 'fail' | 'delay' | 'need_recon') => {
    if (!batch) return;
    await simulateMutation.mutateAsync({ payoutId: batch.id, outcome });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <BackButton />
        <Card className="p-8">
          <div className="flex items-center justify-center gap-2 text-gray-500">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm">Loading payout...</span>
          </div>
        </Card>
      </div>
    );
  }

  // Error state
  if (isError || !batch) {
    return (
      <div className="space-y-4">
        <BackButton />
        <Alert variant="destructive">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-medium">Failed to load payout</p>
              <p className="text-sm">{error?.message || 'Payout not found'}</p>
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  Try again
                </Button>
                <Link href="/payouts">
                  <Button size="sm" variant="outline">Back to list</Button>
                </Link>
              </div>
            </div>
          </div>
        </Alert>
      </div>
    );
  }

  const canReconcile = batch.status === 'requires_reconciliation' || batch.status === 'partially_settled';
  const isTerminal = isTerminalPayoutStatus(batch.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-4">
          <BackButton />
          <div>
            <h1 className="text-xl text-gray-900 dark:text-gray-100 flex items-center gap-3">
              Payout Batch
              <PayoutStatusBadge status={batch.status} attentionLevel={batch.attentionLevel} />
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 font-mono">
              {batch.id}
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
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Attention alert */}
      {batch.attentionReason && (
        <Alert variant={batch.attentionLevel === 'action_required' ? 'destructive' : 'default'}>
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5" />
            <div>
              <p className="font-medium">
                {batch.attentionLevel === 'action_required' ? 'Action required' : 'Attention needed'}
              </p>
              <p className="text-sm">{batch.attentionReason}</p>
            </div>
          </div>
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Left column: Details */}
        <div className="space-y-6">
          {/* Amount summary */}
          <Card className="p-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Net Amount
                </p>
                <p className="mt-1 text-2xl font-mono text-gray-900 dark:text-gray-100">
                  {formatCurrency(batch.netAmount, batch.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                  Settled Amount
                </p>
                <p className={cn(
                  'mt-1 text-2xl font-mono',
                  batch.settledAmount === batch.netAmount
                    ? 'text-green-600 dark:text-green-400'
                    : batch.settledAmount > 0
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-gray-400'
                )}>
                  {formatCurrency(batch.settledAmount, batch.currency)}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
              <div>
                <p className="text-xs text-gray-500">Gross</p>
                <p className="text-sm font-mono">{formatCurrency(batch.grossAmount, batch.currency)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Fees</p>
                <p className="text-sm font-mono text-red-600 dark:text-red-400">
                  -{formatCurrency(batch.totalFees, batch.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Items</p>
                <p className="text-sm">
                  {batch.itemCount} total
                  {batch.failedItemCount > 0 && (
                    <span className="text-red-500 ml-1">({batch.failedItemCount} failed)</span>
                  )}
                </p>
              </div>
            </div>
          </Card>

          {/* Merchant & Bank */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Settlement Details
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Merchant</p>
                <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                  {batch.merchantName}
                </p>
                <p className="text-xs text-gray-400 font-mono">{batch.merchantId}</p>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Bank Account</p>
                <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100 font-mono">
                  ••••{batch.bankAccountLast4}
                </p>
              </div>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400">Settlement Terms</p>
                <p className="mt-0.5 text-sm text-gray-900 dark:text-gray-100">
                  T+{batch.settlementDays} business days
                </p>
              </div>
            </div>
          </Card>

          {/* Timestamps */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Timestamps
            </h3>
            <div className="space-y-3 text-sm">
              <TimestampRow label="Created" timestamp={batch.createdAt} />
              <TimestampRow label="Processed" timestamp={batch.processedAt} />
              <TimestampRow label="Expected Settlement" timestamp={batch.expectedSettlementAt} isEstimate />
              <TimestampRow label="Settled" timestamp={batch.settledAt} />
              {batch.lastReconciledAt && (
                <TimestampRow label="Last Reconciled" timestamp={batch.lastReconciledAt} />
              )}
            </div>
          </Card>

          {/* Reconciliation notes */}
          {batch.reconciliationNotes && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Reconciliation Notes
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                {batch.reconciliationNotes}
              </p>
            </Card>
          )}

          {/* Failure reason */}
          {batch.failureReason && (
            <Alert variant="destructive">
              <div>
                <p className="font-medium">Batch failed</p>
                <p className="text-sm mt-1">{batch.failureReason}</p>
              </div>
            </Alert>
          )}
        </div>

        {/* Right column: Timeline and actions */}
        <div className="space-y-6">
          {/* Settlement timeline */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
              Settlement Timeline
            </h3>
            <SettlementTimeline batch={batch} />
          </Card>

          {/* Reconciliation form */}
          {canReconcile && (
            <Card className="p-4">
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                Reconciliation
              </h3>

              {!showReconcile ? (
                <div className="space-y-3">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    This batch requires manual verification. After confirming the settlement status
                    with the bank, mark it as resolved.
                  </p>
                  <Button
                    onClick={() => setShowReconcile(true)}
                    className="w-full"
                  >
                    Begin Reconciliation
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {reconcileError && (
                    <Alert variant="destructive">
                      <p className="text-sm">{reconcileError}</p>
                    </Alert>
                  )}

                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                      Resolved Status
                    </label>
                    <select
                      value={reconcileStatus}
                      onChange={(e) => setReconcileStatus(e.target.value as PayoutStatus)}
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
                    >
                      <option value="settled">Settled - All funds confirmed</option>
                      <option value="partially_settled">Partially Settled - Some items succeeded</option>
                      <option value="failed">Failed - No funds were sent</option>
                      <option value="returned">Returned - Funds bounced back</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs text-gray-500 dark:text-gray-400 block mb-1">
                      Reconciliation Notes (required)
                    </label>
                    <textarea
                      value={reconcileNotes}
                      onChange={(e) => setReconcileNotes(e.target.value)}
                      placeholder="Describe how you verified the settlement status (e.g., 'Confirmed with bank reference #12345')"
                      className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 min-h-[100px]"
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleReconcile}
                      disabled={reconcileMutation.isPending || !reconcileNotes.trim()}
                      className="flex-1"
                    >
                      {reconcileMutation.isPending ? 'Saving...' : 'Save Resolution'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowReconcile(false);
                        setReconcileNotes('');
                        setReconcileError(null);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>

                  <p className="text-xs text-yellow-600 dark:text-yellow-400">
                    Warning: This action is recorded in the audit trail. Ensure you have
                    verified the actual settlement status with the bank before proceeding.
                  </p>
                </div>
              )}
            </Card>
          )}

          {/* Items list */}
          <Card className="p-4">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              Batch Items ({batch.items.length})
            </h3>
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {batch.items.map((item) => (
                  <ItemRow key={item.id} item={item} currency={batch.currency} />
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Simulation controls (demo only) */}
          {!isTerminal && (
            <Card className="p-4 border-dashed">
              <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-3">
                Demo: Simulate Outcomes
              </h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSimulate('progress')}
                  disabled={simulateMutation.isPending}
                >
                  Progress
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSimulate('settle')}
                  disabled={simulateMutation.isPending}
                  className="text-green-600 border-green-200 hover:bg-green-50"
                >
                  Settle
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSimulate('partial_fail')}
                  disabled={simulateMutation.isPending}
                  className="text-yellow-600 border-yellow-200 hover:bg-yellow-50"
                >
                  Partial Fail
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSimulate('fail')}
                  disabled={simulateMutation.isPending}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  Fail
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSimulate('delay')}
                  disabled={simulateMutation.isPending}
                >
                  Delay
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSimulate('need_recon')}
                  disabled={simulateMutation.isPending}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  Need Recon
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function BackButton() {
  return (
    <Link href="/payouts">
      <Button variant="ghost" size="sm" className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>
    </Link>
  );
}

function TimestampRow({
  label,
  timestamp,
  isEstimate,
}: {
  label: string;
  timestamp: string | null;
  isEstimate?: boolean;
}) {
  if (!timestamp) {
    return (
      <div className="flex justify-between">
        <span className="text-gray-500 dark:text-gray-400">{label}</span>
        <span className="text-gray-400">—</span>
      </div>
    );
  }

  return (
    <div className="flex justify-between">
      <span className="text-gray-500 dark:text-gray-400">
        {label}
        {isEstimate && <span className="text-xs ml-1">(est.)</span>}
      </span>
      <span className="text-gray-900 dark:text-gray-100 font-mono text-xs">
        {formatTimestamp(timestamp)}
      </span>
    </div>
  );
}

function ItemRow({
  item,
  currency,
}: {
  item: { id: string; transactionId: string; status: PayoutItemStatus; netAmount: number; failureMessage: string | null };
  currency: string;
}) {
  const statusIcon = {
    pending: <Clock className="h-3.5 w-3.5 text-gray-400" />,
    settled: <CheckCircle className="h-3.5 w-3.5 text-green-500" />,
    failed: <XCircle className="h-3.5 w-3.5 text-red-500" />,
    returned: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  };

  return (
    <div className="flex items-center gap-3 py-2 border-b border-gray-100 dark:border-gray-800 last:border-0">
      {statusIcon[item.status]}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-mono text-gray-600 dark:text-gray-400 truncate">
          {item.transactionId}
        </p>
        {item.failureMessage && (
          <p className="text-xs text-red-500 truncate">{item.failureMessage}</p>
        )}
      </div>
      <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
        {formatCurrency(item.netAmount, currency)}
      </span>
    </div>
  );
}
