'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface IncidentBannerProps {
  message: string;
  severity: 'warning' | 'critical';
  incidentId?: string;
  onDismiss?: () => void;
}

/**
 * Incident banner for operational alerts.
 *
 * Production rationale:
 * - Critical incidents are red, warnings are yellow
 * - Dismissible but persists across navigation (parent manages state)
 * - Links to incident detail when ID is provided
 * - Should be visible at the top of the dashboard to catch attention
 */
export function IncidentBanner({
  message,
  severity,
  incidentId,
  onDismiss,
}: IncidentBannerProps) {
  const getSeverityStyles = () => {
    if (severity === 'critical') {
      return 'bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-900/50';
    }
    return 'bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900/50';
  };

  const getTextColor = () => {
    if (severity === 'critical') {
      return 'text-red-900 dark:text-red-200';
    }
    return 'text-yellow-900 dark:text-yellow-200';
  };

  return (
    <Alert className={cn(getSeverityStyles(), 'border')}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 flex-1">
          <AlertTriangle className={cn('h-4 w-4 mt-0.5 shrink-0', getTextColor())} />
          <AlertDescription className={cn('text-sm', getTextColor())}>
            {message}
            {incidentId && (
              <a
                href={`/incidents/${incidentId}`}
                className="ml-2 underline underline-offset-2 hover:no-underline"
              >
                View details
              </a>
            )}
          </AlertDescription>
        </div>
        {onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 w-6 p-0 hover:bg-transparent', getTextColor())}
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Dismiss</span>
          </Button>
        )}
      </div>
    </Alert>
  );
}
