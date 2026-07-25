import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merges Tailwind classes, resolving conflicts in favour of the last one. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
