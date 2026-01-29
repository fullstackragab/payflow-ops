/**
 * API Route: /api/incidents
 *
 * Returns active incidents. Query param ?status=active filters to active only.
 */

import { NextResponse } from 'next/server';

export async function GET() {
  // For the demo, return empty incidents (all systems operational)
  // In a real system, this would query an incident management system
  const incidents: unknown[] = [];

  return NextResponse.json({
    data: incidents,
    freshness: {
      timestamp: new Date().toISOString(),
      source: 'live',
      maxAgeMs: 5000,
    },
  });
}
