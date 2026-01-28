/**
 * MSW browser setup.
 *
 * Production rationale:
 * MSW intercepts requests at the network level using a Service Worker.
 * This provides realistic testing because:
 * - The browser's Network tab shows the requests
 * - Request timing is visible
 * - Failure scenarios are indistinguishable from real failures
 *
 * This file is only imported in development/demo environments.
 */

import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

/**
 * Start MSW with configuration.
 * Call this from your app initialization.
 */
export async function startMockServiceWorker(): Promise<void> {
  // Only start in browser environment
  if (typeof window === 'undefined') {
    return;
  }

  // Only start in development or when explicitly enabled
  const shouldMock =
    process.env.NODE_ENV === 'development' ||
    process.env.NEXT_PUBLIC_ENABLE_MOCKS === 'true';

  if (!shouldMock) {
    return;
  }

  await worker.start({
    onUnhandledRequest: 'bypass', // Don't warn about unhandled requests
    serviceWorker: {
      url: '/mockServiceWorker.js',
    },
  });

  console.log('[MSW] Mock Service Worker started');
}
