import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

// Wires next-intl with our request config (locale loading + message catalogs).
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Standalone output is what makes the production Docker image small —
  // Next.js bundles only the files actually needed at runtime into
  // .next/standalone/, so the final image doesn't ship the full node_modules.
  output: 'standalone',

  // dockerode pulls in ssh2, which has native bindings (cpu-features.node)
  // that Turbopack can't bundle. Marking these as external tells Next.js to
  // require() them at runtime from node_modules instead of bundling — which
  // is correct anyway, since they're server-only.
  serverExternalPackages: ['dockerode', 'ssh2', 'docker-modem', 'cpu-features'],
};

export default withNextIntl(nextConfig);
