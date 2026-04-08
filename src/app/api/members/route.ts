import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { inviteMember, listMembers } from '@/server/members';

// GET /api/members
//
// Admin only. Returns every platform user with project assignment counts.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }

  try {
    const members = await listMembers(user);
    return NextResponse.json({ members });
  } catch (err) {
    const e = err as { code?: string; status?: number };
    return NextResponse.json(
      { code: e.code ?? 'members.unknown_error' },
      { status: e.status ?? 500 },
    );
  }
}

// POST /api/members
//
// Body: { email, name, role: 'admin' | 'developer', password }
// Response: 201 { member }
//
// Admin only. Creates an active platform user immediately. When SMTP delivery
// is wired up later, the role of "password" will switch to a one-time invite link.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }

  let body: { email?: unknown; name?: unknown; role?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'members.invalid_body' }, { status: 400 });
  }

  if (typeof body.email !== 'string' || typeof body.name !== 'string') {
    return NextResponse.json({ code: 'members.missing_fields' }, { status: 400 });
  }

  try {
    const member = await inviteMember(user, {
      email: body.email,
      name: body.name,
      role: body.role === 'admin' ? 'admin' : 'developer',
      password: typeof body.password === 'string' ? body.password : '',
    });
    return NextResponse.json({ member }, { status: 201 });
  } catch (err) {
    const e = err as { code?: string; status?: number };
    return NextResponse.json(
      { code: e.code ?? 'members.unknown_error' },
      { status: e.status ?? 500 },
    );
  }
}
