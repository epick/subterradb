import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';

// GET /api/auth/me
//
// Returns the currently-authenticated user, or 401 if no valid session.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }
  return NextResponse.json({ user });
}
