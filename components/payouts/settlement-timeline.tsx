'use client';

/**
 * Settlement Timeline Component.
 *
 * Visual representation of the T+N settlement process.
 * Shows where in the timeline the payout currently is.
 *
 * Design decisions:
 * 1. Linear, not circular - settlement is a one-way process
 * 2. Clear "you are here" indicator
 * 3. Overdue state is visually distinct (warning color)
 * 4. Estimates are labeled as estimates
 */

import { cn } from '@/lib/utils/cn';
import { formatTimestamp, formatRelativeTime } from '@/lib/utils/time';
import { calculateCountdown, formatCountdown } from '@/lib/hooks/use-payouts';
import type { PayoutBatch, PayoutStatus } from '@/lib/types';
import { Check, Clock, AlertTriangle, XCircle, HelpCircle, ArrowRight } from 'lucide-react';

interface SettlementTimelineProps {
  batch: PayoutBatch;
  className?: string;
}

interface TimelineStep {
  status: PayoutStatus | 'created';
  label: string;
  timestamp: string | null;
  description: string;
  isCurrent: boolean;
  isComplete: boolean;
  isFailed: boolean;
}

function getTimelineSteps(batch: PayoutBatch): TimelineStep[] {
  const steps: TimelineStep[] = [
    {
      status: 'created',
      label: 'Created',
      timestamp: batch.createdAt,
      description: 'Batch created and queued for processing',
      isCurrent: batch.status === 'pending',
      isComplete: true,
      isFailed: false,
    },
    {
      status: 'processing',
      label: 'Processing',
      timestamp: batch.processedAt,
      description: 'Submitted to banking partner',
      isCurrent: batch.status === 'processing',
      isComplete: !!batch.processedAt,
      isFailed: false,
    },
    {
      status: 'in_transit',
      label: 'In Transit',
      timestamp: null,
      description: `T+${batch.settlementDays} settlement — funds moving through banking network`,
      isCurrent: batch.status === 'in_transit',
      isComplete: ['settled', 'partially_settled', 'returned'].includes(batch.status),
      isFailed: false,
    },
    {
      status: 'settled',
      label: 'Settled',
      timestamp: batch.settledAt,
      description: 'Funds confirmed in merchant account',
      isCurrent: batch.status === 'settled',
      isComplete: batch.status === 'settled',
      isFailed: ['failed', 'returned', 'requires_reconciliation'].includes(batch.status),
    },
  ];

  // Mark failure states
  if (batch.status === 'failed') {
    const failIndex = steps.findIndex((s) => !s.isComplete);
    if (failIndex >= 0) {
      steps[failIndex].isFailed = true;
      steps[failIndex].isCurrent = true;
    }
  }

  return steps;
}

function StepIcon({
  isComplete,
  isCurrent,
  isFailed,
}: {
  isComplete: boolean;
  isCurrent: boolean;
  isFailed: boolean;
}) {
  if (isFailed) {
    return <XCircle className="h-5 w-5 text-red-500" />;
  }
  if (isComplete) {
    return <Check className="h-5 w-5 text-green-500" />;
  }
  if (isCurrent) {
    return <Clock className="h-5 w-5 text-blue-500 animate-pulse" />;
  }
  return <div className="h-5 w-5 rounded-full border-2 border-gray-300 dark:border-gray-600" />;
}

export function SettlementTimeline({ batch, className }: SettlementTimelineProps) {
  const steps = getTimelineSteps(batch);
  const countdown = calculateCountdown(batch.expectedSettlementAt);

  return (
    <div className={cn('space-y-6', className)}>
      {/* Timeline */}
      <div className="relative">
        {steps.map((step, index) => (
          <div key={step.status} className="relative flex gap-4 pb-8 last:pb-0">
            {/* Connecting line */}
            {index < steps.length - 1 && (
              <div
                className={cn(
                  'absolute left-[9px] top-6 h-full w-0.5',
                  step.isComplete ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'
                )}
              />
            )}

            {/* Step icon */}
            <div className="relative z-10 flex-shrink-0">
              <StepIcon
                isComplete={step.isComplete}
                isCurrent={step.isCurrent}
                isFailed={step.isFailed}
              />
            </div>

            {/* Step content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm font-medium',
                    step.isCurrent && 'text-blue-600 dark:text-blue-400',
                    step.isFailed && 'text-red-600 dark:text-red-400',
                    !step.isCurrent && !step.isFailed && 'text-gray-900 dark:text-gray-100'
                  )}
                >
                  {step.label}
                </span>
                {step.isCurrent && !step.isFailed && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                    Current
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {step.description}
              </p>
              {step.timestamp && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1 font-mono">
                  {formatTimestamp(step.timestamp)}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Settlement countdown (only for in-transit batches) */}
      {(batch.status === 'in_transit' || batch.status === 'processing') && batch.expectedSettlementAt && (
        <div
          className={cn(
            'rounded-lg border p-4',
            countdown.isOverdue
              ? 'border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30'
              : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800/50'
          )}
        >
          <div className="flex items-start gap-3">
            {countdown.isOverdue ? (
              <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
            ) : (
              <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
            )}
            <div>
              <p className={cn(
                'text-sm font-medium',
                countdown.isOverdue
                  ? 'text-yellow-800 dark:text-yellow-200'
                  : 'text-gray-700 dark:text-gray-300'
              )}>
                {countdown.isOverdue ? 'Settlement overdue' : 'Expected settlement'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {formatTimestamp(batch.expectedSettlementAt)}
                {' — '}
                <span className={cn(countdown.isOverdue && 'text-yellow-600 dark:text-yellow-400')}>
                  {formatCountdown(countdown)}
                </span>
              </p>
              {countdown.isOverdue && (
                <p className="text-xs text-yellow-700 dark:text-yellow-300 mt-2">
                  Settlement dates are estimates. Delays can occur due to bank holidays,
                  processing backlogs, or manual reviews. Contact support if this persists.
                </p>
              )}
              {!countdown.isOverdue && (
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
                  This is an estimate based on T+{batch.settlementDays} settlement terms.
                  Actual settlement may vary.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Reconciliation notice */}
      {batch.status === 'requires_reconciliation' && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-4 dark:border-red-800 dark:bg-red-950/30">
          <div className="flex items-start gap-3">
            <HelpCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                Manual reconciliation required
              </p>
              <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                The settlement status is unclear. Before marking this batch as settled or failed,
                verify the actual status with the bank. <strong>Do not retry</strong> until the
                current status is confirmed — this could result in duplicate payments.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact status indicator for list views.
 */
interface PayoutStatusBadgeProps {
  status: PayoutStatus;
  attentionLevel: 'none' | 'info' | 'warning' | 'action_required';
}

export function PayoutStatusBadge({ status, attentionLevel }: PayoutStatusBadgeProps) {
  const statusConfig: Record<
    PayoutStatus,
    { label: string; color: string }
  > = {
    pending: { label: 'Pending', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
    processing: { label: 'Processing', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
    in_transit: { label: 'In Transit', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' },
    settled: { label: 'Settled', color: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300' },
    partially_settled: { label: 'Partial', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300' },
    failed: { label: 'Failed', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
    returned: { label: 'Returned', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
    requires_reconciliation: { label: 'Needs Review', color: 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300' },
  };

  const config = statusConfig[status];

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('text-xs font-medium px-2 py-0.5 rounded', config.color)}>
        {config.label}
      </span>
      {attentionLevel === 'action_required' && (
        <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
      )}
      {attentionLevel === 'warning' && (
        <AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />
      )}
    </div>
  );
}
