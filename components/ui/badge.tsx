import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-950 focus:ring-offset-2 dark:focus:ring-gray-300',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-gray-900 text-gray-50 dark:bg-gray-50 dark:text-gray-900',
        secondary:
          'border-transparent bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-50',
        destructive:
          'border-transparent bg-red-500 text-gray-50 dark:bg-red-900 dark:text-gray-50',
        outline: 'text-gray-950 dark:text-gray-50',
        // Status-specific variants for ops dashboard
        success:
          'border-green-200 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/20 dark:text-green-400',
        warning:
          'border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-900 dark:bg-yellow-950/20 dark:text-yellow-400',
        error:
          'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/20 dark:text-red-400',
        info:
          'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
