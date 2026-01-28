'use client';

/**
 * Operations Dashboard - Main page
 *
 * Architecture decisions:
 *
 * 1. INDEPENDENT KPI CARDS
 *    Each KPI fetches its own data. If the latency service is down,
 *    volume metrics still load. This is how production dashboards work.
 *
 * 2. EXPLICIT DEGRADED STATES
 *    The UI explicitly shows when data is stale, cached, or unavailable.
 *    Operators must never think they're looking at live data when they're not.
 *
 * 3. MANUAL REFRESH
 *    Auto-refresh is enabled, but operators can manually refresh before
 *    making a decision. Control matters in ops contexts.
 *
 * 4. FAILURE ISOLATION
 *    One failing query doesn't block the page. TanStack Query's error
 *    boundaries are per-query, not per-page.
 */

import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { IndependentKPICard } from '@/components/dashboard/independent-kpi-card';
import { DataFreshnessIndicator } from '@/components/dashboard/data-freshness-indicator';
import { IncidentBanner } from '@/components/dashboard/incident-banner';
import { DegradedModeBanner } from '@/components/shared/degraded-mode-banner';
import { ConnectionStatus, useConnectionState } from '@/components/shared/connection-status';
import { LastUpdatedIndicator } from '@/components/shared/last-updated-indicator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  fetchVolumeMetrics,
  fetchLatencyMetrics,
  fetchActiveIncidents,
  type VolumeMetrics,
  type LatencyMetrics,
} from '@/lib/api/metrics';
import { formatCompactCurrency } from '@/lib/utils/currency';
import type { Incident } from '@/lib/types';

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState('24h');
  const [region, setRegion] = useState('all');
  const [dismissedIncidents, setDismissedIncidents] = useState<Set<string>>(new Set());

  const queryClient = useQueryClient();
  const connectionState = useConnectionState();

  // Track which KPIs are erroring for degraded mode detection
  const [volumeError, setVolumeError] = useState(false);
  const [latencyError, setLatencyError] = useState(false);

  // Fetch incidents
  const {
    data: incidentsResponse,
    dataUpdatedAt: incidentsUpdatedAt,
    isFetching: incidentsFetching,
    refetch: refetchIncidents,
  } = useQuery({
    queryKey: ['incidents', 'active'],
    queryFn: () => fetchActiveIncidents(),
    refetchInterval: 10000,
  });

  const incidents = incidentsResponse?.data?.filter(
    (i) => !dismissedIncidents.has(i.id)
  ) || [];

  const dismissIncident = (id: string) => {
    setDismissedIncidents((prev) => new Set(prev).add(id));
  };

  // Determine if we're in degraded mode
  const isDegraded = volumeError || latencyError;
  const affectedSections = useMemo(() => {
    const sections: string[] = [];
    if (volumeError) sections.push('Volume Metrics');
    if (latencyError) sections.push('Latency Metrics');
    return sections;
  }, [volumeError, latencyError]);

  // Manual refresh all
  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['metrics'] });
    queryClient.invalidateQueries({ queryKey: ['incidents'] });
  };

  // Last successful update time
  const lastUpdated = incidentsUpdatedAt
    ? new Date(incidentsUpdatedAt).toISOString()
    : new Date().toISOString();

  return (
    <div className="space-y-4">
      {/* Connection status for offline detection */}
      {connectionState === 'offline' && (
        <DegradedModeBanner
          reason="offline"
          onRetry={refreshAll}
        />
      )}

      {/* Degraded mode banner when some services fail */}
      {isDegraded && connectionState !== 'offline' && (
        <DegradedModeBanner
          reason="partial_outage"
          affectedSections={affectedSections}
          onRetry={refreshAll}
        />
      )}

      {/* Incident banners */}
      {incidents.map((incident) => (
        <IncidentBanner
          key={incident.id}
          message={incident.title}
          severity={incident.severity === 'critical' ? 'critical' : 'warning'}
          incidentId={incident.id}
          onDismiss={() => dismissIncident(incident.id)}
        />
      ))}

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-xl text-gray-900 dark:text-gray-100">
            Operations Dashboard
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <ConnectionStatus />
            <LastUpdatedIndicator
              timestamp={lastUpdated}
              onRefresh={refreshAll}
              isRefreshing={incidentsFetching}
            />
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row shrink-0">
          <Select value={region} onValueChange={setRegion}>
            <SelectTrigger className="w-full bg-white dark:bg-gray-900 sm:w-32">
              <SelectValue placeholder="Region" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Regions</SelectItem>
              <SelectItem value="US">US</SelectItem>
              <SelectItem value="EU">EU</SelectItem>
              <SelectItem value="APAC">APAC</SelectItem>
              <SelectItem value="LATAM">LATAM</SelectItem>
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-full bg-white dark:bg-gray-900 sm:w-32">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1h">Last 1 hour</SelectItem>
              <SelectItem value="24h">Last 24 hours</SelectItem>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Grid - Each card fetches independently */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Transaction Volume */}
        <IndependentKPICard<VolumeMetrics>
          title="Transaction Volume"
          queryKey={['metrics', 'volume', timeRange, region]}
          queryFn={() => {
            setVolumeError(false);
            return fetchVolumeMetrics(timeRange, region).catch((err) => {
              setVolumeError(true);
              throw err;
            });
          }}
          getValue={(data) => formatCompactCurrency(data.grossVolume, data.currency)}
          getChange={(data) => data.volumeChange}
          getStatus={(data) => (data.volumeChange >= 0 ? 'good' : 'neutral')}
          getSubtitle={(data) =>
            `${data.totalTransactions.toLocaleString()} transactions`
          }
          changeLabel="vs last period"
          refetchInterval={10000}
        />

        {/* Success Rate */}
        <IndependentKPICard<VolumeMetrics>
          title="Success Rate"
          queryKey={['metrics', 'success-rate', timeRange, region]}
          queryFn={() => fetchVolumeMetrics(timeRange, region)}
          getValue={(data) => `${(data.successRate * 100).toFixed(1)}%`}
          getChange={(data) => (data.successRate - 0.98) * 100}
          getStatus={(data) => (data.successRate >= 0.98 ? 'good' : 'bad')}
          getSubtitle={() => 'Target: 98.0%'}
          changeLabel="vs target"
          refetchInterval={10000}
        />

        {/* Failure Rate */}
        <IndependentKPICard<VolumeMetrics>
          title="Failure Rate"
          queryKey={['metrics', 'failure-rate', timeRange, region]}
          queryFn={() => fetchVolumeMetrics(timeRange, region)}
          getValue={(data) => `${((1 - data.successRate) * 100).toFixed(1)}%`}
          getChange={(data) => -((1 - data.successRate) * 100 - 2)}
          getStatus={(data) => (1 - data.successRate <= 0.02 ? 'good' : 'bad')}
          getSubtitle={(data) =>
            `${data.failedTransactions.toLocaleString()} failed`
          }
          changeLabel="vs target"
          refetchInterval={10000}
        />

        {/* P95 Latency */}
        <IndependentKPICard<LatencyMetrics>
          title="P95 Latency"
          queryKey={['metrics', 'latency', timeRange, region]}
          queryFn={() => {
            setLatencyError(false);
            return fetchLatencyMetrics(timeRange, region).catch((err) => {
              setLatencyError(true);
              throw err;
            });
          }}
          getValue={(data) => `${data.p95Ms}ms`}
          getChange={(data) => -((data.p95Ms - 250) / 250) * 100}
          getStatus={(data) => (data.p95Ms <= 250 ? 'good' : 'bad')}
          getSubtitle={(data) => `P99: ${data.p99Ms}ms`}
          changeLabel="vs target"
          refetchInterval={10000}
        />
      </div>

      {/* Regional summary - placeholder for now */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">
          Regional Status
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {['US', 'EU', 'UK', 'APAC', 'LATAM', 'MEA'].map((r) => (
            <div
              key={r}
              className="flex items-center justify-between rounded border border-gray-100 bg-gray-50 px-3 py-2 dark:border-gray-800 dark:bg-gray-800/50"
            >
              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                {r}
              </span>
              <span className="h-2 w-2 rounded-full bg-green-500" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
