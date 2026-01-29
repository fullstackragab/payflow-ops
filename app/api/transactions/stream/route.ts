/**
 * API Route: /api/transactions/stream
 * GET - Server-Sent Events stream for real-time transactions
 */

import { generateTransactionEvent } from '@/lib/api/stores';

export const dynamic = 'force-dynamic';

let globalSequence = 0;

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      const connectEvent = `data: ${JSON.stringify({
        type: 'connected',
        sequence: globalSequence++,
        timestamp: new Date().toISOString(),
      })}\n\n`;
      controller.enqueue(encoder.encode(connectEvent));

      // Generate events at ~2 per second
      const intervalMs = 500;
      const interval = setInterval(() => {
        try {
          const transaction = generateTransactionEvent();
          const event = {
            type: 'transaction',
            sequence: globalSequence++,
            data: transaction,
            timestamp: new Date().toISOString(),
          };

          const sseData = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(sseData));
        } catch {
          clearInterval(interval);
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
          controller.enqueue(encoder.encode(sseData));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup when client disconnects
      return () => {
        clearInterval(interval);
        clearInterval(heartbeat);
      };
    },

    cancel() {
      // Client disconnected
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
