'use client';

/**
 * MSW initialization component.
 *
 * Production rationale:
 * This component handles the async initialization of MSW.
 * It suspends rendering until MSW is ready, preventing race conditions
 * where components try to fetch before mocks are registered.
 *
 * In production builds without mocking, this is a no-op.
 */

import { useEffect, useState, type ReactNode } from 'react';

export function MSWProvider({ children }: { children: ReactNode }) {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function initMSW() {
      // Initialize in development or when explicitly enabled for demo deployments
      const shouldMock =
        process.env.NODE_ENV === 'development' ||
        process.env.NEXT_PUBLIC_ENABLE_MOCKS === 'true';

      if (!shouldMock) {
        setIsReady(true);
        return;
      }

      try {
        // Dynamic import MSW
        const { startMockServiceWorker } = await import('@/lib/mocks/browser');
        await startMockServiceWorker();
      } catch (error) {
        // MSW failed to start - continue without it
        // Next.js API routes will handle requests as fallback
        console.warn('[MSW] Failed to start, falling back to API routes:', error);
      }
      setIsReady(true);
    }

    initMSW();
  }, []);

  // Show nothing while MSW initializes
  // In production, this will be instant (isReady set immediately)
  if (!isReady) {
    return null;
  }

  return <>{children}</>;
}
