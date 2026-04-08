import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Locale-aware wrappers around Next.js navigation primitives.
// Always import Link / useRouter / redirect from here, not from 'next/link' or 'next/navigation'.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
