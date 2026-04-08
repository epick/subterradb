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
// Response: 201 { project }   row inserted with status = 'provisioning'
//          400/403/409        on validation, RBAC, or duplicate slug
//
// Admin only. Returns immediately after the row is inserted; the long
// provisioning sequence (DB + 4 containers + Kong routes, ~20-30s) runs in
// the background. The frontend navigates to the project detail page and
// polls until the status flips to 'running' or 'error'.
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

    // Fire-and-forget the long provisioning. We deliberately don't await it
    // so the HTTP response goes back in ~200ms. Errors inside runProvisioning
    // mark the project row as `status='error'` and roll back partial state.
    void result.runProvisioning();

    return NextResponse.json({ project: result.project }, { status: 201 });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'projects.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
