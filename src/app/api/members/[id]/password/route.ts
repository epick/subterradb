import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { updateMemberPassword } from '@/server/members';

// PATCH /api/members/[id]/password
//
// Body: { password: string }
// Admin only. Updates a member's password.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }

  const { id } = await context.params;

  let body: { password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'members.invalid_body' }, { status: 400 });
  }

  try {
    await updateMemberPassword(
      user,
      id,
      typeof body.password === 'string' ? body.password : '',
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { code?: string; status?: number };
    return NextResponse.json(
      { code: e.code ?? 'members.unknown_error' },
      { status: e.status ?? 500 },
    );
  }
}
