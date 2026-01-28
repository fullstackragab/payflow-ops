'use client';

/**
 * Stream Status Indicator.
 *
 * Production rationale:
 * Operators must always know:
 * 1. Are we connected to the stream?
 * 2. Is data delayed (buffering/throttling)?
 * 3. Did we miss or drop any events?
 * 4. When did we last receive data?
 *
 * This component surfaces all of this in a compact, scannable format.
 * Red/yellow states demand attention. Green means everything is nominal.
 */

import { Wifi, WifiOff, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import { formatFreshness } from '@/lib/utils/time';
import type { SSEConnectionState } from '@/lib/hooks/use-sse';

interface StreamStatusProps {
  connectionState: SSEConnectionState;
  lastEventAt: string | null;
  reconnectAttempt: number;
  missedEvents: number;
  droppedCount: number;
  bufferSize: number;
  isThrottling: boolean;
  onReconnect: () => void;
  onResetDropped: () => void;
}

export function StreamStatus({
  connectionState,
  lastEventAt,
  reconnectAttempt,
  missedEvents,
  droppedCount,
  bufferSize,
  isThrottling,
  onReconnect,
  onResetDropped,
}: StreamStatusProps) {
  const hasIssues = missedEvents > 0 || droppedCount > 0;
  const totalMissed = missedEvents + droppedCount;

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      {/* Connection status */}
      <ConnectionIndicator
        state={connectionState}
        reconnectAttempt={reconnectAttempt}
        onReconnect={onReconnect}
      />

      {/* Last event time */}
      {lastEventAt && (
        <LastEventIndicator timestamp={lastEventAt} />
      )}

      {/* Backpressure indicator */}
      {(isThrottling || bufferSize > 10) && (
        <div className="flex items-center gap-1 text-yellow-600 dark:text-yellow-500">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span>Buffering ({bufferSize})</span>
        </div>
      )}

      {/* Dropped/missed events */}
      {hasIssues && (
        <div className="flex items-center gap-2">
          <Badge variant="warning" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            {totalMissed} events skipped
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            className="h-5 px-1 text-xs"
            onClick={onResetDropped}
          >
            Clear
          </Button>
        </div>
      )}
    </div>
  );
}

function ConnectionIndicator({
  state,
  reconnectAttempt,
  onReconnect,
}: {
  state: SSEConnectionState;
  reconnectAttempt: number;
  onReconnect: () => void;
}) {
  const config = {
    connecting: {
      icon: Loader2,
      label: 'Connecting...',
      className: 'text-yellow-600 dark:text-yellow-500',
      animate: true,
    },
    connected: {
      icon: Wifi,
      label: 'Live',
      className: 'text-green-600 dark:text-green-500',
      animate: false,
    },
    disconnected: {
      icon: WifiOff,
      label: reconnectAttempt > 0 ? `Reconnecting (${reconnectAttempt})...` : 'Disconnected',
      className: 'text-yellow-600 dark:text-yellow-500',
      animate: reconnectAttempt > 0,
    },
    error: {
      icon: WifiOff,
      label: 'Connection failed',
      className: 'text-red-600 dark:text-red-500',
      animate: false,
    },
  }[state];

  const Icon = config.icon;

  return (
    <div className={cn('flex items-center gap-1.5', config.className)}>
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          state === 'connected' && 'bg-green-500 animate-pulse',
          state === 'connecting' && 'bg-yellow-500',
          state === 'disconnected' && 'bg-yellow-500',
          state === 'error' && 'bg-red-500'
        )}
      />
      <Icon
        className={cn('h-3 w-3', config.animate && 'animate-spin')}
      />
      <span>{config.label}</span>
      {state === 'error' && (
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-2 text-xs ml-1"
          onClick={onReconnect}
        >
          Retry
        </Button>
      )}
    </div>
  );
}

function LastEventIndicator({ timestamp }: { timestamp: string }) {
  const { label, status } = formatFreshness(timestamp);

  // If no event for > 30 seconds while "connected", that's suspicious
  const isStale = status !== 'fresh';

  return (
    <div
      className={cn(
        'flex items-center gap-1',
        isStale ? 'text-yellow-600 dark:text-yellow-500' : 'text-gray-500'
      )}
    >
      <Clock className="h-3 w-3" />
      <span>Last event: {label}</span>
    </div>
  );
}
