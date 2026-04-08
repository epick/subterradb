import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { resumeProject } from '@/server/projects';

// POST /api/projects/[id]/start
//
// Resumes a previously-stopped project by restarting its PostgREST + GoTrue
// containers. The database and Kong routes are still in place from before,
// so resume is fast (no migrations, no provisioning). Admin only.
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
    const project = await resumeProject(user, id);
    return NextResponse.json({ project });
  } catch (err) {
    const e = err as { code?: string; status?: number };
    return NextResponse.json(
      { code: e.code ?? 'projects.unknown_error' },
      { status: e.status ?? 500 },
    );
  }
}
