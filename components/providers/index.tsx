'use client';

/**
 * Combined providers wrapper.
 *
 * Order matters:
 * 1. MSWProvider - Must initialize mocks before any data fetching
 * 2. ThemeProvider - Provides theme context
 * 3. QueryProvider - TanStack Query for data fetching
 */

import { type ReactNode } from 'react';
import { MSWProvider } from './msw-provider';
import { ThemeProvider } from './theme-provider';
import { QueryProvider } from './query-provider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <MSWProvider>
      <ThemeProvider>
        <QueryProvider>{children}</QueryProvider>
      </ThemeProvider>
    </MSWProvider>
  );
}

export { useTheme } from './theme-provider';
