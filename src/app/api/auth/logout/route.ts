import { NextResponse } from 'next/server';
import { clearSessionCookie, readSessionCookie, revokeSession } from '@/server/auth';

// POST /api/auth/logout
//
// Revokes the current session in the DB and clears the cookie.
// Always returns 200 — even if no session was present.
export async function POST() {
  const token = await readSessionCookie();
  if (token) {
    await revokeSession(token);
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
