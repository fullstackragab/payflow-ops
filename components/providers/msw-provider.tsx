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
      // Only initialize in development
      if (process.env.NODE_ENV !== 'development') {
        setIsReady(true);
        return;
      }

      // Dynamic import to avoid bundling MSW in production
      const { startMockServiceWorker } = await import('@/lib/mocks/browser');
      await startMockServiceWorker();
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
