/**
 * Time and freshness utilities.
 *
 * Production rationale:
 * - Data freshness is critical in operations dashboards.
 * - Operators need to know if they're looking at live data or stale cache.
 * - Relative times help quick comprehension ("3s ago" vs "2024-01-15T10:30:45Z").
 */

import { formatDistanceToNow, differenceInMilliseconds, parseISO } from 'date-fns';

/**
 * Format an ISO timestamp as relative time.
 * @param isoString - ISO 8601 timestamp
 * @returns Human-readable relative time (e.g., "3 seconds ago")
 */
export function formatRelativeTime(isoString: string): string {
  try {
    const date = parseISO(isoString);
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

/**
 * Get milliseconds since a timestamp.
 */
export function getAgeMs(isoString: string): number {
  try {
    const date = parseISO(isoString);
    return differenceInMilliseconds(new Date(), date);
  } catch {
    return Infinity;
  }
}

/**
 * Determine data freshness status based on age.
 * Thresholds are domain-specific and should match SLOs.
 */
export type FreshnessStatus = 'fresh' | 'stale' | 'critical';

export interface FreshnessConfig {
  freshThresholdMs: number; // Below this = fresh
  staleThresholdMs: number; // Above this = critical
}

const DEFAULT_FRESHNESS_CONFIG: FreshnessConfig = {
  freshThresholdMs: 5_000, // 5 seconds
  staleThresholdMs: 30_000, // 30 seconds
};

export function getFreshnessStatus(
  isoString: string,
  config: FreshnessConfig = DEFAULT_FRESHNESS_CONFIG
): FreshnessStatus {
  const ageMs = getAgeMs(isoString);

  if (ageMs < config.freshThresholdMs) {
    return 'fresh';
  }
  if (ageMs < config.staleThresholdMs) {
    return 'stale';
  }
  return 'critical';
}

/**
 * Format freshness for display.
 * Returns both the relative time and the status indicator.
 */
export function formatFreshness(isoString: string): {
  label: string;
  status: FreshnessStatus;
  ageMs: number;
} {
  const ageMs = getAgeMs(isoString);
  const status = getFreshnessStatus(isoString);

  let label: string;
  if (ageMs < 1000) {
    label = 'Just now';
  } else if (ageMs < 60_000) {
    label = `${Math.floor(ageMs / 1000)}s ago`;
  } else if (ageMs < 3_600_000) {
    label = `${Math.floor(ageMs / 60_000)}m ago`;
  } else {
    label = formatRelativeTime(isoString);
  }

  return { label, status, ageMs };
}

/**
 * Format a duration in milliseconds to human-readable format.
 * Used for latency display.
 */
export function formatDuration(ms: number): string {
  if (ms < 1) {
    return '<1ms';
  }
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  if (ms < 3_600_000) {
    const minutes = Math.floor(ms / 60_000);
    const seconds = Math.floor((ms % 60_000) / 1000);
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
  }
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

/**
 * Format a timestamp for table display.
 * Shows time only for today, date+time for older entries.
 */
export function formatTimestamp(isoString: string): string {
  try {
    const date = parseISO(isoString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
    }

    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return 'Invalid';
  }
}
