import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Standard shadcn/ui className merger: combines clsx semantics with
// Tailwind-aware conflict resolution (e.g. "px-2 px-4" → "px-4").
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
