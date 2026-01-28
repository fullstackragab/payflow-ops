'use client';

/**
 * Payment Lifecycle Diagram.
 *
 * Visual representation of the payment state machine.
 * Shows current state and available transitions.
 *
 * Design decisions:
 * 1. Static layout (not dynamic graph) for predictability
 * 2. Current state highlighted, valid transitions shown as active paths
 * 3. Terminal states visually distinct (no outgoing arrows)
 */

import { cn } from '@/lib/utils/cn';
import { getValidTransitions, isTerminalStatus, STATUS_METADATA } from '@/lib/state-machines/payment-lifecycle';
import type { PaymentStatus } from '@/lib/types';

interface LifecycleDiagramProps {
  currentStatus: PaymentStatus;
  className?: string;
}

interface StateNodeProps {
  status: PaymentStatus;
  isCurrent: boolean;
  isReachable: boolean;
  isTerminal: boolean;
}

function StateNode({ status, isCurrent, isReachable, isTerminal }: StateNodeProps) {
  const meta = STATUS_METADATA[status];

  return (
    <div
      className={cn(
        'rounded-md border px-3 py-1.5 text-xs font-medium transition-all',
        // Current state
        isCurrent && 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-900',
        // Color based on status
        meta.color === 'gray' && 'border-gray-300 bg-gray-100 text-gray-700 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300',
        meta.color === 'blue' && 'border-blue-300 bg-blue-100 text-blue-700 dark:border-blue-600 dark:bg-blue-900/50 dark:text-blue-300',
        meta.color === 'yellow' && 'border-yellow-300 bg-yellow-100 text-yellow-700 dark:border-yellow-600 dark:bg-yellow-900/50 dark:text-yellow-300',
        meta.color === 'green' && 'border-green-300 bg-green-100 text-green-700 dark:border-green-600 dark:bg-green-900/50 dark:text-green-300',
        meta.color === 'red' && 'border-red-300 bg-red-100 text-red-700 dark:border-red-600 dark:bg-red-900/50 dark:text-red-300',
        // Reachable (next valid state)
        isReachable && !isCurrent && 'ring-1 ring-blue-400/50',
        // Terminal state styling
        isTerminal && 'border-2',
        // Dimmed if not current and not reachable
        !isCurrent && !isReachable && 'opacity-50'
      )}
    >
      {meta.label}
    </div>
  );
}

export function LifecycleDiagram({ currentStatus, className }: LifecycleDiagramProps) {
  const validTransitions = getValidTransitions(currentStatus);
  const reachableStatuses = new Set(validTransitions.map((t) => t.to));

  return (
    <div className={cn('relative', className)}>
      {/* Diagram grid */}
      <div className="relative flex flex-col gap-3">
        {/* Row 1: draft */}
        <div className="flex justify-center">
          <StateNode
            status="draft"
            isCurrent={currentStatus === 'draft'}
            isReachable={reachableStatuses.has('draft')}
            isTerminal={false}
          />
        </div>

        {/* Arrow down */}
        <div className="flex justify-center">
          <Arrow direction="down" active={currentStatus === 'draft'} />
        </div>

        {/* Row 2: submitted */}
        <div className="flex justify-center">
          <StateNode
            status="submitted"
            isCurrent={currentStatus === 'submitted'}
            isReachable={reachableStatuses.has('submitted')}
            isTerminal={false}
          />
        </div>

        {/* Arrow down */}
        <div className="flex justify-center">
          <Arrow direction="down" active={currentStatus === 'submitted'} />
        </div>

        {/* Row 3: processing with branches */}
        <div className="flex items-center justify-center gap-8">
          <StateNode
            status="canceled"
            isCurrent={currentStatus === 'canceled'}
            isReachable={reachableStatuses.has('canceled')}
            isTerminal={true}
          />
          <StateNode
            status="processing"
            isCurrent={currentStatus === 'processing'}
            isReachable={reachableStatuses.has('processing')}
            isTerminal={false}
          />
          <StateNode
            status="failed"
            isCurrent={currentStatus === 'failed'}
            isReachable={reachableStatuses.has('failed')}
            isTerminal={true}
          />
        </div>

        {/* Arrow down */}
        <div className="flex justify-center">
          <Arrow direction="down" active={currentStatus === 'processing'} />
        </div>

        {/* Row 4: requires_action */}
        <div className="flex justify-center">
          <StateNode
            status="requires_action"
            isCurrent={currentStatus === 'requires_action'}
            isReachable={reachableStatuses.has('requires_action')}
            isTerminal={false}
          />
        </div>

        {/* Arrow down */}
        <div className="flex justify-center">
          <Arrow direction="down" active={currentStatus === 'requires_action'} />
        </div>

        {/* Row 5: succeeded */}
        <div className="flex justify-center">
          <StateNode
            status="succeeded"
            isCurrent={currentStatus === 'succeeded'}
            isReachable={reachableStatuses.has('succeeded')}
            isTerminal={true}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-2 border-blue-500" />
            <span>Current state</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded ring-1 ring-blue-400/50 bg-gray-100 dark:bg-gray-800" />
            <span>Next valid state</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded border-2 bg-gray-100 dark:bg-gray-800 opacity-50" />
            <span>Terminal (no transitions)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Arrow({ direction, active }: { direction: 'down' | 'right'; active?: boolean }) {
  if (direction === 'down') {
    return (
      <svg
        className={cn(
          'w-4 h-4 transition-colors',
          active ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'
        )}
        fill="none"
        viewBox="0 0 16 16"
      >
        <path
          d="M8 2v10M4 9l4 4 4-4"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg
      className={cn(
        'w-4 h-4 transition-colors',
        active ? 'text-blue-500' : 'text-gray-300 dark:text-gray-600'
      )}
      fill="none"
      viewBox="0 0 16 16"
    >
      <path
        d="M2 8h10M9 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Compact inline status indicator with transition info.
 */
interface StatusIndicatorProps {
  status: PaymentStatus;
  showTransitions?: boolean;
}

export function StatusIndicator({ status, showTransitions = false }: StatusIndicatorProps) {
  const meta = STATUS_METADATA[status];
  const validTransitions = getValidTransitions(status);
  const terminal = isTerminalStatus(status);

  return (
    <div className="flex items-center gap-2">
      <div
        className={cn(
          'inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-medium',
          meta.color === 'gray' && 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
          meta.color === 'blue' && 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
          meta.color === 'yellow' && 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
          meta.color === 'green' && 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
          meta.color === 'red' && 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
        )}
      >
        {/* Status dot */}
        <span
          className={cn(
            'w-1.5 h-1.5 rounded-full',
            meta.color === 'gray' && 'bg-gray-400',
            meta.color === 'blue' && 'bg-blue-400',
            meta.color === 'yellow' && 'bg-yellow-400',
            meta.color === 'green' && 'bg-green-400',
            meta.color === 'red' && 'bg-red-400'
          )}
        />
        {meta.label}
      </div>

      {showTransitions && !terminal && validTransitions.length > 0 && (
        <span className="text-xs text-gray-500 dark:text-gray-400">
          {validTransitions.length} action{validTransitions.length !== 1 ? 's' : ''} available
        </span>
      )}

      {showTransitions && terminal && (
        <span className="text-xs text-gray-400 dark:text-gray-500">
          Terminal state
        </span>
      )}
    </div>
  );
}
