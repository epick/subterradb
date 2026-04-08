import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { createProject, listProjects } from '@/server/projects';

// GET /api/projects
//
// Returns the projects visible to the current user. RBAC enforced server-side
// inside listProjects (admin sees all, dev sees only assigned).
export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }

  const projects = await listProjects(user);
  return NextResponse.json({ projects });
}

// POST /api/projects
//
// Body: { name: string, slug?: string, dbPassword?: string }
// Response: 201 { project }   on success (project status = running)
//          400/403/409/502    on validation, RBAC, or Kong errors
//
// Admin only. Provisions Kong entities synchronously — caller blocks until
// the project is reachable through the gateway.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }

  let body: { name?: unknown; slug?: unknown; dbPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'projects.invalid_body' }, { status: 400 });
  }

  if (typeof body.name !== 'string') {
    return NextResponse.json({ code: 'projects.name_required' }, { status: 400 });
  }

  try {
    const result = await createProject(user, {
      name: body.name,
      slug: typeof body.slug === 'string' ? body.slug : undefined,
      dbPassword: typeof body.dbPassword === 'string' ? body.dbPassword : undefined,
    });
    return NextResponse.json({ project: result.project }, { status: 201 });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'projects.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
