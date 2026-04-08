import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { listTables } from '@/server/tables';

// GET /api/projects/[id]/tables
//
// Returns the list of tables in the project's public schema with approximate
// row counts and column counts. Used by the in-GUI Table Editor.
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
    const tables = await listTables(user, id);
    return NextResponse.json({ tables });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'tables.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
