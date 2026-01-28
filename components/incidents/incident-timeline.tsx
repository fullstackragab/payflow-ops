'use client';

/**
 * Incident Timeline Component.
 *
 * Production rationale:
 * Incident timelines are crucial for:
 * 1. Post-incident review (what happened when)
 * 2. Handoff between on-call shifts
 * 3. Demonstrating response time for SLA compliance
 *
 * Each entry shows who did what and when.
 * System-generated entries are distinguished from human notes.
 */

import { formatTimestamp, formatRelativeTime } from '@/lib/utils/time';
import { cn } from '@/lib/utils/cn';
import { AlertCircle, MessageSquare, Wrench, ArrowRight } from 'lucide-react';
import type { IncidentTimelineEntry } from '@/lib/types';

interface IncidentTimelineProps {
  entries: IncidentTimelineEntry[];
}

export function IncidentTimeline({ entries }: IncidentTimelineProps) {
  const getEntryIcon = (type: IncidentTimelineEntry['type']) => {
    switch (type) {
      case 'status_change':
        return ArrowRight;
      case 'note':
        return MessageSquare;
      case 'action':
        return Wrench;
      case 'metric':
        return AlertCircle;
      default:
        return MessageSquare;
    }
  };

  const getEntryColor = (type: IncidentTimelineEntry['type']) => {
    switch (type) {
      case 'status_change':
        return 'bg-blue-500';
      case 'action':
        return 'bg-green-500';
      case 'note':
        return 'bg-gray-400 dark:bg-gray-600';
      case 'metric':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  if (entries.length === 0) {
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400">
        No timeline entries yet.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical line */}
      <div className="absolute left-3 top-2 bottom-2 w-px bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-4">
        {entries.map((entry) => {
          const Icon = getEntryIcon(entry.type);

          return (
            <div key={entry.id} className="relative flex gap-4 pl-8">
              {/* Icon dot */}
              <div
                className={cn(
                  'absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full',
                  getEntryColor(entry.type)
                )}
              >
                <Icon className="h-3 w-3 text-white" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <time
                    dateTime={entry.timestamp}
                    title={entry.timestamp}
                    className="font-mono"
                  >
                    {formatTimestamp(entry.timestamp)}
                  </time>
                  <span>·</span>
                  <span>{formatRelativeTime(entry.timestamp)}</span>
                  {entry.author && (
                    <>
                      <span>·</span>
                      <span className="font-medium text-gray-700 dark:text-gray-300">
                        {entry.author}
                      </span>
                    </>
                  )}
                  {!entry.author && (
                    <>
                      <span>·</span>
                      <span className="italic">System</span>
                    </>
                  )}
                </div>
                <p className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                  {entry.content}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
