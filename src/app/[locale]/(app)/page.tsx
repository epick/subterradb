import { redirect } from '@/i18n/navigation';

// Authenticated root: send users straight to the projects dashboard.
export default function AppRoot() {
  redirect({ href: '/projects', locale: 'en' });
}
