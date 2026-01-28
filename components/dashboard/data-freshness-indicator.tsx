'use client';

import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatFreshness, type FreshnessStatus } from '@/lib/utils/time';

interface DataFreshnessIndicatorProps {
  timestamp: string;
  source?: 'live' | 'cache' | 'fallback';
}

/**
 * Data freshness indicator.
 *
 * Production rationale:
 * Operators need to know if they're looking at live data or stale cache.
 * This indicator shows:
 * - Live (green) = data fetched within threshold
 * - Delayed (yellow) = data is stale but recent
 * - Stale (red) = data is significantly outdated
 *
 * The source label helps distinguish between real-time updates and cached data.
 */
export function DataFreshnessIndicator({
  timestamp,
  source = 'live',
}: DataFreshnessIndicatorProps) {
  const { label, status } = formatFreshness(timestamp);

  const getStatusColor = (): string => {
    const colors: Record<FreshnessStatus, string> = {
      fresh: 'text-green-600 dark:text-green-500',
      stale: 'text-yellow-600 dark:text-yellow-500',
      critical: 'text-red-600 dark:text-red-500',
    };
    return colors[status];
  };

  const getStatusText = (): string => {
    if (source === 'fallback') return 'Fallback';
    if (source === 'cache') return 'Cached';
    if (status === 'fresh') return 'Live';
    if (status === 'stale') return 'Delayed';
    return 'Stale';
  };

  return (
    <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
      <Circle
        className={cn(
          'h-2 w-2 fill-current',
          getStatusColor(),
          status === 'fresh' && source === 'live' && 'animate-pulse'
        )}
      />
      <span className={getStatusColor()}>{getStatusText()}</span>
      <span className="text-gray-500">· Updated {label}</span>
    </div>
  );
}
