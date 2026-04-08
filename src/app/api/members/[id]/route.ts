import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { removeMember } from '@/server/members';

// DELETE /api/members/[id]
//
// Admin only. Cannot remove yourself or the last remaining admin.
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  try {
    await removeMember(user, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { code?: string; status?: number };
    return NextResponse.json(
      { code: e.code ?? 'members.unknown_error' },
      { status: e.status ?? 500 },
    );
  }
}
