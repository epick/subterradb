import { redirect } from '@/i18n/navigation';

// Root entry point — until the dashboard exists, send users straight to login.
export default function LocaleRoot() {
  redirect({ href: '/login', locale: 'en' });
}
