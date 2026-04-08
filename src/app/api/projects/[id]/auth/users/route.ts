import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { listProjectAuthUsers } from '@/server/project-auth';

// GET /api/projects/[id]/auth/users
//
// Lists the users in this project's GoTrue auth schema.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const users = await listProjectAuthUsers(user, id);
    return NextResponse.json({ users });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'auth.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
