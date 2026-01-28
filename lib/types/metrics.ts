/**
 * Metrics types for the operations dashboard.
 *
 * Design notes:
 * - Metrics have explicit timestamps to communicate data freshness.
 * - Percentile latencies (p50, p95, p99) matter more than averages in payment systems.
 *   A 100ms average can hide a 5-second p99 that's causing checkout abandonment.
 * - All rates are per-minute unless otherwise specified.
 */

export interface DashboardMetrics {
  timestamp: string; // When this snapshot was taken

  volume: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    successRate: number; // 0-1
    volumeChange: number; // Percentage change from previous period
  };

  latency: {
    p50Ms: number;
    p95Ms: number;
    p99Ms: number;
    avgMs: number;
  };

  throughput: {
    transactionsPerMinute: number;
    peakTpm: number;
    currentCapacityPercent: number; // How close to system limits
  };

  financial: {
    grossVolume: number; // Total processed amount
    netVolume: number; // After refunds/chargebacks
    currency: string;
    refundRate: number;
    chargebackRate: number;
  };
}

export interface RegionalMetrics {
  region: string;
  regionName: string;
  volume: number;
  successRate: number;
  avgLatencyMs: number;
  status: 'healthy' | 'degraded' | 'critical';
  incidents: number; // Active incidents in this region
}

/**
 * Time series data point for charts.
 */
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
}

export interface MetricTimeSeries {
  metric: string;
  period: '1h' | '6h' | '24h' | '7d';
  points: TimeSeriesPoint[];
  aggregation: 'sum' | 'avg' | 'max' | 'min' | 'p99';
}

/**
 * Data freshness indicator.
 * Production systems must communicate when data is stale.
 */
export interface DataFreshness {
  lastUpdated: string;
  nextExpectedUpdate: string;
  isStale: boolean;
  staleSinceMs: number | null;
  source: 'realtime' | 'cache' | 'fallback';
}
