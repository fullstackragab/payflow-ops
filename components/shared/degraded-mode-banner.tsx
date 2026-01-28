'use client';

/**
 * Degraded Mode Banner.
 *
 * Production rationale:
 * Operators need explicit notification when the system is not fully healthy.
 * This banner appears when:
 * - Some data sources are failing
 * - Data is stale beyond acceptable thresholds
 * - Network connectivity is degraded
 *
 * The message must be actionable: what's broken, what's safe, what to do.
 */

import { Alert, AlertDescription } from '@/components/ui/alert';
import { WifiOff, Clock, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export type DegradedReason =
  | 'partial_outage'   // Some services are down
  | 'stale_data'       // Data is older than acceptable
  | 'high_latency'     // Responses are slow
  | 'offline';         // No network connectivity

interface DegradedModeBannerProps {
  reason: DegradedReason;
  affectedSections?: string[];
  lastSuccessTime?: string;
  onRetry?: () => void;
}

const REASON_CONFIG: Record<
  DegradedReason,
  {
    icon: typeof AlertTriangle;
    title: string;
    description: string;
    className: string;
  }
> = {
  partial_outage: {
    icon: AlertTriangle,
    title: 'Partial Service Outage',
    description: 'Some metrics may be unavailable or outdated. Unaffected data is still live.',
    className: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950/20 dark:border-yellow-900/50 dark:text-yellow-200',
  },
  stale_data: {
    icon: Clock,
    title: 'Data May Be Stale',
    description: 'Unable to refresh data. Showing last known values.',
    className: 'bg-yellow-50 border-yellow-200 text-yellow-900 dark:bg-yellow-950/20 dark:border-yellow-900/50 dark:text-yellow-200',
  },
  high_latency: {
    icon: Clock,
    title: 'Slow Response Times',
    description: 'Data sources are responding slowly. Some metrics may be delayed.',
    className: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/20 dark:border-blue-900/50 dark:text-blue-200',
  },
  offline: {
    icon: WifiOff,
    title: 'Network Offline',
    description: 'No network connection. Showing cached data where available.',
    className: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-200',
  },
};

export function DegradedModeBanner({
  reason,
  affectedSections,
  lastSuccessTime,
  onRetry,
}: DegradedModeBannerProps) {
  const config = REASON_CONFIG[reason];
  const Icon = config.icon;

  return (
    <Alert className={cn(config.className, 'border')}>
      <div className="flex items-start gap-3">
        <Icon className="h-4 w-4 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <AlertDescription className="text-sm">
            <span className="font-medium">{config.title}:</span>{' '}
            {config.description}
            {affectedSections && affectedSections.length > 0 && (
              <span className="block mt-1 text-xs opacity-80">
                Affected: {affectedSections.join(', ')}
              </span>
            )}
            {lastSuccessTime && (
              <span className="block mt-1 text-xs opacity-80">
                Last successful update: {lastSuccessTime}
              </span>
            )}
          </AlertDescription>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-2 text-xs underline hover:no-underline"
            >
              Retry now
            </button>
          )}
        </div>
      </div>
    </Alert>
  );
}
