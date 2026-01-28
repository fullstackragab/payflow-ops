/**
 * Metrics API functions.
 *
 * Production rationale:
 * Each metric category is fetched independently. This allows:
 * - Isolated failures (latency service down doesn't block volume)
 * - Different refresh intervals per metric type
 * - Granular error handling and retry logic
 *
 * In a real system, these would hit different backend services
 * or different endpoints with different SLOs.
 */

import { apiClient, type RequestConfig } from './client';
import type { DashboardMetrics, RegionalMetrics, Incident, ApiResponse } from '@/lib/types';

export interface VolumeMetrics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  successRate: number;
  volumeChange: number;
  grossVolume: number;
  currency: string;
}

export interface LatencyMetrics {
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  avgMs: number;
}

export interface ThroughputMetrics {
  transactionsPerMinute: number;
  peakTpm: number;
  currentCapacityPercent: number;
}

/**
 * Fetch volume metrics independently.
 */
export async function fetchVolumeMetrics(
  timeRange: string,
  region: string,
  config?: RequestConfig
): Promise<ApiResponse<VolumeMetrics>> {
  const response = await apiClient.get<DashboardMetrics>(
    `/metrics?timeRange=${timeRange}&region=${region}&subset=volume`,
    config
  );

  // Extract just volume data
  return {
    data: {
      ...response.data.volume,
      grossVolume: response.data.financial.grossVolume,
      currency: response.data.financial.currency,
    },
    freshness: response.freshness,
  };
}

/**
 * Fetch latency metrics independently.
 */
export async function fetchLatencyMetrics(
  timeRange: string,
  region: string,
  config?: RequestConfig
): Promise<ApiResponse<LatencyMetrics>> {
  const response = await apiClient.get<DashboardMetrics>(
    `/metrics?timeRange=${timeRange}&region=${region}&subset=latency`,
    config
  );

  return {
    data: response.data.latency,
    freshness: response.freshness,
  };
}

/**
 * Fetch throughput metrics independently.
 */
export async function fetchThroughputMetrics(
  timeRange: string,
  region: string,
  config?: RequestConfig
): Promise<ApiResponse<ThroughputMetrics>> {
  const response = await apiClient.get<DashboardMetrics>(
    `/metrics?timeRange=${timeRange}&region=${region}&subset=throughput`,
    config
  );

  return {
    data: response.data.throughput,
    freshness: response.freshness,
  };
}

/**
 * Fetch regional breakdown.
 */
export async function fetchRegionalMetrics(
  config?: RequestConfig
): Promise<ApiResponse<RegionalMetrics[]>> {
  return apiClient.get<RegionalMetrics[]>('/metrics/regions', config);
}

/**
 * Fetch active incidents.
 */
export async function fetchActiveIncidents(
  config?: RequestConfig
): Promise<ApiResponse<Incident[]>> {
  return apiClient.get<Incident[]>('/incidents?status=active', config);
}

/**
 * Fetch all incidents (active and resolved).
 */
export async function fetchAllIncidents(
  config?: RequestConfig
): Promise<ApiResponse<Incident[]>> {
  return apiClient.get<Incident[]>('/incidents', config);
}
