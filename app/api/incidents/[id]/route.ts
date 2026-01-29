/**
 * API Route: /api/incidents/[id]
 * GET - Get single incident with timeline
 */

import { NextRequest, NextResponse } from 'next/server';

function createResponse<T>(data: T) {
  return {
    data,
    freshness: {
      timestamp: new Date().toISOString(),
      source: 'live',
      maxAgeMs: 5000,
    },
  };
}

// Mock incident data store
const mockIncidents = new Map([
  ['inc_demo_1', {
    id: 'inc_demo_1',
    title: 'Elevated error rate in EU region',
    description: 'Automated alert triggered due to metrics exceeding defined thresholds.',
    severity: 'high',
    status: 'investigating',
    category: 'error_rate',
    affectedServices: ['payments-api', 'transaction-processor'],
    affectedRegions: ['EU'],
    detectedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    acknowledgedAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
    resolvedAt: null,
    assignee: 'oncall-team',
    timeline: [
      {
        id: '1',
        timestamp: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
        author: null,
        content: 'Incident automatically detected by monitoring system',
        type: 'status_change',
      },
      {
        id: '2',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        author: 'oncall-team',
        content: 'Acknowledged. Investigating root cause.',
        type: 'comment',
      },
    ],
    metrics: {
      impactedTransactions: 245,
      estimatedRevenueLoss: 125000,
      affectedMerchants: 12,
    },
  }],
]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const incident = mockIncidents.get(id);

  if (!incident) {
    return NextResponse.json(
      { code: 'NOT_FOUND', message: `Incident ${id} not found`, retryable: false },
      { status: 404 }
    );
  }

  return NextResponse.json(createResponse(incident));
}
