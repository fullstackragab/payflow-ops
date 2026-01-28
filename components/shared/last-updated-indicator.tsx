'use client';

/**
 * Last Updated Indicator with Manual Refresh.
 *
 * Production rationale:
 * Operators need to:
 * 1. See when data was last successfully fetched
 * 2. Manually trigger a refresh when they need fresh data
 * 3. Know if a refresh is in progress
 *
 * Auto-refresh is good, but manual refresh gives operators control
 * when they're about to make a decision.
 */

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatFreshness, type FreshnessStatus } from '@/lib/utils/time';

interface LastUpdatedIndicatorProps {
  timestamp: string;
  onRefresh: () => void;
  isRefreshing?: boolean;
  source?: 'live' | 'cache' | 'fallback';
  className?: string;
}

export function LastUpdatedIndicator({
  timestamp,
  onRefresh,
  isRefreshing = false,
  source = 'live',
  className,
}: LastUpdatedIndicatorProps) {
  const { label, status } = formatFreshness(timestamp);

  const statusColors: Record<FreshnessStatus, string> = {
    fresh: 'text-green-600 dark:text-green-500',
    stale: 'text-yellow-600 dark:text-yellow-500',
    critical: 'text-red-600 dark:text-red-500',
  };

  const sourceLabel = {
    live: '',
    cache: 'Cached · ',
    fallback: 'Fallback · ',
  }[source];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className={cn('text-xs', statusColors[status])}>
        {sourceLabel}Updated {label}
      </span>
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs"
        onClick={onRefresh}
        disabled={isRefreshing}
      >
        <RefreshCw
          className={cn('h-3 w-3 mr-1', isRefreshing && 'animate-spin')}
        />
        {isRefreshing ? 'Refreshing...' : 'Refresh'}
      </Button>
    </div>
  );
}
