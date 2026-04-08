import { NextResponse, type NextRequest } from 'next/server';
import createIntlMiddleware from 'next-intl/middleware';
import { jwtVerify } from 'jose';
import { routing } from './i18n/routing';

// Combined middleware for SubterraDB:
//
//   1. next-intl handles locale detection / rewriting first.
//   2. We then layer authentication on top:
//      - (app) routes (everything that isn't /login or /signup) require a
//        valid session JWT in the `sdb_session` cookie. We verify the JWT
//        signature here at the edge — no DB hit. Revoked-session checks
//        happen inside API routes that mutate state.
//      - /login redirects to /projects when the user is already signed in.
//
// The middleware runs on every request matched by `config.matcher`.

const intlMiddleware = createIntlMiddleware(routing);

const SESSION_COOKIE = 'sdb_session';

// Routes inside the (auth) group — accessible without a session.
const PUBLIC_PATHS = new Set(['', '/', '/login', '/signup']);

function stripLocale(pathname: string): { locale: string; rest: string } {
  const segments = pathname.split('/').filter(Boolean);
  const first = segments[0];
  if (first && (routing.locales as readonly string[]).includes(first)) {
    return { locale: first, rest: '/' + segments.slice(1).join('') };
  }
  return { locale: routing.defaultLocale, rest: pathname };
}

function isPublicPath(rest: string): boolean {
  if (PUBLIC_PATHS.has(rest)) return true;
  return rest.startsWith('/login') || rest.startsWith('/signup');
}

async function isJwtValid(token: string, secret: string): Promise<boolean> {
  try {
    await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ['HS256'],
    });
    return true;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  // Step 1: let next-intl handle locale routing.
  const intlResponse = intlMiddleware(request);

  // Step 2: enforce auth on (app) routes.
  const { pathname } = request.nextUrl;
  const { locale, rest } = stripLocale(pathname);

  const sessionToken = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SUBTERRADB_JWT_SECRET ?? '';
  const hasValidSession = sessionToken && secret
    ? await isJwtValid(sessionToken, secret)
    : false;

  // Already-authed users hitting /login → bounce them to the dashboard.
  if (hasValidSession && (rest === '/login' || rest.startsWith('/login'))) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/projects`;
    return NextResponse.redirect(url);
  }

  // Unauthed users on a protected route → redirect to /login.
  if (!hasValidSession && !isPublicPath(rest)) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}/login`;
    url.search = '';
    return NextResponse.redirect(url);
  }

  return intlResponse;
}

export const config = {
  // Skip Next internals, API routes, and static assets.
  matcher: ['/((?!api|trpc|_next|_vercel|.*\\..*).*)'],
};
