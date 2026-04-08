import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { cookies } from 'next/headers';
import { env } from './env';
import { query } from './db';

// Auth helpers for the SubterraDB control plane.
//
// Strategy:
//   - Passwords stored as bcrypt hashes in `platform_users.password_hash`.
//   - On login we issue a JWT (signed with HS256, secret from env) AND store
//     a sha256 of the JWT in `platform_sessions.token_hash` so we can revoke
//     sessions server-side without parsing the JWT.
//   - The JWT lives in an httpOnly cookie called `sdb_session` for the path /.
//   - Edge middleware can verify the JWT signature without DB access; API
//     routes that mutate state additionally verify the session hash exists.

const SESSION_COOKIE = 'sdb_session';
const SESSION_DURATION_HOURS = 8;
const BCRYPT_ROUNDS = 10;

export type Role = 'admin' | 'developer';

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

interface SessionJwtPayload extends JWTPayload {
  sub: string;
  email: string;
  name: string;
  role: Role;
}

// ---------------------------------------------------------------------------
// Password helpers
// ---------------------------------------------------------------------------

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---------------------------------------------------------------------------
// JWT signing / verification
// ---------------------------------------------------------------------------

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(env.jwtSecret);
}

export async function signSessionJwt(user: SessionUser): Promise<{
  token: string;
  expiresAt: Date;
}> {
  const expiresAt = new Date(Date.now() + SESSION_DURATION_HOURS * 60 * 60 * 1000);
  const token = await new SignJWT({
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getSecretKey());
  return { token, expiresAt };
}

export async function verifySessionJwt(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify<SessionJwtPayload>(token, getSecretKey(), {
      algorithms: ['HS256'],
    });
    if (!payload.sub || !payload.email || !payload.role) return null;
    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name ?? payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers (Next.js App Router server runtime)
// ---------------------------------------------------------------------------

export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function readSessionCookie(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

// ---------------------------------------------------------------------------
// Session table helpers
// ---------------------------------------------------------------------------

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function createSession(
  user: SessionUser,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const { token, expiresAt } = await signSessionJwt(user);
  await query(
    `INSERT INTO platform_sessions (user_id, token_hash, expires_at, user_agent, ip_address)
     VALUES ($1, $2, $3, $4, $5)`,
    [user.id, hashToken(token), expiresAt, meta.userAgent ?? null, meta.ipAddress ?? null],
  );
  await query(`UPDATE platform_users SET last_active_at = now() WHERE id = $1`, [user.id]);
  return { token, expiresAt };
}

export async function revokeSession(token: string): Promise<void> {
  await query(`DELETE FROM platform_sessions WHERE token_hash = $1`, [hashToken(token)]);
}

export async function isSessionValid(token: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    `SELECT id FROM platform_sessions
     WHERE token_hash = $1 AND expires_at > now()
     LIMIT 1`,
    [hashToken(token)],
  );
  return result.rowCount! > 0;
}

// ---------------------------------------------------------------------------
// Server-side helper: get the authenticated user for the current request.
// Returns null if no session, expired, or revoked.
// ---------------------------------------------------------------------------

export async function getCurrentUser(): Promise<SessionUser | null> {
  const token = await readSessionCookie();
  if (!token) return null;

  const user = await verifySessionJwt(token);
  if (!user) return null;

  // Check the session is still in the DB (not revoked).
  if (!(await isSessionValid(token))) return null;

  return user;
}

// ---------------------------------------------------------------------------
// Bootstrap: ensure an initial admin user exists.
// Called once at server start; safe to run repeatedly (idempotent).
// ---------------------------------------------------------------------------

export async function ensureBootstrapAdmin(): Promise<void> {
  const existing = await query<{ count: string }>(
    `SELECT count(*)::text FROM platform_users WHERE role = 'admin'`,
  );
  if (Number(existing.rows[0].count) > 0) return;

  const hash = await hashPassword(env.bootstrapAdmin.password);
  await query(
    `INSERT INTO platform_users (email, name, password_hash, role, status)
     VALUES ($1, $2, $3, 'admin', 'active')
     ON CONFLICT (email) DO NOTHING`,
    [env.bootstrapAdmin.email, env.bootstrapAdmin.name, hash],
  );
  // eslint-disable-next-line no-console
  console.log(
    `[subterradb] bootstrap admin created: ${env.bootstrapAdmin.email} (password from env)`,
  );
}

// ---------------------------------------------------------------------------
// Misc helpers
// ---------------------------------------------------------------------------

export function generateRandomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export const SESSION_COOKIE_NAME = SESSION_COOKIE;
