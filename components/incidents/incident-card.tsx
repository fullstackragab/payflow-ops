'use client';

/**
 * Incident Card Component.
 *
 * Production rationale:
 * Incident cards must communicate:
 * 1. Severity (visual hierarchy)
 * 2. Status (what's being done)
 * 3. Impact (who/what is affected)
 * 4. Duration (how long has this been ongoing)
 *
 * Critical and high severity incidents get visual prominence.
 * Impact metrics help operators prioritize.
 */

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { formatRelativeTime, formatDuration } from '@/lib/utils/time';
import { formatCompactCurrency } from '@/lib/utils/currency';
import { cn } from '@/lib/utils/cn';
import { Clock, AlertTriangle, Users, DollarSign } from 'lucide-react';
import type { Incident, IncidentSeverity, IncidentStatus } from '@/lib/types';

interface IncidentCardProps {
  incident: Incident;
}

const SEVERITY_CONFIG: Record<
  IncidentSeverity,
  { label: string; variant: 'error' | 'warning' | 'info' | 'secondary' }
> = {
  critical: { label: 'Critical', variant: 'error' },
  high: { label: 'High', variant: 'warning' },
  medium: { label: 'Medium', variant: 'info' },
  low: { label: 'Low', variant: 'secondary' },
};

const STATUS_CONFIG: Record<IncidentStatus, { label: string; color: string }> = {
  detected: { label: 'Detected', color: 'text-red-600 dark:text-red-400' },
  investigating: { label: 'Investigating', color: 'text-yellow-600 dark:text-yellow-400' },
  identified: { label: 'Identified', color: 'text-blue-600 dark:text-blue-400' },
  mitigating: { label: 'Mitigating', color: 'text-blue-600 dark:text-blue-400' },
  resolved: { label: 'Resolved', color: 'text-green-600 dark:text-green-400' },
  monitoring: { label: 'Monitoring', color: 'text-gray-600 dark:text-gray-400' },
};

export function IncidentCard({ incident }: IncidentCardProps) {
  const severityConfig = SEVERITY_CONFIG[incident.severity];
  const statusConfig = STATUS_CONFIG[incident.status];
  const isResolved = incident.status === 'resolved';

  // Calculate duration
  const startTime = new Date(incident.detectedAt).getTime();
  const endTime = incident.resolvedAt
    ? new Date(incident.resolvedAt).getTime()
    : Date.now();
  const durationMs = endTime - startTime;

  return (
    <Link href={`/incidents/${incident.id}`}>
      <Card
        className={cn(
          'p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50',
          !isResolved && incident.severity === 'critical' && 'border-red-200 dark:border-red-900/50',
          !isResolved && incident.severity === 'high' && 'border-yellow-200 dark:border-yellow-900/50'
        )}
      >
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant={severityConfig.variant}>{severityConfig.label}</Badge>
            <span className={cn('text-xs font-medium', statusConfig.color)}>
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <Clock className="h-3 w-3" />
            <span>{formatDuration(durationMs)}</span>
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          {incident.title}
        </h3>

        {/* Description */}
        <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
          {incident.description}
        </p>

        {/* Affected */}
        <div className="mt-3 flex flex-wrap gap-2">
          {incident.affectedRegions.map((region) => (
            <span
              key={region}
              className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
            >
              {region}
            </span>
          ))}
        </div>

        {/* Impact metrics */}
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            <span>{incident.metrics.impactedTransactions.toLocaleString()} txns</span>
          </div>
          <div className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            <span>{incident.metrics.affectedMerchants} merchants</span>
          </div>
          <div className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            <span>
              {formatCompactCurrency(incident.metrics.estimatedRevenueLoss * 100, 'USD')} impact
            </span>
          </div>
        </div>

        {/* Timestamp */}
        <div className="mt-3 text-xs text-gray-400">
          Detected {formatRelativeTime(incident.detectedAt)}
          {incident.resolvedAt && (
            <span> · Resolved {formatRelativeTime(incident.resolvedAt)}</span>
          )}
        </div>
      </Card>
    </Link>
  );
}
