/**
 * Class name utility.
 * Combines clsx for conditional classes with tailwind-merge
 * to properly handle Tailwind class conflicts.
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
