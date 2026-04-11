import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { getProjectContainerInfo } from '@/server/containers';
import { query } from '@/server/db';

// GET /api/projects/[id]/services
//
// Returns container status for all 4 per-project services.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await query<{ slug: string }>(
    `SELECT slug FROM projects WHERE id = $1`,
    [id],
  );
  if (result.rowCount === 0) {
    return NextResponse.json({ code: 'projects.not_found' }, { status: 404 });
  }

  const services = await getProjectContainerInfo(result.rows[0].slug);
  return NextResponse.json({ services });
}
