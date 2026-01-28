/**
 * Central type exports.
 *
 * Import types from this file to avoid deep import paths.
 * Example: import { Transaction, Payment } from '@/lib/types';
 */

export * from './transaction';
export * from './payment';
export * from './payout';
export * from './incident';
export * from './metrics';

/**
 * Common API response wrapper.
 * All API responses follow this structure for consistency.
 */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    page?: number;
    pageSize?: number;
    total?: number;
    hasMore?: boolean;
  };
  freshness: {
    timestamp: string;
    source: 'live' | 'cache' | 'fallback';
    maxAgeMs: number;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable: boolean;
  retryAfterMs?: number;
}

/**
 * Pagination parameters for list endpoints.
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  cursor?: string; // For cursor-based pagination
}

/**
 * Common filter parameters.
 */
export interface DateRangeFilter {
  from?: string;
  to?: string;
}

export interface TransactionFilters extends PaginationParams, DateRangeFilter {
  status?: string[];
  type?: string[];
  merchantId?: string;
  region?: string;
  minAmount?: number;
  maxAmount?: number;
}
