/**
 * SSE Stream Handler for Transaction Events.
 *
 * Production note:
 * This simulates a real SSE endpoint. In production:
 * - Events would come from a message queue (Kafka, SQS)
 * - Connection state would be tracked server-side
 * - Heartbeats would detect stale connections
 *
 * For this demo, we generate synthetic events at a configurable rate.
 */

import { http, HttpResponse } from 'msw';
import { getChaosConfig } from '../chaos-config';
import { generateTransactionSummary } from '../data/generators';

// Global sequence counter for gap detection
let globalSequence = 0;

// Simulated event rate (events per second)
let eventRatePerSecond = 2;

// Store active connections for cleanup
const activeConnections = new Set<ReadableStreamDefaultController>();

/**
 * Set the event generation rate.
 * Higher rates test backpressure handling.
 */
export function setEventRate(eventsPerSecond: number): void {
  eventRatePerSecond = Math.max(0.1, Math.min(100, eventsPerSecond));
}

/**
 * Get current event rate.
 */
export function getEventRate(): number {
  return eventRatePerSecond;
}

/**
 * Trigger a burst of events (for testing backpressure).
 */
export function triggerEventBurst(count: number): void {
  // This is called from chaos panel to simulate burst
  // The actual implementation is in the stream handler
}

export const sseStreamHandlers = [
  // GET /api/transactions/stream - SSE endpoint
  http.get('/api/transactions/stream', ({ request }) => {
    const chaos = getChaosConfig();

    // Check for chaos-induced outage
    if (chaos.partialOutage.enabled) {
      const isOutage = chaos.partialOutage.endpoints.some((e) =>
        request.url.includes(e)
      );
      if (isOutage) {
        return new HttpResponse(null, { status: 503 });
      }
    }

    // Create SSE stream
    const stream = new ReadableStream({
      start(controller) {
        activeConnections.add(controller);

        // Send initial connection event
        const connectEvent = `data: ${JSON.stringify({
          type: 'connected',
          sequence: globalSequence++,
          timestamp: new Date().toISOString(),
        })}\n\n`;
        controller.enqueue(new TextEncoder().encode(connectEvent));

        // Generate events at configured rate
        const intervalMs = 1000 / eventRatePerSecond;

        const interval = setInterval(() => {
          try {
            // Check if connection should fail (chaos)
            if (chaos.failures.enabled && Math.random() < chaos.failures.rate * 0.1) {
              controller.close();
              clearInterval(interval);
              activeConnections.delete(controller);
              return;
            }

            // Generate a transaction event
            const transaction = generateTransactionSummary();
            const event = {
              type: 'transaction',
              sequence: globalSequence++,
              data: transaction,
              timestamp: new Date().toISOString(),
            };

            const sseData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(new TextEncoder().encode(sseData));
          } catch {
            // Connection closed
            clearInterval(interval);
            activeConnections.delete(controller);
          }
        }, intervalMs);

        // Heartbeat every 15 seconds
        const heartbeat = setInterval(() => {
          try {
            const event = {
              type: 'heartbeat',
              sequence: globalSequence++,
              timestamp: new Date().toISOString(),
            };
            const sseData = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(new TextEncoder().encode(sseData));
          } catch {
            clearInterval(heartbeat);
          }
        }, 15000);

        // Cleanup function
        return () => {
          clearInterval(interval);
          clearInterval(heartbeat);
          activeConnections.delete(controller);
        };
      },

      cancel() {
        // Client disconnected
      },
    });

    return new HttpResponse(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  }),

  // POST /api/transactions/stream/burst - Trigger event burst (for testing)
  http.post('/api/transactions/stream/burst', async ({ request }) => {
    const body = (await request.json()) as { count?: number };
    const count = body.count || 50;

    // Generate burst events
    for (let i = 0; i < count; i++) {
      const transaction = generateTransactionSummary();
      const event = {
        type: 'transaction',
        sequence: globalSequence++,
        data: transaction,
        timestamp: new Date().toISOString(),
      };

      // Send to all active connections
      const sseData = `data: ${JSON.stringify(event)}\n\n`;
      const encoded = new TextEncoder().encode(sseData);

      activeConnections.forEach((controller) => {
        try {
          controller.enqueue(encoded);
        } catch {
          // Connection closed
          activeConnections.delete(controller);
        }
      });
    }

    return HttpResponse.json({ sent: count, connections: activeConnections.size });
  }),

  // GET /api/transactions/stream/rate - Get/set event rate
  http.get('/api/transactions/stream/rate', () => {
    return HttpResponse.json({ rate: eventRatePerSecond });
  }),

  http.post('/api/transactions/stream/rate', async ({ request }) => {
    const body = (await request.json()) as { rate?: number };
    if (body.rate) {
      setEventRate(body.rate);
    }
    return HttpResponse.json({ rate: eventRatePerSecond });
  }),
];
