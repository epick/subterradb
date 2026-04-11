import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { query } from '@/server/db';

// GET /api/projects/[id]/members
//
// Returns the developers assigned to this project.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await query<{ id: string; name: string; email: string }>(
    `SELECT u.id, u.name, u.email
     FROM project_members m
     JOIN platform_users u ON u.id = m.user_id
     WHERE m.project_id = $1
     ORDER BY u.name`,
    [id],
  );
  return NextResponse.json({ members: result.rows });
}

// POST /api/projects/[id]/members
//
// Body: { userId: string }
// Admin only. Assigns a developer to this project.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ code: 'auth.forbidden' }, { status: 403 });
  }

  const { id } = await context.params;
  let body: { userId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'members.invalid_body' }, { status: 400 });
  }

  if (typeof body.userId !== 'string') {
    return NextResponse.json({ code: 'members.missing_fields' }, { status: 400 });
  }

  // Check if already assigned.
  const existing = await query(
    `SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [id, body.userId],
  );
  if (existing.rowCount! > 0) {
    return NextResponse.json({ code: 'already_assigned' }, { status: 409 });
  }

  await query(
    `INSERT INTO project_members (project_id, user_id) VALUES ($1, $2)`,
    [id, body.userId],
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
