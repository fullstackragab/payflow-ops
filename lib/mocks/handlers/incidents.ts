/**
 * MSW handlers for incidents endpoints.
 *
 * Production note:
 * Incident management is critical for ops dashboards. The handlers here
 * simulate realistic incident data including timelines and impact metrics.
 */

import { http, HttpResponse, delay } from 'msw';
import { getChaosConfig } from '../chaos-config';
import { generateIncident } from '../data/generators';
import type { Incident, IncidentStatus } from '@/lib/types';

// Persistent incidents store
let incidentsStore: Incident[] = [];

// Initialize with some sample incidents
function initializeIncidents() {
  if (incidentsStore.length > 0) return;

  // One active incident
  incidentsStore.push(
    generateIncident({
      id: 'inc_active_001',
      title: 'Elevated error rate in EU region',
      description: 'Payment processor returning increased 5xx errors for EU transactions.',
      severity: 'high',
      status: 'investigating',
      category: 'error_rate',
      affectedRegions: ['EU'],
      affectedServices: ['payments-api', 'processor-eu'],
      detectedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(), // 45 min ago
      acknowledgedAt: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
      timeline: [
        {
          id: '1',
          timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
          author: null,
          content: 'Automated alert: Error rate exceeded 5% threshold in EU region',
          type: 'status_change',
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 40 * 60 * 1000).toISOString(),
          author: 'oncall-platform',
          content: 'Acknowledged. Investigating processor logs.',
          type: 'note',
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
          author: 'oncall-platform',
          content: 'Identified: Processor capacity issue. Scaling up instances.',
          type: 'action',
        },
      ],
      metrics: {
        impactedTransactions: 1247,
        estimatedRevenueLoss: 312500,
        affectedMerchants: 89,
      },
    })
  );

  // One resolved incident
  incidentsStore.push(
    generateIncident({
      id: 'inc_resolved_001',
      title: 'Database connection pool exhaustion',
      description: 'Primary database reached connection limit causing transaction timeouts.',
      severity: 'critical',
      status: 'resolved',
      category: 'availability',
      affectedRegions: ['US', 'EU'],
      affectedServices: ['payments-api', 'database-primary'],
      detectedAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(), // 6 hours ago
      acknowledgedAt: new Date(Date.now() - 5.9 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          id: '1',
          timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
          author: null,
          content: 'Automated alert: Database connection pool at 100% capacity',
          type: 'status_change',
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 5.9 * 60 * 60 * 1000).toISOString(),
          author: 'oncall-database',
          content: 'Acknowledged. Checking connection leaks.',
          type: 'note',
        },
        {
          id: '3',
          timestamp: new Date(Date.now() - 5.5 * 60 * 60 * 1000).toISOString(),
          author: 'oncall-database',
          content: 'Root cause: Long-running queries from analytics job. Killed queries.',
          type: 'action',
        },
        {
          id: '4',
          timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
          author: 'oncall-database',
          content: 'Connection pool recovered. Marking as resolved.',
          type: 'status_change',
        },
      ],
      metrics: {
        impactedTransactions: 3421,
        estimatedRevenueLoss: 850000,
        affectedMerchants: 234,
      },
    })
  );

  // Another resolved incident
  incidentsStore.push(
    generateIncident({
      id: 'inc_resolved_002',
      title: 'Latency spike in APAC region',
      description: 'Network congestion causing P99 latency to exceed SLO.',
      severity: 'medium',
      status: 'resolved',
      category: 'latency',
      affectedRegions: ['APAC'],
      affectedServices: ['payments-api'],
      detectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
      acknowledgedAt: new Date(Date.now() - 23.9 * 60 * 60 * 1000).toISOString(),
      resolvedAt: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
      timeline: [
        {
          id: '1',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          author: null,
          content: 'Automated alert: P99 latency exceeded 500ms threshold',
          type: 'status_change',
        },
        {
          id: '2',
          timestamp: new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(),
          author: 'oncall-platform',
          content: 'Network issue resolved by upstream provider. Latency normalized.',
          type: 'status_change',
        },
      ],
      metrics: {
        impactedTransactions: 512,
        estimatedRevenueLoss: 45000,
        affectedMerchants: 28,
      },
    })
  );
}

// Initialize on module load
initializeIncidents();

async function applyChaos(url: string): Promise<Response | null> {
  const chaos = getChaosConfig();

  if (chaos.latency.enabled) {
    const latencyMs =
      chaos.latency.minMs +
      Math.random() * (chaos.latency.maxMs - chaos.latency.minMs);
    await delay(latencyMs);
  }

  if (chaos.failures.enabled && Math.random() < chaos.failures.rate) {
    return HttpResponse.json(
      { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred', retryable: true },
      { status: 500 }
    );
  }

  return null;
}

export const incidentHandlers = [
  // GET /api/incidents - List incidents with optional status filter
  http.get('*/api/incidents', async ({ request }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const url = new URL(request.url);
    const statusFilter = url.searchParams.get('status');

    let filtered = [...incidentsStore];

    if (statusFilter === 'active') {
      filtered = filtered.filter((i) => i.status !== 'resolved');
    } else if (statusFilter === 'resolved') {
      filtered = filtered.filter((i) => i.status === 'resolved');
    }

    // Sort by detected time, most recent first
    filtered.sort(
      (a, b) =>
        new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
    );

    return HttpResponse.json({
      data: filtered,
      freshness: {
        timestamp: new Date().toISOString(),
        source: 'live',
        maxAgeMs: 5000,
      },
    });
  }),

  // GET /api/incidents/:id - Get single incident with full timeline
  http.get('*/api/incidents/:id', async ({ request, params }) => {
    const chaosResponse = await applyChaos(request.url);
    if (chaosResponse) return chaosResponse;

    const { id } = params;
    const incident = incidentsStore.find((i) => i.id === id);

    if (!incident) {
      return HttpResponse.json(
        { code: 'NOT_FOUND', message: `Incident ${id} not found`, retryable: false },
        { status: 404 }
      );
    }

    return HttpResponse.json({
      data: incident,
      freshness: {
        timestamp: new Date().toISOString(),
        source: 'live',
        maxAgeMs: 5000,
      },
    });
  }),
];
