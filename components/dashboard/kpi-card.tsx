import { Card } from '@/components/ui/card';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  changeLabel?: string;
  status?: 'good' | 'bad' | 'neutral';
  subtitle?: string;
  loading?: boolean;
}

/**
 * KPI Card component for dashboard metrics.
 *
 * Design decisions:
 * - Status colors are semantic (good=green, bad=red, neutral=gray)
 * - Change indicator shows both direction and percentage
 * - Subtitle provides context (e.g., "Target: 98.0%")
 * - Loading state uses skeleton to maintain layout stability
 */
export function KPICard({
  title,
  value,
  change,
  changeLabel,
  status,
  subtitle,
  loading,
}: KPICardProps) {
  const getTrendIcon = () => {
    if (change === undefined || change === null) return null;
    if (change > 0) return <ArrowUp className="h-3 w-3" />;
    if (change < 0) return <ArrowDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (!status) return 'text-gray-500';
    if (status === 'good') return 'text-green-600 dark:text-green-500';
    if (status === 'bad') return 'text-red-600 dark:text-red-500';
    return 'text-gray-500';
  };

  if (loading) {
    return (
      <Card className="p-4">
        <div className="flex flex-col gap-2">
          <div className="h-4 w-24 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-8 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
          <div className="h-3 w-20 animate-pulse rounded bg-gray-200 dark:bg-gray-800" />
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex flex-col gap-2">
        <div className="text-sm text-gray-600 dark:text-gray-400">{title}</div>
        <div className="text-2xl tracking-tight text-gray-900 dark:text-gray-100">
          {value}
        </div>
        {subtitle && (
          <div className="text-xs text-gray-500 dark:text-gray-500">
            {subtitle}
          </div>
        )}
        {change !== undefined && (
          <div className={cn('flex items-center gap-1 text-xs', getTrendColor())}>
            {getTrendIcon()}
            <span>{Math.abs(change).toFixed(1)}%</span>
            {changeLabel && (
              <span className="text-gray-500 dark:text-gray-500">
                {changeLabel}
              </span>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
