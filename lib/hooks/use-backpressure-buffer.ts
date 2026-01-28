'use client';

/**
 * Backpressure Buffer for High-Volume Event Streams.
 *
 * Design decisions:
 *
 * 1. HARD BUFFER CAP
 *    The buffer has a maximum size. When exceeded, oldest events are dropped.
 *    System stability: Unbounded buffers cause memory exhaustion and browser crashes.
 *    Operator trust: "X events dropped" is better than frozen UI.
 *
 * 2. RENDER THROTTLING
 *    Events are flushed to consumers at a maximum rate (default 60fps = 16ms).
 *    System stability: DOM updates are expensive. Unthrottled updates cause jank.
 *    This is why we buffer, not because events are slow.
 *
 * 3. EXPLICIT DROP COUNTER
 *    The buffer tracks how many events were dropped and exposes this to UI.
 *    Operator trust: They know they're not seeing everything.
 *
 * 4. FLUSH ON DEMAND
 *    Consumer can request immediate flush for critical events.
 *    Failure containment: High-priority events aren't lost in buffer.
 *
 * Why dropping is safer than freezing:
 * - A frozen UI makes operators think the system is down
 * - A frozen UI can't show error states or recovery options
 * - A frozen UI causes browser "page unresponsive" dialogs
 * - Dropping N events and showing "N events skipped" maintains trust
 */

import { useRef, useCallback, useState, useEffect } from 'react';

export interface BackpressureState {
  bufferSize: number;
  droppedCount: number;
  isThrottling: boolean;
  lastFlushAt: string | null;
}

export interface UseBackpressureBufferOptions<T> {
  maxBufferSize?: number;
  flushIntervalMs?: number;
  onFlush: (items: T[]) => void;
}

const DEFAULT_MAX_BUFFER_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL_MS = 16; // ~60fps

export function useBackpressureBuffer<T>({
  maxBufferSize = DEFAULT_MAX_BUFFER_SIZE,
  flushIntervalMs = DEFAULT_FLUSH_INTERVAL_MS,
  onFlush,
}: UseBackpressureBufferOptions<T>) {
  const bufferRef = useRef<T[]>([]);
  const droppedCountRef = useRef(0);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastFlushRef = useRef<number>(0);

  const [state, setState] = useState<BackpressureState>({
    bufferSize: 0,
    droppedCount: 0,
    isThrottling: false,
    lastFlushAt: null,
  });

  // Stable ref for callback
  const onFlushRef = useRef(onFlush);
  onFlushRef.current = onFlush;

  const flush = useCallback(() => {
    if (bufferRef.current.length === 0) return;

    const items = bufferRef.current;
    bufferRef.current = [];

    // Call consumer with buffered items
    onFlushRef.current(items);

    lastFlushRef.current = Date.now();

    setState((prev) => ({
      ...prev,
      bufferSize: 0,
      lastFlushAt: new Date().toISOString(),
      isThrottling: false,
    }));
  }, []);

  const scheduleFlush = useCallback(() => {
    if (flushTimeoutRef.current) return; // Already scheduled

    const timeSinceLastFlush = Date.now() - lastFlushRef.current;
    const delay = Math.max(0, flushIntervalMs - timeSinceLastFlush);

    if (delay === 0) {
      flush();
    } else {
      setState((prev) => ({ ...prev, isThrottling: true }));
      flushTimeoutRef.current = setTimeout(() => {
        flushTimeoutRef.current = null;
        flush();
      }, delay);
    }
  }, [flushIntervalMs, flush]);

  const push = useCallback(
    (item: T) => {
      // Check if buffer is full
      if (bufferRef.current.length >= maxBufferSize) {
        // Drop oldest item
        bufferRef.current.shift();
        droppedCountRef.current += 1;

        setState((prev) => ({
          ...prev,
          droppedCount: droppedCountRef.current,
        }));
      }

      // Add new item
      bufferRef.current.push(item);

      setState((prev) => ({
        ...prev,
        bufferSize: bufferRef.current.length,
      }));

      // Schedule flush
      scheduleFlush();
    },
    [maxBufferSize, scheduleFlush]
  );

  const pushMany = useCallback(
    (items: T[]) => {
      items.forEach((item) => push(item));
    },
    [push]
  );

  const forceFlush = useCallback(() => {
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    flush();
  }, [flush]);

  const resetDroppedCount = useCallback(() => {
    droppedCountRef.current = 0;
    setState((prev) => ({ ...prev, droppedCount: 0 }));
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
      }
    };
  }, []);

  return {
    push,
    pushMany,
    forceFlush,
    resetDroppedCount,
    state,
  };
}
