/**
 * Payout data hooks using TanStack Query.
 *
 * Design decisions:
 *
 * 1. LONGER STALE TIME
 *    Payouts don't change as frequently as transactions. We use longer
 *    stale times to reduce unnecessary refetches.
 *
 * 2. NO AUTOMATIC REFETCH ON WINDOW FOCUS
 *    Settlement status doesn't change in real-time. Constant refetching
 *    creates false urgency and wastes bandwidth.
 *
 * 3. COUNTDOWN CALCULATION ON CLIENT
 *    The server provides expectedSettlementAt. The client calculates
 *    the countdown to avoid server round-trips for time updates.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import type { PayoutBatch, PayoutStatus, ApiResponse } from '@/lib/types';

interface PayoutListParams {
  status?: PayoutStatus;
  needsAttention?: boolean;
}

interface PayoutSummary {
  total: number;
  pending: number;
  inTransit: number;
  needsAttention: number;
  totalPendingAmount: number;
}

interface SettlementCountdown {
  hoursRemaining: number;
  isOverdue: boolean;
}

/**
 * Query keys for payouts.
 */
export const payoutKeys = {
  all: ['payouts'] as const,
  lists: () => [...payoutKeys.all, 'list'] as const,
  list: (params: PayoutListParams) => [...payoutKeys.lists(), params] as const,
  details: () => [...payoutKeys.all, 'detail'] as const,
  detail: (id: string) => [...payoutKeys.details(), id] as const,
};

/**
 * Fetch list of payout batches.
 */
export function usePayouts(params: PayoutListParams = {}) {
  return useQuery({
    queryKey: payoutKeys.list(params),
    queryFn: async ({ signal }) => {
      const searchParams = new URLSearchParams();
      if (params.status) searchParams.set('status', params.status);
      if (params.needsAttention) searchParams.set('needsAttention', 'true');

      const url = `/payouts${searchParams.toString() ? `?${searchParams}` : ''}`;
      return apiClient.get<PayoutBatch[]>(url, { signal }) as Promise<
        ApiResponse<PayoutBatch[]> & { summary: PayoutSummary }
      >;
    },
    staleTime: 60000, // Consider stale after 1 minute (payouts are slower-moving)
    refetchOnWindowFocus: false, // Don't refetch constantly
  });
}

/**
 * Fetch single payout batch with details.
 */
export function usePayout(id: string | null) {
  return useQuery({
    queryKey: payoutKeys.detail(id || ''),
    queryFn: async ({ signal }) => {
      if (!id) throw new Error('Payout ID is required');
      return apiClient.get<PayoutBatch>(`/payouts/${id}`, { signal }) as Promise<
        ApiResponse<PayoutBatch> & { countdown: SettlementCountdown }
      >;
    },
    enabled: !!id,
    staleTime: 30000, // Detail pages can be slightly more stale
  });
}

/**
 * Reconcile a payout batch.
 *
 * This is the manual reconciliation action. Operators use this after
 * verifying the true settlement status with the bank.
 *
 * WARNING: This is a destructive action that changes financial records.
 * The operator must be certain of the resolved status.
 */
export function useReconcilePayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      payoutId,
      resolvedStatus,
      notes,
      settledAmount,
    }: {
      payoutId: string;
      resolvedStatus: PayoutStatus;
      notes: string;
      settledAmount?: number;
    }) => {
      return apiClient.post<PayoutBatch>(`/payouts/${payoutId}/reconcile`, {
        resolvedStatus,
        notes,
        settledAmount,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payoutKeys.detail(variables.payoutId) });
    },
  });
}

/**
 * Simulate payout progress (demo only).
 */
export function useSimulatePayout() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      payoutId,
      outcome,
    }: {
      payoutId: string;
      outcome: 'progress' | 'settle' | 'partial_fail' | 'fail' | 'delay' | 'need_recon';
    }) => {
      return apiClient.post<PayoutBatch>(`/payouts/${payoutId}/simulate`, {
        outcome,
      });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: payoutKeys.lists() });
      queryClient.invalidateQueries({ queryKey: payoutKeys.detail(variables.payoutId) });
    },
  });
}

/**
 * Calculate settlement countdown on the client.
 * Updates automatically without server round-trips.
 */
export function calculateCountdown(expectedSettlementAt: string | null): SettlementCountdown {
  if (!expectedSettlementAt) {
    return { hoursRemaining: 0, isOverdue: false };
  }

  const expected = new Date(expectedSettlementAt).getTime();
  const now = Date.now();
  const diff = expected - now;
  const hoursRemaining = Math.floor(diff / (1000 * 60 * 60));

  return {
    hoursRemaining: Math.max(0, hoursRemaining),
    isOverdue: diff < 0,
  };
}

/**
 * Format countdown for display.
 */
export function formatCountdown(countdown: SettlementCountdown): string {
  if (countdown.isOverdue) {
    return 'Overdue';
  }

  const hours = countdown.hoursRemaining;
  if (hours < 24) {
    return `${hours}h remaining`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  if (remainingHours === 0) {
    return `${days}d remaining`;
  }
  return `${days}d ${remainingHours}h remaining`;
}
