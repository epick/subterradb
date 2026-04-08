import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { pauseProject } from '@/server/projects';

// POST /api/projects/[id]/stop
//
// Pauses the per-project containers (PostgREST + GoTrue). The database and
// Kong entities are kept intact so resuming is instant. Admin only.
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }
  const { id } = await context.params;
  try {
    const project = await pauseProject(user, id);
    return NextResponse.json({ project });
  } catch (err) {
    const e = err as { code?: string; status?: number };
    return NextResponse.json(
      { code: e.code ?? 'projects.unknown_error' },
      { status: e.status ?? 500 },
    );
  }
}
