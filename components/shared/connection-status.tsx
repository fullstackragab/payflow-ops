'use client';

/**
 * Connection Status Indicator.
 *
 * Production rationale:
 * In operations dashboards, operators must know their connection state.
 * A disconnected operator making decisions on stale data is dangerous.
 *
 * This component shows:
 * - Connected (green) — Real-time data flowing
 * - Reconnecting (yellow) — Temporarily disconnected, auto-reconnecting
 * - Offline (red) — No connection, showing cached data
 */

import { useEffect, useState } from 'react';
import { Circle, Wifi, WifiOff, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

type ConnectionState = 'connected' | 'reconnecting' | 'offline';

interface ConnectionStatusProps {
  className?: string;
}

export function ConnectionStatus({ className }: ConnectionStatusProps) {
  const [state, setState] = useState<ConnectionState>('connected');

  useEffect(() => {
    const handleOnline = () => setState('connected');
    const handleOffline = () => setState('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial state
    if (!navigator.onLine) {
      setState('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const config = {
    connected: {
      icon: Wifi,
      label: 'Connected',
      className: 'text-green-600 dark:text-green-500',
      dotClassName: 'bg-green-500',
    },
    reconnecting: {
      icon: Loader2,
      label: 'Reconnecting...',
      className: 'text-yellow-600 dark:text-yellow-500',
      dotClassName: 'bg-yellow-500',
    },
    offline: {
      icon: WifiOff,
      label: 'Offline',
      className: 'text-red-600 dark:text-red-500',
      dotClassName: 'bg-red-500',
    },
  }[state];

  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-xs',
        config.className,
        className
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          config.dotClassName,
          state === 'connected' && 'animate-pulse'
        )}
      />
      <span>{config.label}</span>
    </div>
  );
}

/**
 * Hook to get connection state.
 * Useful when you need to react to connection changes in logic.
 */
export function useConnectionState(): ConnectionState {
  const [state, setState] = useState<ConnectionState>('connected');

  useEffect(() => {
    const handleOnline = () => setState('connected');
    const handleOffline = () => setState('offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!navigator.onLine) {
      setState('offline');
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return state;
}
