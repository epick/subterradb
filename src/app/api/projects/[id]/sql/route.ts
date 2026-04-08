import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/server/auth';
import { executeSql } from '@/server/sql';

// POST /api/projects/[id]/sql
//
// Body: { query: string }
// Response: { columns, rows, rowCount, durationMs }   on success
//          { code, message, durationMs? }              on error
//
// The query runs inside a transaction with SET LOCAL ROLE service_role,
// so it has full read/write access regardless of RLS.
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ code: 'auth.unauthenticated' }, { status: 401 });
  }

  const { id } = await context.params;
  let body: { query?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ code: 'sql.invalid_body' }, { status: 400 });
  }

  if (typeof body.query !== 'string') {
    return NextResponse.json({ code: 'sql.empty_query' }, { status: 400 });
  }

  try {
    const result = await executeSql(user, id, body.query);
    return NextResponse.json(result);
  } catch (err) {
    const e = err as {
      code?: string;
      status?: number;
      message?: string;
      details?: unknown;
    };
    return NextResponse.json(
      { code: e.code ?? 'sql.unknown_error', message: e.message, details: e.details },
      { status: e.status ?? 500 },
    );
  }
}
