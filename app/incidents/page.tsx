'use client';

/**
 * Incidents Page.
 *
 * Production rationale:
 * Incident management is a core ops workflow. This page must:
 *
 * 1. SEPARATE ACTIVE FROM RESOLVED
 *    Active incidents need immediate attention. Resolved incidents
 *    are for post-mortems and pattern analysis.
 *
 * 2. COMMUNICATE IMPACT CLEARLY
 *    Operators need to prioritize. Show affected transactions,
 *    merchants, and estimated revenue impact.
 *
 * 3. SHOW TIMELINE
 *    What's been done, by whom, when. Critical for handoffs
 *    and post-incident review.
 *
 * 4. MOBILE-FRIENDLY
 *    On-call engineers often respond from mobile devices.
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { IncidentCard } from '@/components/incidents/incident-card';
import { LastUpdatedIndicator } from '@/components/shared/last-updated-indicator';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api/client';
import type { Incident } from '@/lib/types';

type TabValue = 'active' | 'resolved' | 'all';

export default function IncidentsPage() {
  const [activeTab, setActiveTab] = useState<TabValue>('active');

  const {
    data: response,
    isLoading,
    isError,
    isFetching,
    refetch,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['incidents', 'all'],
    queryFn: () => apiClient.get<Incident[]>('/incidents'),
    refetchInterval: 15000, // 15 seconds
  });

  const incidents = response?.data || [];

  // Filter incidents based on tab
  const activeIncidents = incidents.filter((i) => i.status !== 'resolved');
  const resolvedIncidents = incidents.filter((i) => i.status === 'resolved');

  const displayedIncidents =
    activeTab === 'active'
      ? activeIncidents
      : activeTab === 'resolved'
      ? resolvedIncidents
      : incidents;

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toISOString()
    : new Date().toISOString();

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl text-gray-900 dark:text-gray-100">Incidents</h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Active and historical incidents across all regions.
          </p>
        </div>
        <LastUpdatedIndicator
          timestamp={lastUpdated}
          onRefresh={() => refetch()}
          isRefreshing={isFetching}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-800">
        <TabButton
          active={activeTab === 'active'}
          onClick={() => setActiveTab('active')}
          count={activeIncidents.length}
          hasUrgent={activeIncidents.some(
            (i) => i.severity === 'critical' || i.severity === 'high'
          )}
        >
          Active
        </TabButton>
        <TabButton
          active={activeTab === 'resolved'}
          onClick={() => setActiveTab('resolved')}
          count={resolvedIncidents.length}
        >
          Resolved
        </TabButton>
        <TabButton
          active={activeTab === 'all'}
          onClick={() => setActiveTab('all')}
          count={incidents.length}
        >
          All
        </TabButton>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/20">
          <p className="text-sm text-red-900 dark:text-red-200">
            Failed to load incidents. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="mt-2 text-sm text-red-700 underline hover:no-underline dark:text-red-300"
          >
            Retry
          </button>
        </div>
      ) : displayedIncidents.length === 0 ? (
        <EmptyState tab={activeTab} />
      ) : (
        <div className="space-y-4">
          {displayedIncidents.map((incident) => (
            <IncidentCard key={incident.id} incident={incident} />
          ))}
        </div>
      )}

      {/* Active incidents summary */}
      {activeTab === 'active' && activeIncidents.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-800 dark:bg-gray-800/50">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Impact Summary
          </h3>
          <div className="mt-2 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <SummaryItem
              label="Active Incidents"
              value={activeIncidents.length.toString()}
            />
            <SummaryItem
              label="Affected Transactions"
              value={activeIncidents
                .reduce((sum, i) => sum + i.metrics.impactedTransactions, 0)
                .toLocaleString()}
            />
            <SummaryItem
              label="Affected Merchants"
              value={activeIncidents
                .reduce((sum, i) => sum + i.metrics.affectedMerchants, 0)
                .toLocaleString()}
            />
            <SummaryItem
              label="Est. Revenue Impact"
              value={`$${(
                activeIncidents.reduce(
                  (sum, i) => sum + i.metrics.estimatedRevenueLoss,
                  0
                ) / 100
              ).toLocaleString()}`}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function TabButton({
  children,
  active,
  onClick,
  count,
  hasUrgent,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count: number;
  hasUrgent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors
        ${
          active
            ? 'border-gray-900 text-gray-900 dark:border-gray-100 dark:text-gray-100'
            : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
        }
      `}
    >
      {children}
      <Badge
        variant={hasUrgent ? 'error' : 'secondary'}
        className="text-xs px-1.5 py-0"
      >
        {count}
      </Badge>
    </button>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="text-lg font-medium text-gray-900 dark:text-gray-100">
        {value}
      </p>
    </div>
  );
}

function EmptyState({ tab }: { tab: TabValue }) {
  const messages = {
    active: {
      title: 'No active incidents',
      description: 'All systems are operating normally.',
    },
    resolved: {
      title: 'No resolved incidents',
      description: 'No incidents have been resolved yet.',
    },
    all: {
      title: 'No incidents',
      description: 'No incidents have been recorded.',
    },
  };

  const { title, description } = messages[tab];

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-white py-12 dark:border-gray-800 dark:bg-gray-900">
      <div className="text-4xl">✓</div>
      <h3 className="mt-4 text-sm font-medium text-gray-900 dark:text-gray-100">
        {title}
      </h3>
      <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
        {description}
      </p>
    </div>
  );
}
