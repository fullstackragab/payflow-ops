'use client';

/**
 * SSE Hook with Production-Grade Reliability.
 *
 * Design decisions:
 *
 * 1. EXPONENTIAL BACKOFF RECONNECTION
 *    When the connection drops, we reconnect with increasing delays.
 *    This prevents thundering herd on server recovery.
 *    Failure containment: Server isn't overwhelmed by reconnection attempts.
 *
 * 2. EXPLICIT CONNECTION STATE
 *    The hook exposes connecting/connected/disconnected/error states.
 *    Operator trust: They always know if they're seeing live data.
 *
 * 3. SEQUENCE NUMBERS FOR GAP DETECTION
 *    Events include sequence numbers. If we see a gap, we know we missed events.
 *    Operator trust: "You may have missed X events" is better than silent loss.
 *
 * 4. CLEAN UNMOUNT
 *    AbortController ensures the connection is properly closed on unmount.
 *    Failure containment: No zombie connections, no state updates after unmount.
 *
 * 5. LAST EVENT TIMESTAMP
 *    Track when we last received data, separate from connection state.
 *    Operator trust: "Connected but no events for 30s" is suspicious.
 */

import { useEffect, useRef, useCallback, useState } from 'react';

export type SSEConnectionState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error';

export interface SSEState {
  connectionState: SSEConnectionState;
  lastEventAt: string | null;
  reconnectAttempt: number;
  missedEvents: number;
  error: string | null;
}

export interface UseSSEOptions<T> {
  url: string;
  onMessage: (data: T, sequence: number) => void;
  onConnectionChange?: (state: SSEConnectionState) => void;
  enabled?: boolean;
  maxReconnectAttempts?: number;
  baseReconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

const DEFAULT_MAX_RECONNECT_ATTEMPTS = 10;
const DEFAULT_BASE_RECONNECT_DELAY = 1000;
const DEFAULT_MAX_RECONNECT_DELAY = 30000;

export function useSSE<T>({
  url,
  onMessage,
  onConnectionChange,
  enabled = true,
  maxReconnectAttempts = DEFAULT_MAX_RECONNECT_ATTEMPTS,
  baseReconnectDelayMs = DEFAULT_BASE_RECONNECT_DELAY,
  maxReconnectDelayMs = DEFAULT_MAX_RECONNECT_DELAY,
}: UseSSEOptions<T>): SSEState {
  const [state, setState] = useState<SSEState>({
    connectionState: 'disconnected',
    lastEventAt: null,
    reconnectAttempt: 0,
    missedEvents: 0,
    error: null,
  });

  // Track last sequence number to detect gaps
  const lastSequenceRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Stable callback refs
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onConnectionChangeRef = useRef(onConnectionChange);
  onConnectionChangeRef.current = onConnectionChange;

  const updateConnectionState = useCallback((newState: SSEConnectionState) => {
    setState((prev) => ({ ...prev, connectionState: newState }));
    onConnectionChangeRef.current?.(newState);
  }, []);

  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    updateConnectionState('connecting');

    try {
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        updateConnectionState('connected');
        setState((prev) => ({
          ...prev,
          reconnectAttempt: 0,
          error: null,
        }));
      };

      eventSource.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data);
          const sequence = parsed.sequence as number;
          const data = parsed.data as T;

          // Detect missed events via sequence gap
          if (lastSequenceRef.current !== null && sequence > lastSequenceRef.current + 1) {
            const missed = sequence - lastSequenceRef.current - 1;
            setState((prev) => ({
              ...prev,
              missedEvents: prev.missedEvents + missed,
            }));
          }

          lastSequenceRef.current = sequence;

          setState((prev) => ({
            ...prev,
            lastEventAt: new Date().toISOString(),
          }));

          onMessageRef.current(data, sequence);
        } catch (e) {
          console.error('[SSE] Failed to parse event:', e);
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        eventSourceRef.current = null;

        setState((prev) => {
          const nextAttempt = prev.reconnectAttempt + 1;

          if (nextAttempt > maxReconnectAttempts) {
            return {
              ...prev,
              connectionState: 'error',
              error: `Failed to reconnect after ${maxReconnectAttempts} attempts`,
              reconnectAttempt: nextAttempt,
            };
          }

          // Schedule reconnect with exponential backoff
          const delay = Math.min(
            baseReconnectDelayMs * Math.pow(2, prev.reconnectAttempt),
            maxReconnectDelayMs
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);

          return {
            ...prev,
            connectionState: 'disconnected',
            reconnectAttempt: nextAttempt,
          };
        });
      };
    } catch (e) {
      updateConnectionState('error');
      setState((prev) => ({
        ...prev,
        error: e instanceof Error ? e.message : 'Failed to connect',
      }));
    }
  }, [url, maxReconnectAttempts, baseReconnectDelayMs, maxReconnectDelayMs, updateConnectionState]);

  // Manual reconnect (for retry button)
  const reconnect = useCallback(() => {
    setState((prev) => ({
      ...prev,
      reconnectAttempt: 0,
      error: null,
      missedEvents: 0,
    }));
    lastSequenceRef.current = null;
    connect();
  }, [connect]);

  useEffect(() => {
    if (!enabled) {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      updateConnectionState('disconnected');
      return;
    }

    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [enabled, connect, updateConnectionState]);

  return { ...state, reconnect } as SSEState & { reconnect: () => void };
}
