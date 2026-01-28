'use client';

/**
 * Independent KPI Card - fetches its own data.
 *
 * Production rationale:
 * Each KPI card is responsible for its own data fetching. This means:
 * - One slow/failed metric doesn't block others
 * - Each card shows its own loading/error/stale state
 * - Refresh can happen independently per card
 * - Failure isolation is built into the UI
 *
 * This is how production dashboards at Stripe, Datadog, etc. work.
 * A metrics service outage shouldn't take down your entire dashboard.
 */

import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowDown, ArrowUp, Minus, RefreshCw, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { formatFreshness } from '@/lib/utils/time';
import type { ApiResponse } from '@/lib/types';

interface IndependentKPICardProps<T> {
  title: string;
  queryKey: string[];
  queryFn: () => Promise<ApiResponse<T>>;
  getValue: (data: T) => string;
  getChange?: (data: T) => number | undefined;
  getStatus?: (data: T) => 'good' | 'bad' | 'neutral';
  getSubtitle?: (data: T) => string | undefined;
  changeLabel?: string;
  refetchInterval?: number;
}

export function IndependentKPICard<T>({
  title,
  queryKey,
  queryFn,
  getValue,
  getChange,
  getStatus,
  getSubtitle,
  changeLabel = 'vs target',
  refetchInterval = 10000,
}: IndependentKPICardProps<T>) {
  const {
    data: response,
    isLoading,
    isError,
    error,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey,
    queryFn,
    refetchInterval,
    // Keep previous data while refetching (stale-while-revalidate)
    placeholderData: (previousData) => previousData,
    // Don't throw - we handle errors in UI
    throwOnError: false,
  });

  const data = response?.data;
  const freshness = response?.freshness;

  // Determine staleness from freshness metadata
  const freshnessInfo = freshness ? formatFreshness(freshness.timestamp) : null;
  const isStale = freshnessInfo?.status !== 'fresh';
  const isCached = freshness?.source === 'cache' || freshness?.source === 'fallback';

  // Get derived values
  const value = data ? getValue(data) : '-';
  const change = data && getChange ? getChange(data) : undefined;
  const status = data && getStatus ? getStatus(data) : undefined;
  const subtitle = data && getSubtitle ? getSubtitle(data) : undefined;

  const getTrendIcon = () => {
    if (change === undefined || change === null) return null;
    if (change > 0) return <ArrowUp className="h-3 w-3" />;
    if (change < 0) return <ArrowDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (!status) return 'text-gray-500';
    if (status === 'good') return 'text-green-600 dark:text-green-500';
    if (status === 'bad') return 'text-red-600 dark:text-red-500';
    return 'text-gray-500';
  };

  // Loading skeleton
  if (isLoading && !data) {
    return (
      <Card className="p-4">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
      </Card>
    );
  }

  // Error state (but might have stale data)
  if (isError && !data) {
    return (
      <Card className="p-4 border-red-200 dark:border-red-900/50">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600 dark:text-gray-400">{title}</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">Failed to load</span>
          </div>
          <button
            onClick={() => refetch()}
            className="text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 underline text-left"
          >
            Retry
          </button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        'p-4 transition-colors',
        isStale && 'border-yellow-200 dark:border-yellow-900/50',
        isError && data && 'border-red-200 dark:border-red-900/50'
      )}
    >
      <div className="flex flex-col gap-2">
        {/* Header with title and refresh */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-gray-400">{title}</span>
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 w-6 p-0', isFetching && 'animate-spin')}
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>

        {/* Value */}
        <div className="text-2xl tracking-tight text-gray-900 dark:text-gray-100">
          {value}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div className="text-xs text-gray-500 dark:text-gray-500">{subtitle}</div>
        )}

        {/* Change indicator */}
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs', getTrendColor())}>
            {getTrendIcon()}
            <span>{Math.abs(change).toFixed(1)}%</span>
            <span className="text-gray-500 dark:text-gray-500">{changeLabel}</span>
          </div>
        )}

        {/* Freshness indicator */}
        {freshnessInfo && (
          <div
            className={cn(
              'flex items-center gap-1 text-xs',
              freshnessInfo.status === 'fresh' && 'text-gray-400',
              freshnessInfo.status === 'stale' && 'text-yellow-600 dark:text-yellow-500',
              freshnessInfo.status === 'critical' && 'text-red-600 dark:text-red-500'
            )}
          >
            {isCached && <span className="font-medium">Cached</span>}
            <span>· {freshnessInfo.label}</span>
            {isError && <span className="text-red-500">· Refresh failed</span>}
          </div>
        )}
      </div>
    </Card>
  );
}
