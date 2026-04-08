import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { deleteProject, getProjectForViewer } from '@/server/projects';

// GET /api/projects/[id]
//
// Returns the full project (including keys) if the user has access.
// 404 if the project doesn't exist OR the user can't see it — we don't
// distinguish, to avoid leaking the existence of projects.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const project = await getProjectForViewer(user, id);
  if (!project) {
    return NextResponse.json({ code: 'projects.not_found' }, { status: 404 });
  }

  return NextResponse.json({ project });
}

// DELETE /api/projects/[id]
//
// Admin only. Tears down Kong entities first, then deletes the row.
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
    await deleteProject(user, id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { code?: string; status?: number };
    return NextResponse.json(
      { code: e.code ?? 'projects.unknown_error' },
      { status: e.status ?? 500 },
    );
  }
}
