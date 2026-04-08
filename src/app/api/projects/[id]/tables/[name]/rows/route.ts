import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { insertRow } from '@/server/tables';

// POST /api/projects/[id]/tables/[name]/rows
// Body: { values: Record<string, unknown> }
//
// Inserts one row into the named table in the project's public schema.
// Empty-string values are coerced to NULL (matches Supabase Studio UX).
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string; name: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }
  const { id, name } = await context.params;

  let body: { values?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'tables.invalid_body' }, { status: 400 });
  }

  if (!body.values || typeof body.values !== 'object' || Array.isArray(body.values)) {
    return NextResponse.json({ code: 'tables.invalid_body' }, { status: 400 });
  }

  try {
    const row = await insertRow(user, id, name, body.values as Record<string, unknown>);
    return NextResponse.json({ row }, { status: 201 });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'tables.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
