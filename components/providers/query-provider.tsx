'use client';

/**
 * TanStack Query provider.
 *
 * Production rationale:
 * - Query client is created inside useState to ensure it's created once per client
 * - Default staleTime of 0 means data is considered stale immediately (ops dashboards
 *   need fresh data)
 * - gcTime (formerly cacheTime) of 5 minutes keeps data around for back navigation
 * - refetchOnWindowFocus is enabled for ops dashboards (want fresh data when returning)
 * - retry is set to 1 (API client handles its own retries with backoff)
 */

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 0, // Consider data stale immediately
            gcTime: 5 * 60 * 1000, // 5 minutes
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1, // Single retry (API client has its own retry logic)
            retryDelay: 1000,
          },
          mutations: {
            retry: 0, // No automatic retries for mutations
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
