/**
 * Incident types for operational alerting and response.
 *
 * Design notes:
 * - Incidents are raised automatically when metrics breach thresholds,
 *   or manually by operators.
 * - Severity levels follow standard incident response frameworks.
 * - An incident can affect multiple services/regions simultaneously.
 */

export type IncidentSeverity = 'critical' | 'high' | 'medium' | 'low';

export type IncidentStatus =
  | 'detected' // System detected anomaly
  | 'investigating' // Team is looking into it
  | 'identified' // Root cause found
  | 'mitigating' // Fix in progress
  | 'resolved' // Issue fixed
  | 'monitoring'; // Fixed but watching for recurrence

export type IncidentCategory =
  | 'availability' // Service down
  | 'latency' // Response times degraded
  | 'error_rate' // Elevated failure rate
  | 'data_integrity' // Reconciliation issues
  | 'security' // Security-related incident
  | 'capacity'; // System at capacity limits

export interface IncidentTimelineEntry {
  id: string;
  timestamp: string;
  author: string | null; // null for system-generated entries
  content: string;
  type: 'status_change' | 'note' | 'metric' | 'action';
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  category: IncidentCategory;
  affectedServices: string[];
  affectedRegions: string[];
  detectedAt: string;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  assignee: string | null;
  timeline: IncidentTimelineEntry[];
  metrics: {
    impactedTransactions: number;
    estimatedRevenueLoss: number;
    affectedMerchants: number;
  };
}

/**
 * Threshold configuration for automatic incident detection.
 * When a metric crosses a threshold, an incident is raised.
 */
export interface AlertThreshold {
  id: string;
  name: string;
  metric: string; // e.g., 'error_rate', 'p99_latency'
  operator: 'gt' | 'lt' | 'gte' | 'lte';
  value: number;
  duration: number; // Seconds the condition must persist
  severity: IncidentSeverity;
  enabled: boolean;
}
