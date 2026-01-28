/**
 * MSW handlers for metrics endpoints.
 */

import { http, HttpResponse, delay } from 'msw';
import { getChaosConfig } from '../chaos-config';
import { generateDashboardMetrics, generateRegionalMetrics, generateIncident } from '../data/generators';
import type { ApiResponse, DashboardMetrics, RegionalMetrics, Incident } from '@/lib/types';

// Persistent incident for demo
let activeIncident: Incident | null = null;

async function applyChaos(url: string): Promise<Response | null> {
  const chaos = getChaosConfig();

  if (chaos.latency.enabled) {
    const latencyMs =
      chaos.latency.minMs +
      Math.random() * (chaos.latency.maxMs - chaos.latency.minMs);
    await delay(latencyMs);
  }

  if (chaos.degraded.enabled) {
    const isDegraded = chaos.degraded.endpoints.some((e) => url.includes(e));
    if (isDegraded) {
      await delay(chaos.latency.maxMs * chaos.degraded.slowdownMultiplier);
    }
  }

  if (chaos.partialOutage.enabled) {
    const isOutage = chaos.partialOutage.endpoints.some((e) => url.includes(e));
    if (isOutage) {
      return HttpResponse.json(
        {
          code: 'SERVICE_UNAVAILABLE',
          message: 'Metrics service temporarily unavailable',
          retryable: true,
          retryAfterMs: 5000,
        },
        { status: 503 }
      );
    }
  }

  if (chaos.failures.enabled && Math.random() < chaos.failures.rate) {
    return HttpResponse.json(
      {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        retryable: true,
      },
      { status: 500 }
    );
  }

  return null;
}

function createResponse<T>(data: T): ApiResponse<T> {
  const chaos = getChaosConfig();
  const staleAge = chaos.staleData.enabled ? chaos.staleData.staleAgeMs : 0;

  return {
    data,
    freshness: {
      timestamp: new Date(Date.now() - staleAge).toISOString(),
      source: chaos.staleData.enabled ? 'cache' : 'live',
      maxAgeMs: 5000,
    },
  };
}

export const metricsHandlers = [
  // GET /api/metrics - Dashboard metrics
  http.get('*/api/metrics', async ({ request }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const metrics = generateDashboardMetrics();
    return HttpResponse.json(createResponse(metrics));
  }),

  // GET /api/metrics/regions - Regional breakdown
  http.get('*/api/metrics/regions', async ({ request }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const regions = generateRegionalMetrics();
    return HttpResponse.json(createResponse(regions));
  }),

  // GET /api/incidents - Active incidents
  http.get('*/api/incidents', async ({ request }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    // Generate an incident if chaos is causing problems
    const chaos = getChaosConfig();
    if (
      (chaos.failures.enabled && chaos.failures.rate > 0.1) ||
      chaos.partialOutage.enabled
    ) {
      if (!activeIncident) {
        activeIncident = generateIncident({
          severity: 'high',
          status: 'investigating',
        });
      }
    } else {
      // Clear incident when things are healthy
      activeIncident = null;
    }

    const incidents = activeIncident ? [activeIncident] : [];
    return HttpResponse.json(createResponse(incidents));
  }),

  // GET /api/incidents/:id
  http.get('*/api/incidents/:id', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    if (activeIncident && activeIncident.id === id) {
      return HttpResponse.json(createResponse(activeIncident));
    }

    return HttpResponse.json(
      {
        code: 'NOT_FOUND',
        message: `Incident ${id} not found`,
        retryable: false,
      },
      { status: 404 }
    );
  }),
];

// Export for testing
export function setActiveIncident(incident: Incident | null): void {
  activeIncident = incident;
}
