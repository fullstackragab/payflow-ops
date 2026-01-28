/**
 * Payment data hooks using TanStack Query.
 *
 * Design decisions:
 *
 * 1. QUERY INVALIDATION STRATEGY
 *    After mutations, we invalidate the payment list AND the specific payment.
 *    This ensures both views stay in sync without manual cache updates.
 *
 * 2. OPTIMISTIC UPDATES AVOIDED
 *    For financial data, we don't do optimistic updates. The server is the
 *    source of truth. We wait for confirmation before showing state changes.
 *
 * 3. IDEMPOTENCY KEY GENERATION
 *    The client generates the idempotency key before the request.
 *    This ensures the key exists even if the request times out and retries.
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { generateIdempotencyKey } from '@/lib/utils/idempotency';
import type { Payment, PaymentStatus, ApiResponse } from '@/lib/types';

interface PaymentMeta {
  page: number;
  pageSize: number;
  total: number;
  hasMore: boolean;
}

interface PaymentListParams {
  page?: number;
  pageSize?: number;
  status?: PaymentStatus;
}

/**
 * Query keys for payments.
 */
export const paymentKeys = {
  all: ['payments'] as const,
  lists: () => [...paymentKeys.all, 'list'] as const,
  list: (params: PaymentListParams) => [...paymentKeys.lists(), params] as const,
  details: () => [...paymentKeys.all, 'detail'] as const,
  detail: (id: string) => [...paymentKeys.details(), id] as const,
};

/**
 * Fetch list of payments.
 */
export function usePayments(params: PaymentListParams = {}) {
  return useQuery({
    queryKey: paymentKeys.list(params),
    queryFn: async ({ signal }) => {
      const searchParams = new URLSearchParams();
      if (params.page) searchParams.set('page', params.page.toString());
      if (params.pageSize) searchParams.set('pageSize', params.pageSize.toString());
      if (params.status) searchParams.set('status', params.status);

      const url = `/payments${searchParams.toString() ? `?${searchParams}` : ''}`;
      // Response includes data, freshness, and meta
      return apiClient.get<Payment[]>(url, { signal }) as Promise<ApiResponse<Payment[]> & { meta: PaymentMeta }>;
    },
    staleTime: 10000, // Consider stale after 10 seconds
    refetchOnWindowFocus: true,
  });
}

/**
 * Fetch single payment by ID.
 */
export function usePayment(id: string | null) {
  return useQuery({
    queryKey: paymentKeys.detail(id || ''),
    queryFn: async ({ signal }) => {
      if (!id) throw new Error('Payment ID is required');
      return apiClient.get<Payment>(`/payments/${id}`, { signal });
    },
    enabled: !!id,
    staleTime: 5000,
  });
}

/**
 * Create a new payment.
 *
 * The idempotency key is generated automatically and stored for potential retries.
 */
export function useCreatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: {
      amount: number;
      currency?: string;
      merchantId: string;
      intent?: 'capture' | 'authorize_only';
      customerId?: string;
      description?: string;
      metadata?: Record<string, string>;
    }) => {
      const idempotencyKey = generateIdempotencyKey();

      return apiClient.post<Payment>('/payments', request, {
        headers: {
          'Idempotency-Key': idempotencyKey,
        },
      });
    },
    onSuccess: () => {
      // Invalidate payment list to refetch
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
    },
  });
}

/**
 * Transition a payment to a new status.
 */
export function useTransitionPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      targetStatus,
      expectedVersion,
      reason,
      failureCode,
      failureMessage,
    }: {
      paymentId: string;
      targetStatus: PaymentStatus;
      expectedVersion?: number;
      reason?: string;
      failureCode?: string;
      failureMessage?: string;
    }) => {
      return apiClient.post<Payment>(
        `/payments/${paymentId}/transition`,
        {
          targetStatus,
          expectedVersion,
          reason,
          failureCode,
          failureMessage,
        }
      ) as Promise<ApiResponse<Payment> & { transition?: { from: PaymentStatus; to: PaymentStatus; action?: string; sideEffects?: string[] } }>;
    },
    onSuccess: (_, variables) => {
      // Invalidate both the list and the specific payment
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(variables.paymentId) });
    },
  });
}

/**
 * Submit a draft payment for processing.
 */
export function useSubmitPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      return apiClient.post<Payment>(`/payments/${paymentId}/submit`, {});
    },
    onSuccess: (_, paymentId) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(paymentId) });
    },
  });
}

/**
 * Cancel a payment.
 */
export function useCancelPayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (paymentId: string) => {
      return apiClient.post<Payment>(`/payments/${paymentId}/cancel`, {});
    },
    onSuccess: (_, paymentId) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(paymentId) });
    },
  });
}

/**
 * Simulate a processor outcome (demo only).
 */
export function useSimulatePayment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      paymentId,
      outcome,
      failureCode,
      failureMessage,
    }: {
      paymentId: string;
      outcome: 'succeed' | 'fail' | 'require_action';
      failureCode?: string;
      failureMessage?: string;
    }) => {
      return apiClient.post<Payment>(
        `/payments/${paymentId}/simulate`,
        {
          outcome,
          failureCode,
          failureMessage,
        }
      );
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: paymentKeys.lists() });
      queryClient.invalidateQueries({ queryKey: paymentKeys.detail(variables.paymentId) });
    },
  });
}
