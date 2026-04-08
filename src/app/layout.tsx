import './globals.css';

// Root layout is intentionally minimal: the [locale] segment owns the
// <html>/<body> tags so next-intl can set the lang attribute per request.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
