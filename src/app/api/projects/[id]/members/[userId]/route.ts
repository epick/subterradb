import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { query } from '@/server/db';

// DELETE /api/projects/[id]/members/[userId]
//
// Admin only. Removes a developer from this project.
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; userId: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') {
    return NextResponse.json({ code: 'auth.forbidden' }, { status: 403 });
  }

  const { id, userId } = await context.params;
  await query(
    `DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
    [id, userId],
  );
  return NextResponse.json({ ok: true });
}
