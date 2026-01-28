'use client';

/**
 * Payment Transition Actions.
 *
 * Shows buttons for valid state transitions based on current payment status.
 *
 * Design decisions:
 * 1. Only show valid actions (state machine enforced)
 * 2. Destructive actions (fail, cancel) require confirmation
 * 3. Loading state during transitions prevents double-submit
 * 4. Error messages explain why transitions failed
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/lib/utils/cn';
import { getValidTransitions, getTransition } from '@/lib/state-machines/payment-lifecycle';
import { useTransitionPayment, useSubmitPayment, useCancelPayment, useSimulatePayment } from '@/lib/hooks/use-payments';
import type { Payment, PaymentStatus } from '@/lib/types';
import { AlertTriangle, ArrowRight, Play, X, CheckCircle, XCircle, Clock } from 'lucide-react';

interface TransitionActionsProps {
  payment: Payment;
  onTransitionComplete?: (newPayment: Payment) => void;
}

export function TransitionActions({ payment, onTransitionComplete }: TransitionActionsProps) {
  const [error, setError] = useState<string | null>(null);
  const [confirmingAction, setConfirmingAction] = useState<string | null>(null);

  const submitMutation = useSubmitPayment();
  const cancelMutation = useCancelPayment();
  const transitionMutation = useTransitionPayment();
  const simulateMutation = useSimulatePayment();

  const validTransitions = getValidTransitions(payment.status);
  const isLoading =
    submitMutation.isPending ||
    cancelMutation.isPending ||
    transitionMutation.isPending ||
    simulateMutation.isPending;

  const handleTransition = async (targetStatus: PaymentStatus) => {
    setError(null);
    const transition = getTransition(payment.status, targetStatus);

    try {
      // Use specific mutation based on action
      if (payment.status === 'draft' && targetStatus === 'submitted') {
        const result = await submitMutation.mutateAsync(payment.id);
        onTransitionComplete?.(result.data);
      } else if (targetStatus === 'canceled') {
        const result = await cancelMutation.mutateAsync(payment.id);
        onTransitionComplete?.(result.data);
      } else {
        const result = await transitionMutation.mutateAsync({
          paymentId: payment.id,
          targetStatus,
        });
        onTransitionComplete?.(result.data);
      }

      setConfirmingAction(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Transition failed';
      setError(errorMessage);
    }
  };

  const handleSimulate = async (outcome: 'succeed' | 'fail' | 'require_action') => {
    setError(null);

    try {
      const result = await simulateMutation.mutateAsync({
        paymentId: payment.id,
        outcome,
        failureCode: outcome === 'fail' ? 'processor_declined' : undefined,
        failureMessage: outcome === 'fail' ? 'Simulated processor decline' : undefined,
      });
      onTransitionComplete?.(result.data);
      setConfirmingAction(null);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Simulation failed';
      setError(errorMessage);
    }
  };

  // Group actions by type
  const submitAction = validTransitions.find((t) => t.to === 'submitted');
  const cancelAction = validTransitions.find((t) => t.to === 'canceled');
  const otherActions = validTransitions.filter(
    (t) => t.to !== 'submitted' && t.to !== 'canceled'
  );

  // Can simulate processor response?
  const canSimulate =
    payment.status === 'processing' || payment.status === 'submitted';

  if (validTransitions.length === 0 && !canSimulate) {
    return (
      <div className="text-sm text-gray-500 dark:text-gray-400">
        No actions available — payment is in terminal state
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Error display */}
      {error && (
        <Alert variant="destructive">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">Action failed</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        </Alert>
      )}

      {/* Primary actions */}
      <div className="flex flex-wrap gap-2">
        {/* Submit action (primary CTA when in draft) */}
        {submitAction && (
          <Button
            onClick={() => handleTransition('submitted')}
            disabled={isLoading}
            className="gap-2"
          >
            <Play className="h-4 w-4" />
            {submitAction.action}
          </Button>
        )}

        {/* Other transition actions */}
        {otherActions.map((transition) => (
          <Button
            key={transition.to}
            variant="outline"
            onClick={() => handleTransition(transition.to)}
            disabled={isLoading}
            className="gap-2"
          >
            <ArrowRight className="h-4 w-4" />
            {transition.action}
          </Button>
        ))}

        {/* Cancel action (destructive) */}
        {cancelAction && (
          <>
            {confirmingAction === 'cancel' ? (
              <div className="flex items-center gap-2 p-2 rounded border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/20">
                <span className="text-sm text-red-700 dark:text-red-300">
                  Cancel this payment?
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleTransition('canceled')}
                  disabled={isLoading}
                  className="border-red-300 text-red-700 hover:bg-red-100 dark:border-red-700 dark:text-red-300"
                >
                  Yes, cancel
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmingAction(null)}
                  disabled={isLoading}
                >
                  No
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setConfirmingAction('cancel')}
                disabled={isLoading}
                className="gap-2 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/20"
              >
                <X className="h-4 w-4" />
                {cancelAction.action}
              </Button>
            )}
          </>
        )}
      </div>

      {/* Simulation actions (demo only) */}
      {canSimulate && (
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
            Simulate processor response (demo only):
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSimulate('succeed')}
              disabled={isLoading}
              className="gap-1.5 text-green-600 border-green-200 hover:bg-green-50 dark:text-green-400 dark:border-green-800 dark:hover:bg-green-950/20"
            >
              <CheckCircle className="h-3.5 w-3.5" />
              Succeed
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSimulate('fail')}
              disabled={isLoading}
              className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/20"
            >
              <XCircle className="h-3.5 w-3.5" />
              Fail
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSimulate('require_action')}
              disabled={isLoading}
              className="gap-1.5 text-yellow-600 border-yellow-200 hover:bg-yellow-50 dark:text-yellow-400 dark:border-yellow-800 dark:hover:bg-yellow-950/20"
            >
              <Clock className="h-3.5 w-3.5" />
              Require Action
            </Button>
          </div>
        </div>
      )}

      {/* Transition side effects warning */}
      {validTransitions.some((t) => t.isDestructive) && (
        <p className="text-xs text-gray-500 dark:text-gray-400 flex items-start gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0 text-yellow-500" />
          Some actions have irreversible consequences. Check the transition details before proceeding.
        </p>
      )}
    </div>
  );
}

/**
 * Displays details about a specific transition.
 */
interface TransitionDetailsProps {
  from: PaymentStatus;
  to: PaymentStatus;
}

export function TransitionDetails({ from, to }: TransitionDetailsProps) {
  const transition = getTransition(from, to);

  if (!transition) {
    return (
      <div className="text-sm text-red-600 dark:text-red-400">
        Invalid transition: {from} → {to}
      </div>
    );
  }

  return (
    <div className="space-y-2 text-sm">
      <div className="flex items-center gap-2">
        <span className="font-medium">{transition.action}</span>
        {transition.isDestructive && (
          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300">
            Irreversible
          </span>
        )}
      </div>
      <p className="text-gray-600 dark:text-gray-400">{transition.description}</p>

      {transition.sideEffects.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
            Side effects:
          </p>
          <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
            {transition.sideEffects.map((effect, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="text-gray-400">•</span>
                {effect}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
