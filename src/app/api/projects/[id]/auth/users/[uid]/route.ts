import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { deleteProjectAuthUser } from '@/server/project-auth';

// DELETE /api/projects/[id]/auth/users/[uid]
//
// Removes a user from the project's GoTrue auth schema.
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; uid: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }
  const { id, uid } = await context.params;
  try {
    await deleteProjectAuthUser(user, id, uid);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'auth.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
