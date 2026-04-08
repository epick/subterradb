import { NextResponse } from 'next/server';
import { query } from '@/server/db';
import {
  createSession,
  ensureBootstrapAdmin,
  setSessionCookie,
  verifyPassword,
  type SessionUser,
} from '@/server/auth';

// POST /api/auth/login
//
// Body: { email: string, password: string }
// Response: 200 { user } + Set-Cookie: sdb_session
//          401 { code: "auth.invalid_credentials" }
//          400 { code: "auth.missing_fields" }
//
// On the very first call (when the platform_users table is empty), the
// bootstrap admin is created from env vars before the credentials check —
// this is what makes the system self-bootstrapping.
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'auth.missing_fields' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return NextResponse.json({ code: 'auth.missing_fields' }, { status: 400 });
  }

  // Self-bootstrap: ensure the initial admin exists before any login attempt.
  // Idempotent — only inserts if no admin row is present.
  await ensureBootstrapAdmin();

  const result = await query<{
    id: string;
    email: string;
    name: string;
    password_hash: string;
    role: 'admin' | 'developer';
    status: string;
  }>(
    `SELECT id, email, name, password_hash, role, status
     FROM platform_users
     WHERE lower(email) = $1
     LIMIT 1`,
    [email],
  );

  const row = result.rows[0];
  if (!row || row.status !== 'active') {
    return NextResponse.json({ code: 'auth.invalid_credentials' }, { status: 401 });
  }

  const ok = await verifyPassword(password, row.password_hash);
  if (!ok) {
    return NextResponse.json({ code: 'auth.invalid_credentials' }, { status: 401 });
  }

  const user: SessionUser = {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };

  const userAgent = request.headers.get('user-agent');
  const ipAddress =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  const { token, expiresAt } = await createSession(user, { userAgent, ipAddress });
  await setSessionCookie(token, expiresAt);

  return NextResponse.json({ user });
}
