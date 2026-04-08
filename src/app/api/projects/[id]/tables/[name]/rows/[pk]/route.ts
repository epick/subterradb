import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { deleteRow, updateRow } from '@/server/tables';

// PATCH /api/projects/[id]/tables/[name]/rows/[pk]
// Body: { values: Record<string, unknown> }
//
// Updates one row in the named table by primary-key value.
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; name: string; pk: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }
  const { id, name, pk } = await context.params;

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
    const row = await updateRow(user, id, name, pk, body.values as Record<string, unknown>);
    return NextResponse.json({ row });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'tables.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}

// DELETE /api/projects/[id]/tables/[name]/rows/[pk]
//
// Deletes one row by primary-key value.
export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string; name: string; pk: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }
  const { id, name, pk } = await context.params;
  try {
    await deleteRow(user, id, name, pk);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const e = err as { code?: string; status?: number; message?: string };
    return NextResponse.json(
      { code: e.code ?? 'tables.unknown_error', message: e.message },
      { status: e.status ?? 500 },
    );
  }
}
