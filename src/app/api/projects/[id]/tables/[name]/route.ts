import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { getTableDetail } from '@/server/tables';

// GET /api/projects/[id]/tables/[name]
//
// Returns the columns + first 100 rows of one table in the project's
// public schema. Used by the in-GUI Table Editor when a row is selected.
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string; name: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }
  const { id, name } = await context.params;
  try {
    const detail = await getTableDetail(user, id, name);
    return NextResponse.json(detail);
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'tables.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
